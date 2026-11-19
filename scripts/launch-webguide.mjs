import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import path from "node:path";
import net from "node:net";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";
import {
  localConfiguration,
  ensureService,
  redact,
  setupEnvironment,
  installerEnvironment,
  diagnosticTail,
  modelDownloadProgress,
} from "./launcher-core.mjs";

import { ensurePortableOllama } from "./runtime-bootstrap.mjs";
import { createLauncherConnection } from "./launcher-connection.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);
const runtime = path.join(root, ".webguide-local");
const lockFile = path.join(runtime, "launcher.lock");
const owned = new Set();
const stopping = new AbortController();
let env = { ...process.env },
  token = "",
  locked = false,
  secondary = false,
  stoppingNow = false;
let input, connectionBridge;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const secrets = () =>
  Object.entries(env)
    .filter(([key]) => /TOKEN|SECRET|PASSWORD|API_KEY/.test(key))
    .map(([, value]) => value);
function log(message) {
  const clean = redact(message, secrets());
  console.log(clean);
  void fs
    .appendFile(path.join(runtime, "launcher.log"), `${new Date().toISOString()} ${clean}\n`, {
      mode: 0o600,
    })
    .catch(() => {});
}
function child(
  command,
  args,
  label,
  stdin = "ignore",
  childEnvironment = env,
  captureOutput = false,
) {
  const processChild = spawn(command, args, {
    cwd: root,
    env: childEnvironment,
    stdio: [stdin, captureOutput ? "pipe" : "ignore", captureOutput ? "pipe" : "ignore"],
    windowsHide: true,
    detached: process.platform !== "win32",
  });
  owned.add(processChild);
  processChild.on("error", () => {
    log(`${label} could not start. Check that it is installed and available.`);
  });
  return processChild;
}
async function stopChild(processChild) {
  if (!processChild.pid || processChild.exitCode !== null) return;
  if (process.platform === "win32") {
    await new Promise((resolve) => {
      const killer = spawn("taskkill.exe", ["/PID", String(processChild.pid), "/T", "/F"], {
        stdio: "ignore",
        windowsHide: true,
      });
      killer.on("error", resolve);
      killer.on("exit", resolve);
    });
  } else {
    try {
      process.kill(-processChild.pid, "SIGTERM");
    } catch {}
    for (let i = 0; i < 30 && processChild.exitCode === null; i++) await wait(100);
    if (processChild.exitCode === null)
      try {
        process.kill(-processChild.pid, "SIGKILL");
      } catch {}
  }
}
async function shutdown() {
  if (stoppingNow) return;
  stoppingNow = true;
  stopping.abort();
  input?.close();
  await connectionBridge?.close();
  log("Stopping only processes started by this launcher. Reused services remain running.");
  for (const processChild of [...owned].reverse()) await stopChild(processChild);
  if (locked) await fs.unlink(lockFile).catch(() => {});
}
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"])
  process.on(signal, () => {
    void shutdown().then(() => process.exit(0));
  });
async function run(command, args, label, timeout = 20 * 60 * 1000, childEnvironment = env) {
  if (stopping.signal.aborted) throw Error("Launch cancelled.");
  log(label);
  const processChild = child(
    command,
    args,
    label,
    "ignore",
    setupEnvironment(childEnvironment),
    true,
  );
  const diagnostics = diagnosticTail(secrets);
  for (const stream of [processChild.stdout, processChild.stderr]) {
    stream.setEncoding("utf8");
    stream.on("data", (chunk) => diagnostics.add(chunk));
  }
  const showDownloadProgress = args[0] === "pull" || args.includes("install");
  const startedAt = Date.now();
  const heartbeat = setInterval(() => {
    const progress = showDownloadProgress ? modelDownloadProgress(diagnostics) : "";
    const elapsed = Math.floor((Date.now() - startedAt) / 1000);
    log(
      `${label} (${elapsed}s): ${progress || "Waiting for download or setup; Control+C cancels safely. Relaunch resumes completed setup steps."}`,
    );
  }, 15000);
  const timer = setTimeout(() => {
    void stopChild(processChild);
  }, timeout);
  try {
    await new Promise((resolve, reject) => {
      processChild.once("error", () => reject(Error(`${label} could not start.`)));
      processChild.once("close", (code) =>
        code === 0
          ? resolve()
          : reject(
              Error(
                `${label} did not complete (exit ${code ?? "terminated"}). Check internet access, disk space and prerequisites; retry the launcher.${diagnostics.read() ? "\nRecent setup details (redacted):\n" + diagnostics.read() : ""}`,
              ),
            ),
      );
    });
  } finally {
    clearInterval(heartbeat);
    clearTimeout(timer);
  }
}
async function occupied(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: "127.0.0.1", port });
    socket.setTimeout(600);
    socket.on("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.on("error", () => resolve(false));
    socket.on("timeout", () => {
      socket.destroy();
      resolve(false);
    });
  });
}
async function fetchSafe(url, headers = {}, timeoutMs = 3000) {
  return fetch(url, {
    headers,
    redirect: "error",
    signal: AbortSignal.any([stopping.signal, AbortSignal.timeout(timeoutMs)]),
  });
}
async function boundedText(response, limit = 128000) {
  const reader = response.body?.getReader();
  if (!reader) throw Error("Empty service response");
  let size = 0;
  const chunks = [];
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) throw Error("Service response is too large");
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  return Buffer.concat(chunks).toString("utf8");
}
async function json(url, headers = {}) {
  const response = await fetchSafe(url, headers);
  if (!response.ok) {
    await response.body?.cancel();
    throw Error("Service check failed");
  }
  return JSON.parse(await boundedText(response));
}
const auth = () => ({ Authorization: `Bearer ${token}` });
async function workerReady() {
  try {
    const health = await json("http://127.0.0.1:4318/health", auth());
    const jobs = await json("http://127.0.0.1:4318/jobs?limit=1", auth());
    return (
      health.workerConnected === true &&
      health.mode === "local-single-user" &&
      health.aiProvider === env.WEBGUIDE_AI_PROVIDER &&
      health.aiModel ===
        env.WEBGUIDE_AI_MODEL &&
      health.browserReady === true &&
      Array.isArray(jobs)
    );
  } catch {
    return false;
  }
}
async function appReady() {
  try {
    const response = await fetchSafe("http://127.0.0.1:4320/", {}, 15000);
    const html = await boundedText(response, 1000000);
    if (
      !response.ok ||
      !/<title[^>]*>WebGuide AI/.test(html) ||
      !/text\/html/.test(response.headers.get("content-type") || "")
    )
      return false;
    const sourcePath = encodeURI(path.join(root, "package.json").replace(/\\/g, "/"))
      .replace(/#/g, "%23")
      .replace(/\?/g, "%3F");
    const identity = await fetchSafe("http://127.0.0.1:4320/@fs/" + sourcePath);
    if (!identity.ok) {
      await identity.body?.cancel();
      return false;
    }
    return (await boundedText(identity)) === (await fs.readFile("package.json", "utf8"));
  } catch {
    return false;
  }
}
async function fixtureReady() {
  try {
    const response = await fetchSafe("http://127.0.0.1:4319/");
    return response.ok && (await boundedText(response)).includes("Task Lab · disposable sandbox");
  } catch {
    return false;
  }
}
function findCommand(name) {
  const lookup = spawnSync(process.platform === "win32" ? "where.exe" : "/usr/bin/which", [name], {
    encoding: "utf8",
    windowsHide: true,
  });
  return lookup.status === 0 ? lookup.stdout.trim().split(/\r?\n/)[0] : undefined;
}
async function npmCli() {
  const nodeDirectory = path.dirname(await fs.realpath(process.execPath));
  const candidates = [
    path.join(nodeDirectory, "node_modules/npm/bin/npm-cli.js"),
    path.resolve(nodeDirectory, "../lib/node_modules/npm/bin/npm-cli.js"),
  ];
  const npm = findCommand("npm");
  if (npm && !npm.endsWith(".cmd")) candidates.push(await fs.realpath(npm));
  const found = candidates.find(existsSync);
  if (!found)
    throw Error(
      "npm was not found. Install the full Node.js 24 LTS package from nodejs.org, then reopen the launcher.",
    );
  return found;
}
function openUrl(url) {
  if (process.platform === "darwin") spawn("open", [url], { stdio: "ignore" }).unref();
  else if (process.platform === "win32")
    spawn("rundll32.exe", ["url.dll,FileProtocolHandler", url], {
      stdio: "ignore",
      windowsHide: true,
    }).unref();
  else spawn("xdg-open", [url], { stdio: "ignore" }).unref();
}
async function modelReady() {
  try {
    const base = new URL(env.WEBGUIDE_AI_BASE_URL);
    if (
      base.username ||
      base.password ||
      base.search ||
      base.hash ||
      !(
        base.protocol === "https:" ||
        (base.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(base.hostname))
      )
    )
      throw Error("Invalid model endpoint");
    const data = await json(
      base.href.replace(/\/$/, "") +
        (env.WEBGUIDE_AI_PROVIDER === "ollama" ? "/api/tags" : "/models"),
      env.WEBGUIDE_AI_API_KEY ? { Authorization: `Bearer ${env.WEBGUIDE_AI_API_KEY}` } : {},
    );
    const names =
      env.WEBGUIDE_AI_PROVIDER === "ollama"
        ? data.models?.map((item) => item.name)
        : data.data?.map((item) => item.id);
    return names?.includes(env.WEBGUIDE_AI_MODEL) === true;
  } catch {
    return false;
  }
}
async function prepareManagedModel() {
  if (
    env.WEBGUIDE_AI_PROVIDER !== "ollama" ||
    env.WEBGUIDE_AI_BASE_URL !== "http://127.0.0.1:11436"
  )
    throw Error(
      "Managed model settings must use Ollama on loopback port 11436. Preserve custom providers by removing WEBGUIDE_MANAGED_OLLAMA from your private .env.",
    );
  if (await occupied(11436))
    throw Error(
      "Private model port 11436 is occupied. Close your other WebGuide launcher first. No process was stopped and no external model cache was used.",
    );
  const binary = await ensurePortableOllama(runtime, { run, signal: stopping.signal, log });
  const modelHome = path.join(runtime, "ollama-home");
  const models = path.join(runtime, "models");
  await fs.mkdir(modelHome, { recursive: true, mode: 0o700 });
  await fs.mkdir(models, { recursive: true, mode: 0o700 });
  // Scope the runtime's keypair home to this child only; never alter the user's home.
  const modelEnv = {
    ...setupEnvironment(env),
    OLLAMA_HOST: "127.0.0.1:11436",
    OLLAMA_MODELS: models,
    OLLAMA_NO_CLOUD: "true",
    OLLAMA_NOHISTORY: "true",
    OLLAMA_NUM_PARALLEL: "1",
    [process.platform === "win32" ? "USERPROFILE" : "HOME"]: modelHome,
  };
  await ensureService("Private app-local Ollama", {
    probe: async () => {
      try {
        return Array.isArray((await json("http://127.0.0.1:11436/api/tags")).models);
      } catch {
        return false;
      }
    },
    occupied: () => occupied(11436),
    start: () => child(binary, ["serve"], "Private Ollama", "ignore", modelEnv),
    wait,
    log,
    attempts: 180,
  });
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_.:/-]{0,199}$/.test(env.WEBGUIDE_AI_MODEL || ""))
    throw Error("Invalid configured model name.");
  if (!(await modelReady()))
    await run(
      binary,
      ["pull", env.WEBGUIDE_AI_MODEL],
      "Downloading the private Qwen model (several GB; interrupted downloads resume)",
      2 * 60 * 60 * 1000,
      modelEnv,
    );
  log("Loading the model and verifying a real response. First CPU load can take several minutes.");
  const heartbeat = setInterval(
    () => log("Model warm-up is still running; Control+C cancels safely."),
    15000,
  );
  try {
    const response = await fetch("http://127.0.0.1:11436/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: env.WEBGUIDE_AI_MODEL,
        prompt: "Reply with the word ready.",
        think: false,
        stream: false,
        keep_alive: "30m",
        options: { num_predict: 16, num_ctx: 4096 },
      }),
      redirect: "error",
      signal: AbortSignal.any([stopping.signal, AbortSignal.timeout(300000)]),
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw Error("Private model warm-up failed.");
    }
    const result = JSON.parse(await boundedText(response));
    if (result.done !== true || typeof result.response !== "string" || !result.response.trim())
      throw Error("Private model did not return a valid warm-up answer.");
    log("Private AI model: real warm-up response verified.");
  } finally {
    clearInterval(heartbeat);
  }
}
async function openConnectedApp() {
  await connectionBridge?.close();
  connectionBridge = await createLauncherConnection({ workerToken: token });
  openUrl(connectionBridge.url);
  log("Opened WebGuide with a short-lived one-time local connection. No token was printed.");
}
async function prepareModel() {
  if (env.WEBGUIDE_MANAGED_OLLAMA === "1") return prepareManagedModel();
  if (await modelReady()) {
    log("AI model: existing configured model is available.");
    return;
  }
  if (env.WEBGUIDE_AI_PROVIDER !== "ollama") {
    if (
      process.platform === "win32" &&
      env.WEBGUIDE_AI_BASE_URL === "http://127.0.0.1:11435/v1" &&
      existsSync("local-runtime/llama/llama-server.exe") &&
      existsSync("local-runtime/models/Qwen3-4B-Q4_K_M.gguf")
    ) {
      await ensureService("Existing local Qwen", {
        probe: modelReady,
        occupied: () => occupied(11435),
        start: () => child(process.execPath, ["scripts/start-local-ai.mjs"], "Existing local Qwen"),
        wait,
        log,
        attempts: 180,
      });
      return;
    }
    throw Error(
      "Your existing model configuration is preserved, but its model is unavailable. Start that configured service or correct its private .env settings. This launcher will not replace an existing provider.",
    );
  }
  const base = new URL(env.WEBGUIDE_AI_BASE_URL || "http://127.0.0.1:11434");
  if (
    !["127.0.0.1", "localhost"].includes(base.hostname) ||
    base.protocol !== "http:" ||
    base.pathname !== "/"
  )
    throw Error(
      "Automatic Ollama setup is only for a loopback HTTP service. Start the configured remote service separately.",
    );
  let ollama = findCommand("ollama");
  if (
    !ollama &&
    process.platform === "darwin" &&
    existsSync("/Applications/Ollama.app/Contents/Resources/ollama")
  )
    ollama = "/Applications/Ollama.app/Contents/Resources/ollama";
  const ollamaReady = async () => {
    try {
      const data = await json(base.origin + "/api/tags");
      return Array.isArray(data.models);
    } catch {
      return false;
    }
  };
  if (!ollama) {
    log(
      "Install Ollama from its official download page, open the installed app once, then double-click Start WebGuide again.",
    );
    openUrl(
      process.platform === "darwin"
        ? "https://ollama.com/download/mac"
        : "https://ollama.com/download",
    );
    throw Error("Ollama prerequisite is missing. No privileged installation was attempted.");
  }
  env.OLLAMA_HOST = base.origin;
  await ensureService("Ollama", {
    probe: ollamaReady,
    occupied: () => occupied(Number(base.port || 80)),
    start: () => child(ollama, ["serve"], "Ollama"),
    wait,
    log,
  });
  if (!env.WEBGUIDE_AI_MODEL || !/^[a-zA-Z0-9][a-zA-Z0-9_.:/-]{0,199}$/.test(env.WEBGUIDE_AI_MODEL))
    throw Error("Set a valid Ollama model name in .env.");
  log(
    "First model download can take several minutes and several GB. Existing model files are reused on later launches.",
  );
  await run(
    ollama,
    ["pull", env.WEBGUIDE_AI_MODEL],
    "Downloading the configured Ollama model",
    60 * 60 * 1000,
  );
  if (!(await modelReady()))
    throw Error(
      "Model download finished but the configured model is not available. Check the model name in .env.",
    );
}
async function main() {
  if (Number(process.versions.node.split(".")[0]) < 24)
    throw Error(
      "Install Node.js 24 LTS or newer from https://nodejs.org/en/download, then reopen the launcher.",
    );
  await fs.mkdir(runtime, { recursive: true, mode: 0o700 });
  try {
    await fs.writeFile(lockFile, String(process.pid), { flag: "wx", mode: 0o600 });
    locked = true;
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    const oldPid = Number(await fs.readFile(lockFile, "utf8"));
    let alive = false;
    if (Number.isSafeInteger(oldPid) && oldPid > 0)
      try {
        process.kill(oldPid, 0);
        alive = true;
      } catch {}
    if (alive) {
      secondary = true;
    } else {
      await fs.unlink(lockFile);
      await fs.writeFile(lockFile, String(process.pid), { flag: "wx", mode: 0o600 });
      locked = true;
    }
  }
  log(
    "WebGuide local launcher. Keep this window open. Control+C stops only services started here.",
  );
  const original = await fs.readFile(".env", "utf8").catch((error) => {
    if (error.code === "ENOENT") return "";
    throw error;
  });
  const config = localConfiguration(
    original,
    secondary
      ? () => {
          throw Error(
            "The first launcher is still preparing local settings. Wait for its Ready message, then double-click Start WebGuide again.",
          );
        }
      : undefined,
    process.env,
  );
  env = {
    ...process.env,
    ...config.env,
    PORT: "4318",
    WEBGUIDE_WORKER_MODE: "local",
    WEBGUIDE_WORKER_HOST: "127.0.0.1",
  };
  if (env.WEBGUIDE_MANAGED_OLLAMA === "1") {
    env.PLAYWRIGHT_BROWSERS_PATH = path.join(runtime, "browsers");
    process.env.PLAYWRIGHT_BROWSERS_PATH = env.PLAYWRIGHT_BROWSERS_PATH;
  }
  env = installerEnvironment(env, runtime);
  token = env.WEBGUIDE_WORKER_TOKEN;
  if (config.changed && !secondary) {
    await fs.writeFile(".env", config.content, { mode: 0o600 });
    await fs.chmod(".env", 0o600).catch(() => {});
    log("Created missing local settings securely; existing configured values were preserved.");
  }
  if (secondary) {
    log("An existing launcher owns the services. Checking them before reopening WebGuide.");
    if (!(await workerReady()) || !(await appReady()) || !(await modelReady()))
      throw Error(
        "The first launcher is still starting, or its local services are unavailable. Keep its window open; wait for Ready, then double-click Start WebGuide again. No services or settings were changed.",
      );
    if (process.argv.includes("--no-browser") || process.argv.includes("--check")) {
      log("Existing WebGuide services verified. No second service process was started.");
      return;
    }
    await openConnectedApp();
    await connectionBridge.done;
    return;
  }
  const workerExists = await workerReady();
  const appExists = await appReady();
  if (!workerExists && (await occupied(4318)))
    throw Error(
      "Port 4318 is occupied but its product, model or token does not match. No process was stopped.",
    );
  if (!appExists && (await occupied(4320)))
    throw Error("Port 4320 is occupied by another application. No process was stopped.");
  const service = (name, port, probe, args) =>
    ensureService(name, {
      probe,
      occupied: () => occupied(port),
      start: () => child(process.execPath, args, name),
      wait,
      log,
      attempts: 120,
    });
  if (!workerExists || !appExists) {
    const cli = await npmCli();
    const lockHash = createHash("sha256")
      .update(await fs.readFile("package-lock.json"))
      .digest("hex");
    const installed =
      existsSync("node_modules/vite/bin/vite.js") && existsSync("node_modules/tsx/dist/cli.mjs");
    const oldHash = await fs
      .readFile(path.join(runtime, "dependency-lock.sha256"), "utf8")
      .catch(() => "");
    if (!installed || oldHash !== lockHash) {
      if (workerExists || appExists)
        throw Error(
          "Dependencies changed while a service is running. Stop your own existing WebGuide services before updating dependencies.",
        );
      await run(
        process.execPath,
        [cli, "ci", "--no-audit", "--no-fund"],
        "Installing locked project dependencies",
      );
    }
    await fs.writeFile(path.join(runtime, "dependency-lock.sha256"), lockHash, { mode: 0o600 });
    await run(
      process.execPath,
      ["scripts/build-assistance.mjs"],
      "Preparing browser assistance assets",
    );
    await service("WebGuide basic workspace", 4320, appReady, [
      "node_modules/vite/bin/vite.js",
      "dev",
      "--host",
      "127.0.0.1",
      "--port",
      "4320",
      "--strictPort",
    ]);
    if (!appExists && !process.argv.includes("--no-browser") && !process.argv.includes("--check")) {
      openUrl("http://127.0.0.1:4320/");
      log(
        "Basic workspace opened: voice, keyboard and practice are available. AI setup continues here. A connected workspace will open when AI is ready.",
      );
    }
    if (!workerExists) {
      const { chromium } = await import("playwright");
      if (!existsSync(chromium.executablePath()))
        await run(
          process.execPath,
          ["node_modules/playwright/cli.js", "install", "chromium"],
          "Installing the matching Chromium browser",
          45 * 60 * 1000,
        );
    }
  }
  await prepareModel();
  await service("WebGuide worker", 4318, workerReady, ["--import", "tsx", "worker/server.ts"]);
  if (env.WEBGUIDE_SANDBOX_ORIGIN === "http://127.0.0.1:4319")
    await service("Controlled practice fixture", 4319, fixtureReady, [
      "--import",
      "tsx",
      "worker/fixture.ts",
    ]);
  await service("WebGuide app", 4320, appReady, [
    "node_modules/vite/bin/vite.js",
    "dev",
    "--host",
    "127.0.0.1",
    "--port",
    "4320",
    "--strictPort",
  ]);
  log(
    env.WEBGUIDE_MANAGED_OLLAMA === "1"
      ? "Ready: local services are running and a real AI response was verified. WebGuide connects automatically when opened by this launcher."
      : "Ready: local services are running and your configured model is available. WebGuide connects automatically when opened by this launcher.",
  );
  if (!process.argv.includes("--no-browser") && !process.argv.includes("--check"))
    await openConnectedApp();
  log(
    "To reopen and reconnect, double-click Start WebGuide again or type o then Return here. Optional: type c then Return to copy the private token for the browser companion or manual recovery; this replaces your clipboard. Type q then Return, or Control+C, to stop.",
  );
  if (process.argv.includes("--check")) return;
  input = createInterface({ input: process.stdin, output: process.stdout });
  input.on("SIGINT", () => {
    void shutdown().then(() => process.exit(0));
  });
  input.on("close", () => {
    if (!stoppingNow) void shutdown().then(() => process.exit(0));
  });
  input.on("line", (line) => {
    if (line.trim().toLowerCase() === "o")
      void openConnectedApp().catch(() => log("Could not reopen WebGuide. Retry o then Return."));
    if (line.trim().toLowerCase() === "q") void shutdown().then(() => process.exit(0));
    if (line.trim().toLowerCase() === "c") {
      const command =
        process.platform === "darwin" ? "pbcopy" : process.platform === "win32" ? "clip.exe" : null;
      if (!command) {
        log("Open the private .env file to copy WEBGUIDE_WORKER_TOKEN. Do not share that file.");
        return;
      }
      const copy = spawn(command, [], { stdio: ["pipe", "ignore", "ignore"], windowsHide: true });
      copy.on("error", () =>
        log("Clipboard unavailable. Copy the worker token from your private .env file."),
      );
      copy.on("exit", (code) =>
        log(
          code === 0
            ? "Private token copied for your browser companion or manual connection recovery. Clear the clipboard afterwards."
            : "Clipboard copy failed; use your private .env file.",
        ),
      );
      copy.stdin.on("error", () => {});
      copy.stdin.end(token);
    }
  });
  await new Promise((resolve) =>
    stopping.signal.addEventListener("abort", resolve, { once: true }),
  );
}
main()
  .catch((error) => {
    log(error instanceof Error ? error.message : "Launcher failed. Check docs/MAC_SETUP.md.");
    process.exitCode = 1;
  })
  .finally(shutdown);

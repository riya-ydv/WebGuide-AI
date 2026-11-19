import { normalizeEnvironment } from "../shared/environment.mjs";
import path from "node:path";
import { parseEnv, stripVTControlCharacters } from "node:util";
import { randomBytes } from "node:crypto";

export function localConfiguration(
  content = "",
  makeToken = () => randomBytes(32).toString("hex"),
  inherited = {},
) {
  const supported = Object.fromEntries(
    Object.entries(normalizeEnvironment(inherited)).filter(
      ([key, value]) => /^(WEBGUIDE_|PORT$)/.test(key) && typeof value === "string",
    ),
  );
  const env = { ...supported, ...normalizeEnvironment(parseEnv(content)) };
  const additions = {};
  const token = env.WEBGUIDE_WORKER_TOKEN;
  if (!token) additions.WEBGUIDE_WORKER_TOKEN = makeToken();
  else if (
    token.length < 32 ||
    token.length > 512 ||
    /\s/.test(token) ||
    token.startsWith("replace-")
  )
    throw new Error(
      "Your existing .env has an invalid worker token. Replace its placeholder with a random token; the launcher will not overwrite existing settings.",
    );
  if (!env.WEBGUIDE_AI_PROVIDER) {
    additions.WEBGUIDE_AI_PROVIDER = "ollama";
    if (!env.WEBGUIDE_AI_BASE_URL) {
      additions.WEBGUIDE_AI_BASE_URL = "http://127.0.0.1:11436";
      additions.WEBGUIDE_MANAGED_OLLAMA = "1";
    }
    if (!env.WEBGUIDE_AI_MODEL) additions.WEBGUIDE_AI_MODEL = "qwen3:4b";
  }
  if (!env.WEBGUIDE_SANDBOX_ORIGIN) additions.WEBGUIDE_SANDBOX_ORIGIN = "http://127.0.0.1:4319";
  const merged = { ...env, ...additions };
  if (
    (merged.WEBGUIDE_WORKER_MODE && merged.WEBGUIDE_WORKER_MODE !== "local") ||
    (merged.WEBGUIDE_WORKER_HOST && merged.WEBGUIDE_WORKER_HOST !== "127.0.0.1") ||
    (merged.PORT && merged.PORT !== "4318") ||
    (merged.WEBGUIDE_WORKER_PORT && merged.WEBGUIDE_WORKER_PORT !== "4318")
  )
    throw new Error(
      "This launcher uses local loopback ports 4318 and 4320. Keep hosted/custom-port configurations in their separate deployment; existing .env was not changed.",
    );
  const append = Object.entries(additions)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  return {
    env: merged,
    content: append
      ? content + (content && !content.endsWith("\n") ? "\n" : "") + append + "\n"
      : content,
    changed: Boolean(append),
  };
}

export async function ensureService(name, { probe, occupied, start, wait, log, attempts = 80 }) {
  if (await probe()) {
    log(`${name}: reusing the verified existing service.`);
    return "reused";
  }
  if (await occupied())
    throw new Error(
      `${name}: its port is occupied by another service or an incompatible configuration. No process was stopped. Close only your own old instance, then launch again.`,
    );
  log(`${name}: starting…`);
  const child = await start();
  for (let i = 0; i < attempts; i++) {
    if (await probe()) {
      log(`${name}: ready.`);
      return "started";
    }
    if (child.exitCode !== null && child.exitCode !== undefined)
      throw new Error(
        `${name} exited before becoming ready. Check prerequisites and .env; no credentials were printed.`,
      );
    await wait(500);
  }
  throw new Error(
    `${name} did not become ready in time. Check its configuration and available memory.`,
  );
}

export function redact(message, secrets) {
  let clean = String(message);
  for (const secret of secrets
    .filter((value) => typeof value === "string" && value.length >= 4)
    .sort((a, b) => b.length - a.length))
    clean = clean.split(secret).join("[REDACTED]");
  return clean.replace(/Bearer\s+[^\s"']+/gi, "Bearer [REDACTED]");
}

export function setupEnvironment(environment) {
  return Object.fromEntries(
    Object.entries(environment).filter(([key]) => !/TOKEN|SECRET|PASSWORD|API_KEY/.test(key)),
  );
}

export function installerEnvironment(
  environment,
  runtime,
  executable = process.execPath,
  platform = process.platform,
) {
  const pathKey = Object.keys(environment).find((key) => key.toUpperCase() === "PATH");
  const originalPath = (pathKey && environment[pathKey]) || "";
  const result = Object.fromEntries(
    Object.entries(environment).filter(
      ([key]) => key.toUpperCase() !== "PATH" && key.toLowerCase() !== "npm_config_cache",
    ),
  );
  const paths = platform === "win32" ? path.win32 : path.posix;
  result.PATH = paths.dirname(executable) + paths.delimiter + originalPath;
  result.npm_config_cache = paths.join(runtime, "npm-cache");
  return result;
}

export function diagnosticTail(secretValues, limit = 16384) {
  let pending = "";
  return {
    add(chunk) {
      pending += String(chunk);
      if (pending.length > limit) {
        pending = pending.slice(-limit);
        // Discard a potentially truncated credential at the beginning of the retained tail.
        const boundary = pending.search(/[\r\n]/);
        pending = boundary < 0 ? "" : pending.slice(boundary + 1);
      }
    },
    read() {
      const clean = redact(stripVTControlCharacters(pending), secretValues())
        .replace(/https?:\/\/[^\s/@]+:[^\s/@]+@/gi, "https://[REDACTED]@")
        .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, "")
        .replace(/\r/g, "\n")
        .trim();
      const lines = clean.split("\n").filter(Boolean).slice(-6);
      return lines.map((line) => line.slice(0, 500)).join("\n");
    },
  };
}

export function modelDownloadProgress(tail) {
  const lines = tail
    .read()
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  // Only known download progress shapes; never emit arbitrary child output on a heartbeat.
  return (
    lines
      .reverse()
      .find((line) => /(?:\b\d{1,3}%|\b\d+(?:\.\d+)?\s*(?:[KMGT]i?B)(?:\/s)?\b)/i.test(line)) || ""
  );
}

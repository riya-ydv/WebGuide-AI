import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import os from "node:os";
test("second instance never changes active lock or settings and never starts services when owner is preparing", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "webguide secondary "));
  try {
    await fs.mkdir(path.join(directory, "scripts"));
    await fs.mkdir(path.join(directory, "shared"));
    await fs.copyFile("shared/environment.mjs", path.join(directory, "shared/environment.mjs"));
    await fs.mkdir(path.join(directory, ".webguide-local"));
    for (const file of [
      "launch-webguide.mjs",
      "launcher-core.mjs",
      "launcher-connection.mjs",
      "runtime-bootstrap.mjs",
    ])
      await fs.copyFile(path.join("scripts", file), path.join(directory, "scripts", file));
    const original =
      "GUIDEFLOW_WORKER_TOKEN=" +
      "t".repeat(64) +
      "\nGUIDEFLOW_AI_PROVIDER=ollama\nGUIDEFLOW_AI_MODEL=test-model\nGUIDEFLOW_AI_BASE_URL=http://127.0.0.1:11434\n";
    const lock = path.join(directory, ".webguide-local/launcher.lock");
    await fs.writeFile(lock, String(process.pid));
    await fs.writeFile(path.join(directory, ".env"), original);
    const preload = path.join(directory, "deny-network.mjs");
    await fs.writeFile(
      preload,
      'globalThis.fetch = async () => { throw Error("Isolated test: network blocked"); };',
    );
    const childEnv = { ...process.env };
    for (const key of Object.keys(childEnv))
      if (/^(GUIDEFLOW_|WEBGUIDE_|PORT$)/.test(key)) delete childEnv[key];
    const run = spawnSync(
      process.execPath,
      [
        "--import",
        pathToFileURL(preload).href,
        path.join(directory, "scripts/launch-webguide.mjs"),
        "--no-browser",
      ],
      { env: childEnv, encoding: "utf8", timeout: 10000, windowsHide: true },
    );
    assert.equal(run.status, 1);
    assert.match(run.stdout, /first launcher is still starting/);
    assert.equal(await fs.readFile(lock, "utf8"), String(process.pid));
    assert.equal(await fs.readFile(path.join(directory, ".env"), "utf8"), original);
    assert(!run.stdout.includes("Installing"));
    assert(!run.stdout.includes("Downloading"));
    assert(!run.stdout.includes("t".repeat(64)));
    await fs.writeFile(path.join(directory, "package.json"), "{}");
    await fs.writeFile(
      preload,
      `globalThis.fetch=async(url)=>new Response(url.includes("/@fs/")?"{}":url.endsWith("/health")?JSON.stringify({workerConnected:true,mode:"local-single-user",aiProvider:"ollama",aiModel:"test-model",browserReady:true}):url.includes("/jobs")?"[]":url.endsWith("/api/tags")?JSON.stringify({models:[{name:"test-model"}]}):"<title>WebGuide AI</title>",{headers:{"Content-Type":url==="http://127.0.0.1:4320/"?"text/html":"application/json"}});`,
    );
    const ready = spawnSync(
      process.execPath,
      [
        "--import",
        pathToFileURL(preload).href,
        path.join(directory, "scripts/launch-webguide.mjs"),
        "--check",
      ],
      { env: childEnv, encoding: "utf8", timeout: 10000, windowsHide: true },
    );
    assert.equal(ready.status, 0);
    assert.match(ready.stdout, /Existing WebGuide services verified/);
    assert.equal(await fs.readFile(lock, "utf8"), String(process.pid));
    assert.equal(await fs.readFile(path.join(directory, ".env"), "utf8"), original);
  } finally {
    assert.equal(path.dirname(path.resolve(directory)), path.resolve(os.tmpdir()));
    assert(path.basename(directory).startsWith("webguide secondary "));
    await fs.rm(directory, { recursive: true, force: true });
  }
});

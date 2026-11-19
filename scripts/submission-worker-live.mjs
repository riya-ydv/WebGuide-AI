import { spawn } from "node:child_process";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import path from "node:path";
const directory = path.resolve("artifacts/submission/integration");
await mkdir(directory, { recursive: true });
const tags = await fetch("http://127.0.0.1:11436/api/tags").then((r) => r.json());
const model = tags.models?.find((m) => m.name.startsWith("qwen3:4b"))?.name;
if (!model) throw Error("Existing authorized model qwen3:4b not available");
const env = {
  ...process.env,
  PORT: "4397",
  WEBGUIDE_WORKER_HOST: "127.0.0.1",
  WEBGUIDE_WORKER_MODE: "hosted",
  WEBGUIDE_WORKER_TOKEN: randomBytes(32).toString("hex"),
  WEBGUIDE_ALLOWED_HOSTS: "127.0.0.1:4397,localhost:4397",
  WEBGUIDE_ALLOWED_ORIGINS:
    "http://127.0.0.1:4350,chrome-extension://nnodbcjnbbdbbdakdhppclfbblcmjejl",
  WEBGUIDE_DATA_DIR: path.join(directory, "data"),
  WEBGUIDE_SANDBOX_ORIGIN: "http://127.0.0.1:4319",
  WEBGUIDE_AI_PROVIDER: "ollama",
  WEBGUIDE_AI_BASE_URL: "http://127.0.0.1:11436",
  WEBGUIDE_AI_MODEL: model,
  EXAMPLE_API_KEY: "",
};
const envFile = path.join(directory, ".env");
await writeFile(
  envFile,
  Object.entries(env)
    .filter(([k]) => k.startsWith("WEBGUIDE_") || k === "PORT")
    .map(([k, v]) => k + "=" + v)
    .join("\n"),
  { mode: 0o600 },
);
const worker = spawn(process.execPath, ["--import", "tsx", "worker/server.ts"], {
  env,
  stdio: ["ignore", "pipe", "pipe"],
  windowsHide: true,
});
let output = "";
worker.stdout.on("data", (v) => (output += v));
worker.stderr.on("data", (v) => (output += v));
await writeFile(path.join(directory, "pid.json"), JSON.stringify({ pid: worker.pid, port: 4397 }));
for (let n = 0; n < 80; n++) {
  try {
    if ((await fetch("http://127.0.0.1:4397/health")).ok) break;
  } catch {}
  await new Promise((r) => setTimeout(r, 250));
}
const health = await fetch("http://127.0.0.1:4397/health").then((r) => r.json());
await writeFile(
  path.join(directory, "runtime.json"),
  JSON.stringify(
    {
      testedAt: new Date().toISOString(),
      scope:
        "Latest source worker and UI; existing previously fresh managed Qwen reused, not fresh installation",
      model,
      health,
    },
    null,
    2,
  ),
);
console.log(
  "Owned worker4397 ready, real existing managed model " +
    model +
    ". Private env saved, token omitted.",
);
process.on("SIGINT", () => worker.kill());
process.on("SIGTERM", () => worker.kill());
await new Promise((r) => worker.on("exit", r));
await writeFile(path.join(directory, "worker.log"), output);

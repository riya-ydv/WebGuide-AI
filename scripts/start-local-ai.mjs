import { normalizeEnvironment } from "../shared/environment.mjs";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import path from "node:path";
const env = normalizeEnvironment({
  ...(existsSync(".env") ? parseEnv(readFileSync(".env", "utf8")) : {}),
  ...process.env,
});
const runtime = path.resolve("local-runtime/llama/llama-server.exe");
const model = path.resolve("local-runtime/models/Qwen3-4B-Q4_K_M.gguf");
if (!existsSync(runtime) || !existsSync(model))
  throw new Error(
    "Run npm run ai:download and extract local-runtime/llama.zip into local-runtime/llama first.",
  );
const args = [
  "--api-key-file",
  path.resolve("local-runtime/api-key.txt"),
  "--cors-origins",
  "http://127.0.0.1:11435",
  "--model",
  model,
  "--host",
  "127.0.0.1",
  "--port",
  "11435",
  "--alias",
  env.WEBGUIDE_AI_MODEL || "webguide-qwen",
  "--ctx-size",
  "4096",
  "--gpu-layers",
  "99",
  "--parallel",
  "1",
  "--threads",
  "6",
  "--reasoning",
  "off",
];
const devices = spawnSync(runtime, ["--list-devices"], { encoding: "utf8", windowsHide: true });
const nvidia = `${devices.stdout}\n${devices.stderr}`.match(/(Vulkan\d+): NVIDIA/);
const selected = env.WEBGUIDE_LLAMA_DEVICE || nvidia?.[1];
if (selected) args.push("--device", selected, "--split-mode", "none");
console.log(`Local model device: ${selected || "runtime automatic selection"}`);
const child = spawn(runtime, args, { stdio: "inherit", windowsHide: true });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill());
child.on("exit", (code) => (process.exitCode = code ?? 1));
child.on("error", () => {
  console.error("Local model runtime could not start");
  process.exitCode = 1;
});

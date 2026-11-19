import { normalizeEnvironment } from "../shared/environment.mjs";
import { parseEnv } from "node:util";
import fs from "node:fs/promises";
import { randomBytes } from "node:crypto";
let content = await fs.readFile(".env", "utf8").catch(() => "");
function get(name) {
  return normalizeEnvironment(parseEnv(content))[name];
}
function set(name, value) {
  content = content.replace(new RegExp("^" + name + "=.*\\r?\\n?", "gm"), "");
  content += `${name}=${value}\n`;
}
for (const name of ["WEBGUIDE_WORKER_TOKEN", "WEBGUIDE_AI_API_KEY"]) {
  const existing = get(name);
  if (!existing || existing.startsWith("replace-")) set(name, randomBytes(32).toString("hex"));
}
for (const [name, value] of Object.entries({
  WEBGUIDE_AI_PROVIDER: "openai-compatible",
  WEBGUIDE_AI_BASE_URL: "http://127.0.0.1:11435/v1",
  WEBGUIDE_AI_MODEL: "webguide-qwen",
  WEBGUIDE_JOB_TIMEOUT_MS: "180000",
  WEBGUIDE_SANDBOX_ORIGIN: "http://127.0.0.1:4319",
}))
  if (!get(name)) set(name, value);
await fs.writeFile(".env", content);
await fs.mkdir("local-runtime", { recursive: true });
await fs.writeFile("local-runtime/api-key.txt", get("WEBGUIDE_AI_API_KEY") + "\n");
console.log("Local .env and model API token configured. No credentials were printed.");

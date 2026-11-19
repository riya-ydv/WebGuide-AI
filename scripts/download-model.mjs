import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
await fs.mkdir("local-runtime/models", { recursive: true });
const assets = [
  {
    url: "https://github.com/ggml-org/llama.cpp/releases/download/b12375/llama-b12375-bin-win-vulkan-x64.zip",
    file: "local-runtime/llama.zip",
    size: 38113510,
    sha: "8990615f25d4fa12a7f1d8fc9da995538ce739fec01838f003fa9ff099d643f0",
  },
  {
    url: "https://huggingface.co/Qwen/Qwen3-4B-GGUF/resolve/bc640142c66e1fdd12af0bd68f40445458f3869b/Qwen3-4B-Q4_K_M.gguf",
    file: "local-runtime/models/Qwen3-4B-Q4_K_M.gguf",
    size: 2497280256,
    sha: "7485fe6f11af29433bc51cab58009521f205840f5b4ae3a32fa7f92e8534fdf5",
  },
];
async function hash(file) {
  const h = createHash("sha256");
  for await (const b of createReadStream(file)) h.update(b);
  return h.digest("hex");
}
for (const asset of assets) {
  if (
    (await fs
      .stat(asset.file)
      .then((s) => s.size === asset.size)
      .catch(() => false)) &&
    (await hash(asset.file)) === asset.sha
  ) {
    console.log("Already verified " + asset.file);
    continue;
  }
  const partial = asset.file + ".partial";
  const file = await fs.open(partial, "w");
  const chunk = Math.ceil(asset.size / 4);
  try {
    await Promise.all(
      Array.from({ length: 4 }, async (_, i) => {
        const start = i * chunk,
          end = Math.min(asset.size - 1, start + chunk - 1);
        const response = await fetch(asset.url, {
          headers: { Range: `bytes=${start}-${end}` },
          signal: AbortSignal.timeout(1800000),
        });
        if (
          response.status !== 206 ||
          !response.headers.get("content-range")?.startsWith(`bytes ${start}-`)
        )
          throw Error("Download server did not honor range");
        let offset = start;
        for await (const bytes of response.body) {
          await file.write(bytes, 0, bytes.length, offset);
          offset += bytes.length;
        }
        if (offset !== end + 1) throw Error("Incomplete asset download");
        console.log(asset.file + " segment " + (i + 1) + "/4");
      }),
    );
  } finally {
    await file.close();
  }
  if ((await hash(partial)) !== asset.sha)
    throw Error("Official SHA256 verification failed: " + asset.file);
  await fs.rename(partial, asset.file);
  console.log("Verified " + asset.file);
}
if (process.platform === "win32") {
  const result = spawnSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-Command",
      "Expand-Archive -LiteralPath 'local-runtime/llama.zip' -DestinationPath 'local-runtime/llama' -Force",
    ],
    { stdio: "inherit", windowsHide: true },
  );
  if (result.status !== 0) throw Error("Runtime extraction failed");
}
console.log("Local runtime and model verified. Start with npm run ai:start");

import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";

export const OLLAMA_VERSION = "0.40.16";
const assets = {
  "win32-x64": {
    name: "ollama-windows-amd64.zip",
    bytes: 1618244995,
    sha256: "50fcf5ad54277f2fa5d173ebfc93bcb017adbc0c9ef2314daabc96ca9e6aa64e",
    executable: "ollama.exe",
  },
  "win32-arm64": {
    name: "ollama-windows-arm64.zip",
    bytes: 386918926,
    sha256: "86d2b329cae3125684ff29b506623710b68e1393f679594f1c6aa267beac31c2",
    executable: "ollama.exe",
  },
  "darwin-x64": {
    name: "Ollama-darwin.zip",
    bytes: 229245253,
    sha256: "4715531bc49d21337381b193765041e535a9fb4716f84e5d6eccc3a9af1b5303",
    executable: "Ollama.app/Contents/Resources/ollama",
  },
  "darwin-arm64": {
    name: "Ollama-darwin.zip",
    bytes: 229245253,
    sha256: "4715531bc49d21337381b193765041e535a9fb4716f84e5d6eccc3a9af1b5303",
    executable: "Ollama.app/Contents/Resources/ollama",
  },
};
export function runtimeAsset(platform = process.platform, arch = process.arch) {
  const asset = assets[`${platform}-${arch}`];
  if (!asset)
    throw Error(
      "Automatic portable Ollama supports Windows x64/ARM64 and macOS Intel/Apple Silicon. This platform needs a separately configured model service.",
    );
  return {
    ...asset,
    url: `https://github.com/ollama/ollama/releases/download/v${OLLAMA_VERSION}/${asset.name}`,
  };
}
export function contained(root, relative) {
  const result = path.resolve(root, relative);
  if (result === path.resolve(root) || !result.startsWith(path.resolve(root) + path.sep))
    throw Error("Runtime path escaped the application-local directory");
  return result;
}
export async function fileSha256(file) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file, { highWaterMark: 1024 * 1024 }))
    hash.update(chunk);
  return hash.digest("hex");
}
function officialResponse(response) {
  if (!response.url) return;
  const url = new URL(response.url);
  if (
    url.protocol !== "https:" ||
    ![
      "github.com",
      "release-assets.githubusercontent.com",
      "objects.githubusercontent.com",
    ].includes(url.hostname)
  )
    throw Error("Runtime download redirected outside the official release hosts");
}
export async function downloadParallel(
  asset,
  destination,
  { signal, log, fetcher = fetch, partSize = 4 * 1024 * 1024 },
) {
  const partial = destination + ".partial";
  const prefix = await fs
    .stat(partial)
    .then((s) => s.size)
    .catch(() => 0);
  if (prefix >= asset.bytes) return false;
  const directory = destination + `.parts-${prefix}`;
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  const count = Math.ceil((asset.bytes - prefix) / partSize);
  const controller = new AbortController();
  const combined = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
  let complete = prefix,
    last = Date.now(),
    previous = prefix;
  const partPath = (index) => path.join(directory, String(index));
  async function part(index, probe = false) {
    const start = prefix + index * partSize,
      end = Math.min(asset.bytes - 1, start + partSize - 1),
      length = end - start + 1;
    if (
      await fs
        .stat(partPath(index))
        .then((s) => s.size === length)
        .catch(() => false)
    ) {
      complete += length;
      return true;
    }
    const response = await fetcher(asset.url, {
      headers: { Range: `bytes=${start}-${end}` },
      redirect: "follow",
      signal: AbortSignal.any([combined, AbortSignal.timeout(180000)]),
    });
    try {
      officialResponse(response);
    } catch (error) {
      await response.body?.cancel();
      throw error;
    }
    if (probe && response.status === 200) {
      await response.body?.cancel();
      return false;
    }
    if (
      response.status !== 206 ||
      response.headers.get("content-range") !== `bytes ${start}-${end}/${asset.bytes}` ||
      !response.body
    ) {
      await response.body?.cancel();
      throw Error("Official runtime range response did not match requested bytes");
    }
    const temporary = partPath(index) + ".downloading";
    const file = await fs.open(temporary, "w", 0o600);
    let received = 0;
    try {
      for await (const chunk of response.body) {
        combined.throwIfAborted();
        received += chunk.length;
        if (received > length) throw Error("Runtime range exceeds pinned size");
        let offset = 0;
        while (offset < chunk.length) {
          const written = await file.write(chunk, offset, chunk.length - offset);
          offset += written.bytesWritten;
        }
      }
    } finally {
      await file.close();
    }
    if (received !== length)
      throw Error("Runtime range incomplete; relaunch to resume verified-size chunks");
    await fs.rename(temporary, partPath(index));
    complete += length;
    const now = Date.now();
    if (now - last > 5000 || complete === asset.bytes) {
      log(
        `${asset.name}: ${Math.floor((complete / asset.bytes) * 100)}% (${(complete / 1e6).toFixed(0)} / ${(asset.bytes / 1e6).toFixed(0)} MB, ${((complete - previous) / 1e6 / Math.max(1, (now - last) / 1000)).toFixed(1)} MB/s; four download streams)`,
      );
      previous = complete;
      last = now;
    }
    return true;
  }
  log("Downloading official runtime in four resumable streams; preserving earlier partial bytes.");
  if (!(await part(0, true))) return false;
  let cursor = 1;
  const results = await Promise.allSettled(
    Array.from({ length: 4 }, async () => {
      try {
        while (cursor < count) {
          const index = cursor++;
          await part(index);
        }
      } catch (error) {
        controller.abort();
        throw error;
      }
    }),
  );
  const failed = results.find((item) => item.status === "rejected");
  if (failed) throw failed.reason;
  const assembled = destination + ".assembled";
  const output = await fs.open(assembled, "w", 0o600);
  try {
    const sources = [
      ...(prefix ? [partial] : []),
      ...Array.from({ length: count }, (_, i) => partPath(i)),
    ];
    for (const source of sources)
      for await (const chunk of createReadStream(source)) {
        combined.throwIfAborted();
        let offset = 0;
        while (offset < chunk.length) {
          const written = await output.write(chunk, offset, chunk.length - offset);
          offset += written.bytesWritten;
        }
      }
  } finally {
    await output.close();
  }
  log("Verifying the complete pinned SHA-256 before extracting the parallel download...");
  if (
    (await fs.stat(assembled)).size !== asset.bytes ||
    (await fileSha256(assembled)) !== asset.sha256
  ) {
    // Preserve prior bytes for diagnosis, but keep a corrupt resume set out of the next attempt.
    await fs.rename(directory, directory + `.rejected-${Date.now()}`);
    if (prefix) await fs.rename(partial, partial + `.rejected-${Date.now()}`);
    throw Error("Runtime checksum mismatch. Nothing executed. Retry downloads a fresh set.");
  }
  await fs.rename(assembled, destination);
  if (prefix) await fs.unlink(partial);
  for (let index = 0; index < count; index++) await fs.unlink(partPath(index));
  await fs.rmdir(directory);
  return true;
}
export async function downloadVerified(asset, destination, { signal, log, fetcher = fetch }) {
  if (
    await fs
      .stat(destination)
      .then((s) => s.isFile())
      .catch(() => false)
  ) {
    log("Checking the cached runtime archive against its pinned size and SHA-256…");
    if (
      (await fs.stat(destination)).size === asset.bytes &&
      (await fileSha256(destination)) === asset.sha256
    )
      return;
    await fs.unlink(destination);
  }
  if (
    asset.bytes >= 64 * 1024 * 1024 &&
    (await downloadParallel(asset, destination, { signal, log, fetcher }))
  )
    return;
  const partial = destination + ".partial";
  let received = await fs
    .stat(partial)
    .then((s) => s.size)
    .catch(() => 0);
  if (received > asset.bytes) {
    await fs.unlink(partial);
    received = 0;
  }
  if (received !== asset.bytes) {
    log(
      `Downloading ${asset.name}: ${(asset.bytes / 1e6).toFixed(0)} MB; resumes interrupted downloads.`,
    );
    const response = await fetcher(asset.url, {
      headers: received ? { Range: `bytes=${received}-` } : {},
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(2 * 60 * 60 * 1000)])
        : AbortSignal.timeout(2 * 60 * 60 * 1000),
      redirect: "follow",
    });
    if (response.url) {
      const url = new URL(response.url);
      if (
        url.protocol !== "https:" ||
        ![
          "github.com",
          "release-assets.githubusercontent.com",
          "objects.githubusercontent.com",
        ].includes(url.hostname)
      ) {
        await response.body?.cancel();
        throw Error("Runtime download redirected outside the official release hosts");
      }
    }
    if (!response.ok || !response.body)
      throw Error(
        `Official runtime download failed (HTTP ${response.status}). Retry the launcher.`,
      );
    if (received && response.status === 206) {
      if (!response.headers.get("content-range")?.startsWith(`bytes ${received}-`)) {
        await response.body.cancel();
        throw Error("Runtime resume range did not match");
      }
    } else {
      received = 0;
    }
    const file = await fs.open(partial, received ? "a" : "w", 0o600);
    let last = Date.now(),
      previous = received;
    try {
      for await (const chunk of response.body) {
        signal?.throwIfAborted();
        received += chunk.length;
        if (received > asset.bytes) throw Error("Runtime download exceeds its pinned release size");
        let offset = 0;
        while (offset < chunk.length) {
          const written = await file.write(chunk, offset, chunk.length - offset);
          offset += written.bytesWritten;
        }
        const now = Date.now();
        if (now - last > 5000 || received === asset.bytes) {
          log(
            `${asset.name}: ${Math.floor((received / asset.bytes) * 100)}% (${(received / 1e6).toFixed(0)} / ${(asset.bytes / 1e6).toFixed(0)} MB, ${((received - previous) / 1e6 / Math.max(1, (now - last) / 1000)).toFixed(1)} MB/s)`,
          );
          last = now;
          previous = received;
        }
      }
    } finally {
      await file.close();
    }
  }
  if (received !== asset.bytes)
    throw Error("Runtime download is incomplete. Relaunch to resume it.");
  log("Checking the pinned official SHA-256 before extracting or executing the runtime…");
  if ((await fileSha256(partial)) !== asset.sha256) {
    await fs.unlink(partial);
    throw Error(
      "Runtime checksum mismatch. Nothing was executed; relaunch to download a fresh copy.",
    );
  }
  await fs.rename(partial, destination);
}
export async function ensurePortableOllama(
  runtime,
  { run, signal, log, platform = process.platform, arch = process.arch },
) {
  const asset = runtimeAsset(platform, arch);
  const directory = contained(runtime, `ollama-${OLLAMA_VERSION}-${platform}-${arch}`);
  const binary = contained(directory, asset.executable);
  const marker = path.join(directory, ".verified-release.json");
  const ready = await fs
    .readFile(marker, "utf8")
    .then(JSON.parse)
    .catch(() => null);
  if (
    ready?.sha256 === asset.sha256 &&
    (await fs
      .stat(binary)
      .then((s) => s.isFile())
      .catch(() => false))
  )
    return binary;
  const downloads = contained(runtime, "downloads");
  await fs.mkdir(downloads, { recursive: true, mode: 0o700 });
  const archive = path.join(downloads, `ollama-${OLLAMA_VERSION}-${asset.name}`);
  await downloadVerified(asset, archive, { signal, log });
  // The launcher lock prevents concurrent installers. Extract into the versioned
  // destination and commit readiness last: Windows can deny renaming a populated
  // executable directory even after the extractor exits. An interrupted install
  // has no valid marker and is re-extracted from the verified archive next time.
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  await fs.unlink(marker).catch((error) => {
    if (error.code !== "ENOENT") throw error;
  });
  const stage = directory;
  if (platform === "win32")
    await run(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        "scripts/extract-runtime.ps1",
        "-Archive",
        archive,
        "-Destination",
        stage,
      ],
      "Extracting the verified app-local Ollama runtime",
    );
  else
    await run(
      "/usr/bin/ditto",
      ["-x", "-k", archive, stage],
      "Extracting the verified app-local Ollama runtime",
    );
  if (
    !(await fs
      .stat(contained(stage, asset.executable))
      .then((s) => s.isFile())
      .catch(() => false))
  )
    throw Error(
      "The official runtime archive had an unexpected layout. No executable was started.",
    );
  await fs.writeFile(
    path.join(stage, ".verified-release.json"),
    JSON.stringify({ version: OLLAMA_VERSION, sha256: asset.sha256 }),
    { mode: 0o600 },
  );
  return binary;
}

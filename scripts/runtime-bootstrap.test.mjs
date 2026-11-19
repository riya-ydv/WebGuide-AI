import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import {
  contained,
  runtimeAsset,
  downloadVerified,
  downloadParallel,
} from "./runtime-bootstrap.mjs";
const content = Buffer.from("verified runtime fixture");
const asset = {
  name: "fixture.zip",
  url: "https://github.com/fixture",
  bytes: content.length,
  sha256: createHash("sha256").update(content).digest("hex"),
};
const log = () => {};
test("supported pinned assets and containment reject unsupported paths", () => {
  for (const platform of ["win32", "darwin"])
    for (const arch of ["x64", "arm64"])
      assert.match(runtimeAsset(platform, arch).sha256, /^[a-f0-9]{64}$/);
  assert.throws(() => runtimeAsset("linux", "x64"));
  assert.throws(() => contained(os.tmpdir(), "../escape"));
});
test("verified download reuses only exact bytes and checksum", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "webguide-runtime-test-"));
  const target = path.join(dir, "runtime.zip");
  await fs.writeFile(target, "bad");
  await downloadVerified(asset, target, { log, fetcher: async () => new Response(content) });
  assert.deepEqual(await fs.readFile(target), content);
  await downloadVerified(asset, target, {
    log,
    fetcher: async () => {
      throw Error("must reuse");
    },
  });
});
test("interrupted download resumes at exact offset", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "webguide-runtime-test-"));
  const target = path.join(dir, "runtime.zip");
  await fs.writeFile(target + ".partial", content.subarray(0, 5));
  await downloadVerified(asset, target, {
    log,
    fetcher: async (url, options) => {
      assert.equal(options.headers.Range, "bytes=5-");
      return new Response(content.subarray(5), {
        status: 206,
        headers: { "content-range": `bytes 5-${content.length - 1}/${content.length}` },
      });
    },
  });
  assert.deepEqual(await fs.readFile(target), content);
});
test("checksum mismatch and oversized response never publish runtime", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "webguide-runtime-test-"));
  const target = path.join(dir, "runtime.zip");
  await assert.rejects(
    downloadVerified(asset, target, {
      log,
      fetcher: async () => new Response(Buffer.alloc(content.length)),
    }),
    /checksum/,
  );
  await assert.rejects(
    downloadVerified(asset, target, {
      log,
      fetcher: async () => new Response(Buffer.alloc(content.length + 1)),
    }),
    /exceeds/,
  );
  await assert.rejects(fs.stat(target), { code: "ENOENT" });
});

function rangeFetcher(bytes, observe = () => {}) {
  return async (url, options) => {
    const [, startText, endText] = /^bytes=(\d+)-(\d+)$/.exec(options.headers.Range);
    const start = Number(startText),
      end = Number(endText);
    observe(start, end);
    return new Response(bytes.subarray(start, end + 1), {
      status: 206,
      headers: { "content-range": `bytes ${start}-${end}/${bytes.length}` },
    });
  };
}
test("parallel ranges preserve existing prefix bytes and verify assembled SHA", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "webguide-parallel-test-"));
  const target = path.join(dir, "runtime.zip");
  await fs.writeFile(target + ".partial", content.subarray(0, 5));
  const requested = [];
  assert.equal(
    await downloadParallel(asset, target, {
      log,
      partSize: 4,
      fetcher: rangeFetcher(content, (start, end) => requested.push([start, end])),
    }),
    true,
  );
  assert.ok(requested.every(([start]) => start >= 5));
  assert.deepEqual(await fs.readFile(target), content);
});
test("range-unsupported fallback leaves previous partial untouched", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "webguide-parallel-test-"));
  const target = path.join(dir, "runtime.zip");
  const prefix = content.subarray(0, 5);
  await fs.writeFile(target + ".partial", prefix);
  assert.equal(
    await downloadParallel(asset, target, {
      log,
      partSize: 4,
      fetcher: async () => new Response(content),
    }),
    false,
  );
  assert.deepEqual(await fs.readFile(target + ".partial"), prefix);
});
test("incorrect ranges fail without publishing or truncating prefix", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "webguide-parallel-test-"));
  const target = path.join(dir, "runtime.zip");
  await fs.writeFile(target + ".partial", content.subarray(0, 5));
  await assert.rejects(
    downloadParallel(asset, target, {
      log,
      partSize: 4,
      fetcher: async () =>
        new Response(content.subarray(5, 9), {
          status: 206,
          headers: { "content-range": "bytes 0-3/99" },
        }),
    }),
    /range response/,
  );
  assert.deepEqual(await fs.readFile(target + ".partial"), content.subarray(0, 5));
  await assert.rejects(fs.stat(target), { code: "ENOENT" });
});
test("cancelled parallel attempt resumes completed chunks and validates final hash", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "webguide-parallel-test-"));
  const target = path.join(dir, "runtime.zip");
  const controller = new AbortController();
  const fetcher = rangeFetcher(content, (start) => {
    if (start >= 4) controller.abort();
  });
  await assert.rejects(
    downloadParallel(asset, target, { log, partSize: 4, signal: controller.signal, fetcher }),
  );
  assert.deepEqual(await fs.readFile(target + ".parts-0/0"), content.subarray(0, 4));
  const requested = [];
  await downloadParallel(asset, target, {
    log,
    partSize: 4,
    fetcher: rangeFetcher(content, (start) => requested.push(start)),
  });
  assert.ok(!requested.includes(0));
  assert.deepEqual(await fs.readFile(target), content);
});
test("parallel final checksum rejects same-sized corrupted content", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "webguide-parallel-test-"));
  const target = path.join(dir, "runtime.zip");
  await assert.rejects(
    downloadParallel(asset, target, {
      log,
      partSize: 4,
      fetcher: rangeFetcher(Buffer.alloc(content.length)),
    }),
    /checksum mismatch/,
  );
  await assert.rejects(fs.stat(target), { code: "ENOENT" });
});

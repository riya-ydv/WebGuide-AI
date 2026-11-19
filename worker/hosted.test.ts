import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { workerConfiguration } from "./config.js";
import { JobStore } from "./store.js";
import { DatabaseSync } from "node:sqlite";
import type { Job } from "./contracts.js";

const token = "a".repeat(64);
test("Chrome extension origins require one explicit valid ID without wildcards or null", () => {
  assert.ok(
    workerConfiguration({ GUIDEFLOW_WORKER_TOKEN: token }).allowedOrigins.has(
      "chrome-extension://nnodbcjnbbdbbdakdhppclfbblcmjejl",
    ),
  );
  assert.throws(() =>
    workerConfiguration({
      GUIDEFLOW_WORKER_TOKEN: token,
      WEBGUIDE_WORKER_MODE: "hosted",
      WEBGUIDE_ALLOWED_HOSTS: "api.example.com",
      WEBGUIDE_DATA_DIR: "/data",
    }),
  );
  const origin = "chrome-extension://nnodbcjnbbdbbdakdhppclfbblcmjejl";
  const env = { GUIDEFLOW_WORKER_TOKEN: token, WEBGUIDE_ALLOWED_ORIGINS: origin };
  assert.ok(workerConfiguration(env).allowedOrigins.has(origin));
  for (const invalid of [
    "chrome-extension://*",
    "chrome-extension://short",
    "chrome-extension://" + "z".repeat(32),
    origin + "/",
    origin + "?token=x",
    "null",
    "moz-extension://" + "a".repeat(32),
  ]) {
    assert.throws(() => workerConfiguration({ ...env, WEBGUIDE_ALLOWED_ORIGINS: invalid }));
  }
});
test("hosted binding requires explicit trusted hosts/origins and persistent directory", () => {
  assert.throws(() =>
    workerConfiguration({ GUIDEFLOW_WORKER_TOKEN: token, WEBGUIDE_WORKER_HOST: "0.0.0.0" }),
  );
  assert.throws(() =>
    workerConfiguration({ GUIDEFLOW_WORKER_TOKEN: token, WEBGUIDE_WORKER_MODE: "hosted" }),
  );
  const env = {
    GUIDEFLOW_WORKER_TOKEN: token,
    WEBGUIDE_WORKER_MODE: "hosted",
    WEBGUIDE_ALLOWED_HOSTS: "api.example.com",
    WEBGUIDE_ALLOWED_ORIGINS: "https://webguide.example.com",
    WEBGUIDE_DATA_DIR: "/data",
  };
  const parsed = workerConfiguration(env);
  assert.equal(parsed.host, "0.0.0.0");
  assert.equal(parsed.port, 8080);
  assert.throws(() =>
    workerConfiguration({ ...env, WEBGUIDE_ALLOWED_ORIGINS: "https://evil.example/path" }),
  );
  assert.throws(() => workerConfiguration({ ...env, WEBGUIDE_ALLOWED_HOSTS: "*" }));
  assert.throws(() =>
    workerConfiguration({ ...env, WEBGUIDE_ALLOWED_ORIGINS: "http://public.example" }),
  );
  assert.throws(() => workerConfiguration({ ...env, PORT: "1.2" }));
  assert.throws(() =>
    workerConfiguration({
      ...env,
      GUIDEFLOW_WORKER_TOKEN: "replace-this-token-with-real-randomness",
    }),
  );
});
test("SQLite evidence recovers, expires, rejects corruption and durably deletes sessions", () => {
  const dir = mkdtempSync(join(tmpdir(), "webguide-store-"));
  const store = new JobStore(dir);
  try {
    const make = (): Job => ({
      id: randomUUID(),
      url: "https://example.com/",
      mode: "read-only",
      planner: "ai",
      status: "queued",
      startedAt: new Date().toISOString(),
      events: [],
      observations: [],
      traces: [],
      tutorials: [],
    });
    const active = make();
    const expired = {
      ...make(),
      status: "completed" as const,
      completedAt: new Date(Date.now() - 120000).toISOString(),
    };
    store.save(
      new Map([
        [active.id, active],
        [expired.id, expired],
      ]),
    );
    assert.equal(
      readFileSync(join(dir, "webguide.sqlite")).subarray(0, 15).toString(),
      "SQLite format 3",
    );
    const loaded = store.load(60000);
    assert.equal(loaded.size, 1);
    assert.equal(loaded.get(active.id)?.status, "cancelled");
    assert.match(loaded.get(active.id)?.error || "", /restarted/);
    const db = new DatabaseSync(join(dir, "webguide.sqlite"));
    const bad = JSON.parse(
      String(
        db.prepare("SELECT payload_json FROM task_sessions WHERE id=?").get(active.id)!
          .payload_json,
      ),
    );
    bad.unexpected = "not trusted";
    db.prepare("UPDATE task_sessions SET payload_json=? WHERE id=?").run(
      JSON.stringify(bad),
      active.id,
    );
    db.close();
    assert.throws(() => store.load(60000));
    store.save(new Map());
    assert.equal(store.load(60000).size, 0);
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("legacy JSON imports transactionally once and deletion cannot resurrect the unchanged recovery copy", () => {
  const dir = mkdtempSync(join(tmpdir(), "webguide-store-import-"));
  const job: Job = {
    id: randomUUID(),
    url: "https://example.com/",
    mode: "read-only",
    planner: "ai",
    status: "completed",
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    events: ["Robert'); DROP TABLE task_sessions;--"],
    observations: [],
    traces: [],
    tutorials: [],
  };
  const original = JSON.stringify({ schemaVersion: 1, jobs: [job] });
  writeFileSync(join(dir, "jobs.json"), original);
  let store: JobStore | undefined;
  try {
    store = new JobStore(dir);
    assert.deepEqual(store.load(60000).get(job.id), job);
    assert.equal(readFileSync(join(dir, "jobs.json"), "utf8"), original);
    store.close();
    store = new JobStore(dir);
    assert.deepEqual(store.load(60000).get(job.id), job);
    store.save(new Map());
    store.close();
    store = new JobStore(dir);
    assert.equal(store.load(60000).size, 0);
    assert.equal(readFileSync(join(dir, "jobs.json"), "utf8"), original);
  } finally {
    store?.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("invalid legacy import leaves the original untouched and no partial session rows", () => {
  const dir = mkdtempSync(join(tmpdir(), "webguide-store-invalid-"));
  try {
    const legacy = join(dir, "jobs.json");
    writeFileSync(legacy, '{"schemaVersion":1,"jobs":[{"id":"bad"}]}');
    assert.throws(() => new JobStore(dir));
    const db = new DatabaseSync(join(dir, "webguide.sqlite"));
    assert.equal(Number(db.prepare("SELECT count(*) AS count FROM task_sessions").get()!.count), 0);
    assert.equal(
      Number(db.prepare("SELECT count(*) AS count FROM store_metadata").get()!.count),
      0,
    );
    db.close();
    assert.match(readFileSync(legacy, "utf8"), /bad/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

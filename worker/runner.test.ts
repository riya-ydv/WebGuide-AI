import { test } from "node:test";
import assert from "node:assert/strict";
import { run } from "./runner.js";
import type { Job } from "./contracts.js";

test("a cancelled queued job never opens a browser or observes the destination", async () => {
  const controller = new AbortController();
  controller.abort();
  const job: Job = {
    id: "cancel-before-launch",
    url: "https://example.com/",
    mode: "read-only",
    planner: "deterministic",
    status: "queued",
    startedAt: new Date().toISOString(),
    events: [],
    observations: [],
    traces: [],
    tutorials: [],
  };
  let saved = false;
  await run(job, controller, undefined, () => {
    saved = true;
  });
  assert.equal(job.status, "cancelled");
  assert.equal(saved, true);
  assert.ok(!job.events.includes("Isolated browser started"));
  assert.deepEqual(job.observations, []);
  assert.deepEqual(job.traces, []);
});

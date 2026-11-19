import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { Job } from "./contracts.js";
import { pinnedGet } from "./network.js";

// Reserve an available loopback port for each owned test service.
async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No test port allocated");
  const port = address.port;
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  return port;
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
test(
  "real isolated Chromium explores cross-origin fixture; auth, missing AI, cancellation and deletion enforced",
  { timeout: 60000 },
  async () => {
    const workerPort = await freePort();
    const fixturePort = 4319;
    const reuseFixture = process.env.WEBGUIDE_TEST_REUSE_FIXTURE === "1";
    if (reuseFixture) {
      const response = await fetch(`http://127.0.0.1:${fixturePort}`);
      assert.ok(response.ok && (await response.text()).includes("<title>WebGuide AI controlled Task Lab</title>"), "Existing fixture must be the controlled Task Lab");
    }
    const directory = mkdtempSync(join(tmpdir(), "webguide-integration-"));
    const token = randomBytes(32).toString("hex");
    const env = {
      ...process.env,
      WEBGUIDE_WORKER_TOKEN: token,
      WEBGUIDE_WORKER_MODE: "local",
      WEBGUIDE_WORKER_HOST: "127.0.0.1",
      PORT: String(workerPort),
      WEBGUIDE_FIXTURE_PORT: String(fixturePort),
      WEBGUIDE_ALLOWED_HOSTS: `127.0.0.1:${workerPort}`,
      WEBGUIDE_ALLOWED_ORIGINS: "http://127.0.0.1:4320",
      WEBGUIDE_DATA_DIR: directory,
      WEBGUIDE_AI_PROVIDER: "openai-compatible",
      WEBGUIDE_SANDBOX_ORIGIN: `http://127.0.0.1:${fixturePort}`,
          WEBGUIDE_AI_BASE_URL: "",
          WEBGUIDE_AI_MODEL: "",
    };
    const fixture = reuseFixture ? undefined : spawn(process.execPath, ["--import", "tsx", "worker/fixture.ts"], {
      env,
      stdio: "pipe",
      windowsHide: true,
    });
    const worker = spawn(process.execPath, ["--import", "tsx", "worker/server.ts"], {
      env,
      stdio: "pipe",
      windowsHide: true,
    });
    let errors = "";
    fixture?.stderr.on("data", (data) => (errors += String(data)));
    worker.stderr.on("data", (data) => (errors += String(data)));
    const api = (path: string, method = "GET", payload?: unknown) =>
      fetch(`http://127.0.0.1:${workerPort}${path}`, {
        method,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        ...(payload ? { body: JSON.stringify(payload) } : {}),
      });
    try {
      let ready = false;
      for (let index = 0; index < 50; index++) {
        try {
          if (
            worker.exitCode === null &&
            (!fixture || fixture.exitCode === null) &&
            (await fetch(`http://127.0.0.1:${workerPort}/health`)).ok &&
            (await fetch(`http://127.0.0.1:${fixturePort}`)).ok
          ) {
            ready = true;
            break;
          }
        } catch {
          /* Wait for the owned test services to start. */
        }
        await pause(100);
      }
      assert.ok(ready, `Worker/fixture failed to start: ${errors}`);
      assert.equal((await fetch(`http://127.0.0.1:${workerPort}/jobs`)).status, 401);
      assert.equal(
        (await fetch(`http://127.0.0.1:${workerPort}/jobs`, { headers: { Authorization: "Bearer wrong" } }))
          .status,
        401,
      );
      assert.equal(
        (
          await fetch(`http://127.0.0.1:${workerPort}/health`, {
            headers: { Origin: "https://evil.example" },
          })
        ).status,
        403,
      );
      assert.equal(
        (
          await api("/jobs", "POST", {
            url: `http://127.0.0.1:${fixturePort}`,
            mode: "sandbox",
            planner: "ai",
          })
        ).status,
        503,
      );
      const start = await api("/jobs", "POST", {
        url: `http://127.0.0.1:${fixturePort}`,
        mode: "sandbox",
        planner: "deterministic",
      });
      assert.equal(start.status, 202);
      let job = (await start.json()) as Job;
      for (let index = 0; index < 150 && ["queued", "running"].includes(job.status); index++) {
        await pause(100);
        job = (await (await api(`/jobs/${job.id}`)).json()) as Job;
      }
      assert.equal(job.status, "completed", JSON.stringify(job));
      assert.ok(job.observations.length >= 2);
      assert.ok(
        job.traces.some((trace) => trace.label === "Create task" && trace.status === "verified"),
      );
      assert.ok(
        job.tutorials[0]?.steps.some((step) => step.expectedResult.includes("Task created")),
      );
      const answer = (await (
        await api(`/jobs/${job.id}/ask`, "POST", { question: "How do I pay an invoice?" })
      ).json()) as { citations: unknown[] };
      assert.equal(answer.citations.length, 0);
      let secondStart = await api("/jobs", "POST", {
        url: `http://127.0.0.1:${fixturePort}`,
        mode: "sandbox",
        planner: "deterministic",
      });
      for (let index = 0; index < 60 && secondStart.status === 429; index++) {
        await pause(500);
        secondStart = await api("/jobs", "POST", {
          url: `http://127.0.0.1:${fixturePort}`,
          mode: "sandbox",
          planner: "deterministic",
        });
      }
      assert.equal(secondStart.status, 202);
      const second = (await secondStart.json()) as Job;
      await api(`/jobs/${second.id}/cancel`, "POST", {});
      let cancelled = (await (await api(`/jobs/${second.id}`)).json()) as Job;
      for (let index = 0; index < 50 && cancelled.status !== "cancelled"; index++) {
        await pause(100);
        cancelled = (await (await api(`/jobs/${second.id}`)).json()) as Job;
      }
      assert.equal(cancelled.status, "cancelled");
      const count = cancelled.traces.length;
      await pause(300);
      assert.equal(((await (await api(`/jobs/${second.id}`)).json()) as Job).traces.length, count);
      assert.equal((await api(`/jobs/${job.id}`, "DELETE")).status, 200);
      assert.equal((await api(`/jobs/${job.id}`)).status, 404);
      await assert.rejects(
        pinnedGet(
          `http://127.0.0.1:${fixturePort}`,
          `http://127.0.0.1:${fixturePort}`,
          undefined,
          new AbortController().signal,
        ),
      );
    } finally {
      fixture?.kill();
      worker.kill();
      await Promise.all(
        [fixture, worker].map((child) =>
          !child || child.exitCode !== null
            ? Promise.resolve()
            : new Promise((resolve) => child.once("exit", resolve)),
        ),
      );
      rmSync(directory, { recursive: true, force: true });
    }
  },
);

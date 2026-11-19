import { request as httpRequest } from "node:http";
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID, randomBytes } from "node:crypto";
import { JobStore } from "./store.js";
import type { Job } from "./contracts.js";
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
async function stop(child: ChildProcess | undefined) {
  if (!child || child.exitCode !== null) return;
  const ended = new Promise<void>((resolve) => child.once("exit", () => resolve()));
  child.kill();
  await Promise.race([ended, wait(3000)]);
  if (child.exitCode === null) {
    child.kill("SIGKILL");
    await ended;
  }
}
test(
  "real HTTP SQLite restart, deletion, exact auth, CORS and private destination rejection",
  { timeout: 30000 },
  async () => {
    const directory = mkdtempSync(join(tmpdir(), "webguide-sqlite-http-"));
    const token = randomBytes(32).toString("hex");
    const port = 4396;
    const base = `http://127.0.0.1:${port}`;
    const job: Job = {
      id: randomUUID(),
      url: "https://example.com/",
      mode: "read-only",
      planner: "ai",
      status: "completed",
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      events: ["Observed page"],
      observations: [],
      traces: [],
      tutorials: [],
    };
    const seed = new JobStore(directory);
    seed.save(new Map([[job.id, job]]));
    seed.close();
    let child: ChildProcess | undefined;
    let errors = "";
    const api = (
      route: string,
      method = "GET",
      body?: unknown,
      headers: Record<string, string> = {},
    ) =>
      fetch(base + route, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          ...headers,
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    async function start() {
      child = spawn(process.execPath, ["--import", "tsx", "worker/server.ts"], {
        cwd: process.cwd(),
        env: {
          ...process.env,
          PORT: String(port),
          WEBGUIDE_WORKER_MODE: "local",
          WEBGUIDE_WORKER_HOST: "127.0.0.1",
          WEBGUIDE_WORKER_TOKEN: token,
          WEBGUIDE_ALLOWED_HOSTS: `127.0.0.1:${port}`,
          WEBGUIDE_ALLOWED_ORIGINS: "http://127.0.0.1:4320",
          WEBGUIDE_DATA_DIR: directory,
          GUIDEFLOW_AI_PROVIDER: "openai-compatible",
          GUIDEFLOW_SANDBOX_ORIGIN: "",
          WEBGUIDE_AI_BASE_URL: "",
          WEBGUIDE_AI_MODEL: "",
        },
        stdio: "pipe",
        windowsHide: true,
      });
      child.stderr?.on("data", (data) => {
        errors = (errors + String(data)).slice(-2000);
      });
      for (let i = 0; i < 80; i++) {
        try {
          if ((await api("/jobs")).ok) return;
        } catch {
          /* Process may already have exited. */
        }
        if (child.exitCode !== null) throw Error(errors);
        await wait(100);
      }
      throw Error("Isolated SQLite worker did not start: " + errors);
    }
    try {
      await start();
      assert.equal((await api("/health").then((r) => r.json())).persistenceEngine, "sqlite");
      assert.deepEqual(await api(`/jobs/${job.id}`).then((r) => r.json()), job);
      assert.equal(
        (await api("/jobs", "GET", undefined, { Authorization: token })).status,
        401,
        "raw token is not Bearer authentication",
      );
      assert.equal(
        (await api("/jobs", "GET", undefined, { Origin: "https://attacker.example" })).status,
        403,
      );
      const deniedHost = await new Promise<number>((resolve, reject) => {
        const request = httpRequest(
          base + "/jobs",
          { headers: { Host: "attacker.example", Authorization: `Bearer ${token}` } },
          (response) => {
            response.resume();
            resolve(response.statusCode!);
          },
        );
        request.on("error", reject);
        request.end();
      });
      assert.equal(deniedHost, 403);
      assert.equal(
        (
          await api("/jobs", "POST", {
            url: "http://127.0.0.1:80",
            mode: "sandbox",
            planner: "deterministic",
          })
        ).status,
        403,
      );
      await stop(child);
      await start();
      assert.deepEqual(
        await api(`/jobs/${job.id}`).then((r) => r.json()),
        job,
        "survives a process restart",
      );
      assert.equal((await api(`/jobs/${job.id}`, "DELETE")).status, 200);
      await stop(child);
      await start();
      assert.equal(
        (await api(`/jobs/${job.id}`)).status,
        404,
        "deletion survives a second restart",
      );
      assert.deepEqual(await api("/jobs").then((r) => r.json()), []);
      assert.equal(
        readFileSync(join(directory, "webguide.sqlite")).subarray(0, 15).toString(),
        "SQLite format 3",
      );
    } finally {
      await stop(child);
      rmSync(directory, { recursive: true, force: true });
    }
  },
);

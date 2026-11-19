import { test } from "node:test";
import { request as httpRequest } from "node:http";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { JobStore } from "./store.js";
import type { Job } from "./contracts.js";
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const port = 4398;
const base = `http://127.0.0.1:${port}`;
async function stop(child: ChildProcess | undefined) {
  if (!child || child.exitCode !== null) return;
  child.kill();
  await Promise.race([
    new Promise<void>((resolve) => child.once("exit", () => resolve())),
    pause(3000),
  ]);
  if (child.exitCode === null) child.kill("SIGKILL");
}
test(
  "hosted HTTP auth/CORS/host/pagination/rate policy plus real browser persistence and restart",
  { timeout: 90000 },
  async () => {
    const directory = mkdtempSync(join(tmpdir(), "webguide-hosted-"));
    const token = randomBytes(32).toString("hex");
    const env = {
      ...process.env,
      WEBGUIDE_WORKER_MODE: "hosted",
      WEBGUIDE_WORKER_HOST: "127.0.0.1",
      PORT: String(port),
      GUIDEFLOW_WORKER_TOKEN: token,
      WEBGUIDE_ALLOWED_HOSTS: `api.webguide.test,127.0.0.1:${port}`,
      WEBGUIDE_ALLOWED_ORIGINS:
        "https://webguide.test,chrome-extension://nnodbcjnbbdbbdakdhppclfbblcmjejl",
      WEBGUIDE_DATA_DIR: directory,
      GUIDEFLOW_SANDBOX_ORIGIN: "http://127.0.0.1:4319",
      GUIDEFLOW_AI_PROVIDER: "openai-compatible",
      GUIDEFLOW_AI_MODEL: "contract-only",
      GUIDEFLOW_AI_BASE_URL: "http://127.0.0.1:4399/v1",
      GUIDEFLOW_AI_API_KEY: "",
    };
    const seeded: Job[] = [0, 1, 2].map(() => ({
      id: randomUUID(),
      url: "https://example.com/",
      mode: "read-only",
      planner: "ai",
      status: "completed",
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      events: [],
      observations: [],
      traces: [],
      tutorials: [],
    }));
    const seedStore = new JobStore(directory);
    seedStore.save(new Map(seeded.map((job) => [job.id, job])));
    seedStore.close();
    let worker: ChildProcess | undefined;
    let fixture: ChildProcess | undefined;
    let errors = "";
    const start = () => {
      worker = spawn(process.execPath, ["--import", "tsx", "worker/server.ts"], {
        env,
        stdio: "pipe",
        windowsHide: true,
      });
      worker.stderr?.on("data", (data) => {
        errors += String(data);
      });
    };
    const ready = async () => {
      for (let i = 0; i < 80; i++) {
        try {
          if ((await fetch(base + "/health")).ok) return;
        } catch {
          /* Process may already have exited. */
        }
        await pause(100);
      }
      throw Error("Hosted worker not ready: " + errors);
    };
    const api = (
      path: string,
      method = "GET",
      payload?: unknown,
      headers: Record<string, string> = {},
    ) =>
      new Promise<Response>((resolve, reject) => {
        const request = httpRequest(
          base + path,
          {
            method,
            headers: {
              Authorization: `Bearer ${token}`,
              Origin: "https://webguide.test",
              "Content-Type": "application/json",
              ...headers,
            },
          },
          (response) => {
            const chunks: Buffer[] = [];
            response.on("data", (chunk) => chunks.push(chunk));
            response.on("error", reject);
            response.on("end", () => {
              const responseHeaders = new Headers();
              for (const [name, value] of Object.entries(response.headers)) {
                if (value !== undefined)
                  responseHeaders.set(name, Array.isArray(value) ? value.join(",") : value);
              }
              resolve(
                new Response(
                  response.statusCode === 204 ? null : Buffer.concat(chunks).toString(),
                  { status: response.statusCode || 500, headers: responseHeaders },
                ),
              );
            });
          },
        );
        request.on("error", reject);
        if (payload) request.write(JSON.stringify(payload));
        request.end();
      });
    try {
      start();
      await ready();
      const health = (await (await fetch(base + "/health")).json()) as Record<string, unknown>;
      assert.equal(health.authenticationRequired, true);
      assert.equal(health.aiModel, undefined);
      assert.equal((await fetch(base + "/jobs")).status, 401);
      const extensionOrigin = "chrome-extension://nnodbcjnbbdbbdakdhppclfbblcmjejl";
      const guidance = {
        goal: "Explain this page",
        language: "en",
        mode: "explain",
        context: {
          url: "https://example.com",
          title: "",
          revision: "empty",
          text: "",
          controls: [],
          headings: [],
        },
      };
      const extension = await api("/guidance", "POST", guidance, { Origin: extensionOrigin });
      assert.equal(extension.status, 200);
      assert.equal(extension.headers.get("access-control-allow-origin"), extensionOrigin);
      assert.equal(((await extension.json()) as { status: string }).status, "insufficient-context");
      assert.equal(
        (await api("/guidance", "POST", guidance, { Origin: extensionOrigin, Authorization: "" }))
          .status,
        401,
      );
      assert.equal(
        (
          await api("/guidance", "POST", guidance, {
            Origin: "chrome-extension://" + "b".repeat(32),
          })
        ).status,
        403,
      );
      assert.equal((await api("/guidance", "POST", guidance, { Origin: "null" })).status, 403);
      assert.equal(
        (await api("/jobs", "GET", undefined, { Authorization: "Bearer wrong" })).status,
        401,
      );
      assert.equal(
        (await api("/jobs", "GET", undefined, { Origin: "https://evil.test" })).status,
        403,
      );
      assert.equal(
        (
          await api("/jobs", "GET", undefined, {
            Host: "evil.test",
            "X-Forwarded-Host": "api.webguide.test",
          })
        ).status,
        403,
      );
      const custom = await api("/jobs?limit=2&offset=0", "GET", undefined, {
        Host: "api.webguide.test",
      });
      assert.equal(custom.status, 200);
      assert.equal(custom.headers.get("access-control-allow-origin"), "https://webguide.test");
      assert.equal(custom.headers.get("x-total-count"), "3");
      assert.equal(custom.headers.get("x-next-offset"), "2");
      assert.equal(((await custom.json()) as Job[]).length, 2);
      assert.equal((await api("/jobs?limit=0")).status, 400);
      assert.equal((await api("/jobs?offset=-1")).status, 400);
      assert.equal((await api("/jobs?limit=2&offset=2")).headers.get("x-next-offset"), null);
      assert.equal((await api("/jobs", "OPTIONS")).status, 204);
      assert.equal(
        (await api("/jobs", "POST", { url: "http://169.254.169.254/", planner: "ai" })).status,
        400,
      );
      let fixtureAvailable = false;
      try {
        fixtureAvailable = (await fetch("http://127.0.0.1:4319")).ok;
      } catch {
        /* Process may already have exited. */
      }
      if (!fixtureAvailable) {
        fixture = spawn(process.execPath, ["--import", "tsx", "worker/fixture.ts"], {
          stdio: "pipe",
          windowsHide: true,
        });
        for (let i = 0; i < 50; i++) {
          try {
            if ((await fetch("http://127.0.0.1:4319")).ok) break;
          } catch {
            /* Process may already have exited. */
          }
          await pause(100);
        }
      }
      const created = await api("/jobs", "POST", {
        url: "http://127.0.0.1:4319",
        mode: "sandbox",
        planner: "deterministic",
      });
      assert.equal(created.status, 202);
      let job = (await created.json()) as Job;
      for (let i = 0; i < 100 && ["queued", "running"].includes(job.status); i++) {
        await pause(200);
        job = (await (await api(`/jobs/${job.id}`)).json()) as Job;
      }
      assert.equal(job.status, "completed", JSON.stringify(job));
      assert.ok(job.tutorials[0]?.steps.length);
      await stop(worker);
      start();
      await ready();
      const restored = (await (await api(`/jobs/${job.id}`)).json()) as Job;
      assert.equal(restored.status, "completed");
      assert.deepEqual(restored.tutorials, job.tutorials);
      assert.equal((await api(`/jobs/${job.id}`, "DELETE")).status, 200);
      await stop(worker);
      start();
      await ready();
      assert.equal((await api(`/jobs/${job.id}`)).status, 404);
      let limited = false;
      for (let i = 0; i < 182; i++) {
        if ((await api("/jobs")).status === 429) {
          limited = true;
          break;
        }
      }
      assert.ok(limited, "Authenticated rate cap must apply");
    } finally {
      await stop(worker);
      await stop(fixture);
      rmSync(directory, { recursive: true, force: true });
    }
  },
);

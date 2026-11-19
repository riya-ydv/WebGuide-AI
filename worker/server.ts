import http from "node:http";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { existsSync } from "node:fs";
import { chromium } from "playwright";
import { z } from "zod";
import { JobRequest, type Job } from "./contracts.js";
import { destination, cleanUrl } from "./network.js";
import { run } from "./runner.js";
import { answer } from "./tutorials.js";
import { Provider } from "./planner.js";
import { providerConfiguration, providerReadiness } from "./provider.js";
import { answerWithAI } from "./answers.js";
import { workerConfiguration } from "./config.js";
import { JobStore } from "./store.js";
import { GuidanceRequest, pageGuidance } from "./guidance.js";

const config = workerConfiguration();
const { token, sandboxOrigin, allowedOrigins, retention } = config;
const store = new JobStore(config.dataDir);
const jobs = store.load(retention);
store.save(jobs);
let persistenceHealthy = true;
const persist = () => {
  try {
    store.save(jobs);
    persistenceHealthy = true;
    return true;
  } catch {
    persistenceHealthy = false;
    console.error("Evidence persistence failed; new jobs disabled until storage recovers");
    return false;
  }
};
const controllers = new Map<string, AbortController>();
const answerControllers = new Map<string, AbortController>();
const modelControllers = new Set<AbortController>();
let rejectedWindowStart = Date.now();
let rejectedCount = 0;
let windowStart = Date.now();
let requestCount = 0;
let aiVerifiedAt: string | null = null;
let aiRequestActive = false;
let healthWindowStart = Date.now();
let healthRequestCount = 0;
let readinessCache: Awaited<ReturnType<typeof providerReadiness>> | undefined;
let readinessCachedAt = 0;
let readinessPending: ReturnType<typeof providerReadiness> | undefined;

function cachedReadiness() {
  if (readinessCache && Date.now() - readinessCachedAt < 5000)
    return Promise.resolve(readinessCache);
  if (!readinessPending) {
    readinessPending = providerReadiness()
      .then((value) => {
        readinessCache = value;
        readinessCachedAt = Date.now();
        return value;
      })
      .finally(() => {
        readinessPending = undefined;
      });
  }
  return readinessPending;
}

function modelRequest(response: http.ServerResponse) {
  const controller = new AbortController();
  const disconnected = () => {
    if (!response.writableEnded) controller.abort();
  };
  response.on("close", disconnected);
  modelControllers.add(controller);
  if (response.destroyed) controller.abort();
  return {
    controller,
    signal: AbortSignal.any([controller.signal, AbortSignal.timeout(65000)]),
    dispose() {
      response.off("close", disconnected);
      modelControllers.delete(controller);
    },
  };
}

async function body(request: http.IncomingMessage, limit = 8192): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const bytes = Buffer.from(chunk);
    size += bytes.length;
    if (size > limit) throw new Error("Request too large");
    chunks.push(bytes);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}
const server = http.createServer(async (request, response) => {
  response.setHeader("Content-Type", "application/json");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
  const send = (status: number, value: unknown) => {
    if (response.destroyed || response.writableEnded) return;
    response.writeHead(status);
    response.end(JSON.stringify(value));
  };
  try {
    if (!config.allowedHosts.has((request.headers.host || "").toLowerCase())) {
      send(403, { error: "Host denied" });
      return;
    }
    const origin = request.headers.origin;
    if (origin && !allowedOrigins.has(origin)) {
      send(403, { error: "Origin denied" });
      return;
    }
    if (origin) {
      response.setHeader("Access-Control-Allow-Origin", origin);
      response.setHeader("Vary", "Origin");
      response.setHeader("Access-Control-Expose-Headers", "X-Total-Count,X-Next-Offset");
    }
    if (request.method === "OPTIONS") {
      response.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE");
      response.setHeader("Access-Control-Allow-Headers", "Authorization,Content-Type");
      send(204, null);
      return;
    }
    const requestUrl = new URL(request.url || "/", "http://worker.invalid");
    const path = requestUrl.pathname;
    const authorization = request.headers.authorization || "";
    const provided = Buffer.from(authorization.startsWith("Bearer ") ? authorization.slice(7) : "");
    const expected = Buffer.from(token);
    const authenticated =
      provided.length === expected.length && timingSafeEqual(provided, expected);
    if (path === "/health" && request.method === "GET") {
      if (Date.now() - healthWindowStart > 60000) {
        healthWindowStart = Date.now();
        healthRequestCount = 0;
      }
      if (++healthRequestCount > 120) {
        send(429, { error: "Health request limit reached" });
        return;
      }
      if (config.hosted && !authenticated) {
        send(persistenceHealthy ? 200 : 503, {
          workerConnected: true,
          mode: "hosted-single-owner",
          authenticationRequired: true,
        });
        return;
      }
      const ai = await cachedReadiness();
      send(200, {
        workerConnected: true,
        aiConfigured: ai.configured,
        aiProvider: ai.provider,
        aiModel: ai.model,
        aiReachable: ai.reachable,
        aiModelAvailable: ai.modelAvailable,
        aiDetail: ai.detail,
        aiVerifiedAt,
        browserReady: existsSync(chromium.executablePath()),
        mode: config.hosted ? "hosted-single-owner" : "local-single-user",
        persistentEvidence: store.persistent,
        persistenceEngine: "sqlite",
        persistenceHealthy,
      });
      return;
    }
    if (!authenticated) {
      if (Date.now() - rejectedWindowStart > 60000) {
        rejectedWindowStart = Date.now();
        rejectedCount = 0;
      }
      send(++rejectedCount > 120 ? 429 : 401, { error: "Worker authentication required" });
      return;
    }
    if (Date.now() - windowStart > 60000) {
      windowStart = Date.now();
      requestCount = 0;
    }
    if (++requestCount > 180) {
      send(429, { error: "Request limit reached" });
      return;
    }
    if (request.method === "GET" && path.startsWith("/jobs") && !persistenceHealthy && !persist()) {
      send(503, { error: "Evidence storage unavailable. Retry after operator repair." });
      return;
    }
    if (path === "/guidance" && request.method === "POST") {
      const input = GuidanceRequest.parse(await body(request, 65536));
      if (aiRequestActive || controllers.size) {
        send(429, { error: "Wait for the active AI request or exploration to finish" });
        return;
      }
      aiRequestActive = true;
      const inference = modelRequest(response);
      try {
        const result = await pageGuidance(input, new Provider(inference.signal));
        inference.signal.throwIfAborted();
        send(200, result);
      } catch {
        send(inference.controller.signal.aborted ? 409 : 503, {
          error:
            "Page guidance unavailable. No action was performed; try again or use the page controls directly.",
        });
      } finally {
        inference.dispose();
        aiRequestActive = false;
      }
      return;
    }
    if (path === "/ai/verify" && request.method === "POST") {
      if (aiRequestActive || controllers.size) {
        send(429, { error: "Wait for the active AI request or exploration to finish" });
        return;
      }
      aiRequestActive = true;
      const inference = modelRequest(response);
      try {
        const schema = z.object({ ready: z.literal(true) }).strict();
        const provider = new Provider(inference.signal);
        schema.parse(
          await provider.json(
            'Return exactly {"ready":true}. This is an inference connectivity check.',
            {},
            z.toJSONSchema(schema),
          ),
        );
        inference.signal.throwIfAborted();
        aiVerifiedAt = new Date().toISOString();
        send(200, { ...providerConfiguration(), verifiedAt: aiVerifiedAt });
      } catch {
        send(503, {
          error:
            "AI inference failed. Check the configured model server and worker logs; no successful inference was recorded.",
        });
      } finally {
        inference.dispose();
        aiRequestActive = false;
      }
      return;
    }
    if (path === "/jobs" && request.method === "GET") {
      const limit = Number(requestUrl.searchParams.get("limit") || "20");
      const offset = Number(requestUrl.searchParams.get("offset") || "0");
      if (
        !Number.isInteger(limit) ||
        limit < 1 ||
        limit > 50 ||
        !Number.isInteger(offset) ||
        offset < 0 ||
        offset > 50
      ) {
        send(400, { error: "Pagination requires limit 1-50 and offset 0-50" });
        return;
      }
      const retained = [...jobs.values()].reverse();
      response.setHeader("X-Total-Count", retained.length);
      if (offset + limit < retained.length) response.setHeader("X-Next-Offset", offset + limit);
      send(200, retained.slice(offset, offset + limit));
      return;
    }
    if (path === "/jobs" && request.method === "POST") {
      if (!persistenceHealthy && !persist()) {
        send(503, { error: "Evidence storage unavailable. Retry after operator repair." });
        return;
      }
      const input = JobRequest.parse(await body(request));
      if (
        input.mode === "sandbox" &&
        (!sandboxOrigin || new URL(input.url).origin !== sandboxOrigin)
      ) {
        send(403, {
          error: "Sandbox destination is not explicitly authorised by the worker operator",
        });
        return;
      }
      if (input.planner === "deterministic" && input.mode !== "sandbox") {
        send(400, { error: "Deterministic planner is only for controlled fixture verification" });
        return;
      }
      if (input.planner === "ai" && !providerConfiguration().configured) {
        send(503, {
          error:
            "AI not configured: set WEBGUIDE_AI_PROVIDER, WEBGUIDE_AI_BASE_URL and WEBGUIDE_AI_MODEL in the worker .env.",
        });
        return;
      }
      if (controllers.size >= 1 || jobs.size >= 50 || aiRequestActive) {
        send(429, { error: "Worker capacity reached; wait or delete old jobs" });
        return;
      }
      await destination(input.url, new URL(input.url).origin, sandboxOrigin);
      if (controllers.size >= 1 || jobs.size >= 50 || aiRequestActive) {
        send(429, { error: "Worker capacity reached" });
        return;
      }
      const job: Job = {
        id: randomUUID(),
        url: cleanUrl(input.url),
        mode: input.mode,
        planner: input.planner,
        status: "queued",
        startedAt: new Date().toISOString(),
        events: [],
        observations: [],
        traces: [],
        tutorials: [],
      };
      const controller = new AbortController();
      jobs.set(job.id, job);
      if (!persist()) {
        jobs.delete(job.id);
        send(503, { error: "Evidence could not be saved; exploration was not started" });
        return;
      }
      controllers.set(job.id, controller);
      void run(job, controller, sandboxOrigin, persist)
        .catch(() => {
          job.status = "failed";
          job.error =
            "Browser worker could not start. Install Chromium with npm exec playwright install chromium.";
          job.completedAt = new Date().toISOString();
        })
        .finally(() => {
          controllers.delete(job.id);
          persist();
        });
      send(202, job);
      return;
    }
    const match = /^\/jobs\/([a-f0-9-]{36})(?:\/(cancel|ask))?$/.exec(path);
    if (!match) {
      send(404, { error: "Not found" });
      return;
    }
    const job = jobs.get(match[1]!);
    if (!job) {
      send(404, { error: "Job not found" });
      return;
    }
    if (!match[2] && request.method === "GET") {
      send(200, job);
      return;
    }
    if (match[2] === "cancel" && request.method === "POST") {
      controllers.get(job.id)?.abort();
      answerControllers.get(job.id)?.abort();
      send(200, {
        status:
          controllers.has(job.id) || answerControllers.has(job.id) ? "cancelling" : job.status,
      });
      return;
    }
    if (!match[2] && request.method === "DELETE") {
      controllers.get(job.id)?.abort();
      answerControllers.get(job.id)?.abort();
      jobs.delete(job.id);
      if (!persist()) {
        jobs.set(job.id, job);
        send(503, {
          error: "Evidence deletion could not be persisted. Retry after operator repair.",
        });
        return;
      }
      send(200, { deleted: true });
      return;
    }
    if (match[2] === "ask" && request.method === "POST") {
      const input = z
        .object({ question: z.string().min(3).max(500) })
        .strict()
        .parse(await body(request));
      if (!jobs.has(job.id)) {
        send(404, { error: "Job not found" });
        return;
      }
      if (job.planner !== "ai") {
        send(200, answer(job, input.question));
        return;
      }
      if (aiRequestActive || controllers.size) {
        send(429, { error: "Wait for the active AI request or exploration to finish" });
        return;
      }
      aiRequestActive = true;
      const inference = modelRequest(response);
      answerControllers.set(job.id, inference.controller);
      try {
        const result = await answerWithAI(job, input.question, new Provider(inference.signal));
        inference.signal.throwIfAborted();
        if (!jobs.has(job.id)) {
          send(404, { error: "Job not found" });
          return;
        }
        send(200, result);
      } catch {
        if (!jobs.has(job.id)) send(404, { error: "Job not found" });
        else if (inference.controller.signal.aborted) send(409, { error: "AI answer cancelled" });
        else
          send(503, {
            error: "AI answer unavailable. The recorded tutorial evidence remains available.",
          });
      } finally {
        answerControllers.delete(job.id);
        inference.dispose();
        aiRequestActive = false;
      }
      return;
    }
    send(405, { error: "Method not allowed" });
  } catch {
    send(400, { error: "Invalid request or destination blocked by network policy" });
  }
});
server.requestTimeout = 10000;
server.headersTimeout = 10000;
server.keepAliveTimeout = 5000;
server.maxHeadersCount = 40;
server.listen(config.port, config.host, () =>
  console.log(
    `WebGuide worker listening on ${config.host}:${config.port} (${config.hosted ? "hosted single-owner" : "local single-user"})`,
  ),
);
const cleanup = setInterval(() => {
  let changed = false;
  for (const [id, job] of jobs)
    if (job.completedAt && Date.now() - Date.parse(job.completedAt) > retention) {
      answerControllers.get(id)?.abort();
      jobs.delete(id);
      changed = true;
    }
  if (changed || !persistenceHealthy) persist();
}, 30000);
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => {
    clearInterval(cleanup);
    for (const c of controllers.values()) c.abort();
    for (const c of modelControllers) c.abort();
    persist();
    server.close();
  });

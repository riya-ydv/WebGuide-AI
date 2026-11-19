import { normalizeEnvironment } from "../shared/environment.mjs";
import { chromium, type BrowserContext, type Browser, type BrowserServer } from "playwright";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import type { Job } from "./contracts.js";
import { observe } from "./observation.js";
import { pinnedGet } from "./network.js";
import { Provider, deterministicPlan } from "./planner.js";
import { policy } from "./policy.js";
import { tutorials } from "./tutorials.js";
import { providerConfiguration } from "./provider.js";

export async function run(
  job: Job,
  controller: AbortController,
  sandboxOrigin?: string,
  checkpoint?: () => void,
): Promise<void> {
  let context: BrowserContext | undefined;
  let browser: Browser | undefined;
  let browserServer: BrowserServer | undefined;
  const runtimeLimit = Math.min(
    300000,
    Math.max(30000, Number(normalizeEnvironment(process.env)["WEBGUIDE_JOB_TIMEOUT_MS"]) || 180000),
  );
  const timer = setTimeout(() => controller.abort("Runtime limit"), runtimeLimit);
  const provider = new Provider(controller.signal);
  const abort = () => {
    void context?.close().catch(() => undefined);
    // Cancellation can arrive before a context exists or while connecting.
    void browserServer?.kill().catch(() => undefined);
  };
  controller.signal.addEventListener("abort", abort, { once: true });
  try {
    controller.signal.throwIfAborted();
    browserServer = await chromium.launchServer({
      headless: true,
      chromiumSandbox: true,
      env: {
        PATH: process.env["PATH"] || "",
        SYSTEMROOT: process.env["SYSTEMROOT"] || "",
        TEMP: process.env["TEMP"] || "",
      },
    });
    controller.signal.throwIfAborted();
    browser = await chromium.connect(browserServer.wsEndpoint());
    controller.signal.throwIfAborted();
    job.status = "running";
    job.events.push("Isolated browser started");
    if (job.planner === "ai") {
      const config = providerConfiguration();
      job.events.push(`AI planner: ${config.provider} / ${config.model}`);
    }
    context = await browser.newContext({
      serviceWorkers: "block",
      acceptDownloads: false,
      javaScriptEnabled: job.mode === "sandbox",
    });
    controller.signal.throwIfAborted();
    await context.routeWebSocket("**/*", (socket) => socket.close());
    let requests = 0;
    let totalBytes = 0;
    await context.route("**/*", async (route) => {
      try {
        if (++requests > 100 || controller.signal.aborted || route.request().method() !== "GET")
          throw new Error("Request policy blocked");
        const response = await pinnedGet(
          route.request().url(),
          new URL(job.url).origin,
          sandboxOrigin,
          controller.signal,
        );
        totalBytes += response.body.length;
        if (totalBytes > 10_000_000) throw new Error("Job output budget exhausted");
        await route.fulfill(response);
      } catch {
        await route.abort().catch(() => undefined);
      }
    });
    const page = await context.newPage();
    page.setDefaultTimeout(5000);
    page.on("dialog", (dialog) => {
      void dialog.dismiss();
    });
    context.on("page", (popup) => {
      if (popup !== page) void popup.close();
    });
    await page.goto(job.url, { waitUntil: "domcontentloaded", timeout: 15000 });
    await page
      .waitForLoadState("load", { timeout: 10000 })
      .catch(() =>
        job.events.push("Some resources did not finish loading; observations may be partial."),
      );
    const attempted = new Set<string>();
    let exhausted = true;
    for (let index = 0; index < 10; index++) {
      controller.signal.throwIfAborted();
      const before = await observe(page, `${job.id}-observation-${index}`);
      job.observations.push(before);
      const action =
        job.planner === "ai"
          ? await provider.plan(before, [...attempted], job.mode)
          : deterministicPlan(before, attempted);
      if (job.planner === "ai")
        job.events.push(`Schema-validated AI proposal ${index + 1}: ${action.type}`);
      controller.signal.throwIfAborted();
      if (action.type === "stop") {
        exhausted = false;
        break;
      }
      const target = before.controls.find((c) => c.id === action.targetId);
      const denial = policy(action, before, job.mode === "sandbox");
      const trace = {
        id: randomUUID(),
        observationId: before.id,
        action,
        label: target?.label || "Unknown target",
        status: "blocked" as "blocked" | "failed" | "verified",
        before: before.state,
        after: "",
        reason: denial || "",
      };
      job.traces.push(trace);
      if (denial) {
        job.events.push(denial);
        break;
      }
      if (attempted.has(action.targetId)) {
        trace.reason = "Repeated action stopped";
        break;
      }
      attempted.add(action.targetId);
      const locator = page.locator(`[data-gf-observed="${action.targetId}"]`);
      if ((await locator.count()) !== 1 || !(await locator.isVisible())) {
        trace.reason = "Observed target disappeared";
        trace.status = "failed";
        job.events.push(`failed: ${trace.label} is no longer visible`);
        continue;
      }
      controller.signal.throwIfAborted();
      if (action.type === "fill") await locator.fill(action.value);
      if (action.type === "click") await locator.click();
      await page.waitForTimeout(100);
      controller.signal.throwIfAborted();
      const after = await observe(page, `${before.id}-after`);
      job.observations.push(after);
      trace.after = after.state;
      const verified =
        action.type === "inspect" ||
        (action.type === "fill"
          ? (await locator.inputValue()) === action.value
          : Boolean(target?.expected) &&
            before.state !== after.state &&
            after.state.includes(target!.expected));
      trace.status = verified ? "verified" : "failed";
      trace.reason =
        action.type === "inspect"
          ? "Control is visible; action effect is not tested."
          : verified
            ? action.type === "fill"
              ? "The input contains the disposable sample value."
              : `Observed result: ${after.state}`
            : "No expected observable state change; workflow remains partial.";
      job.events.push(`${trace.status}: ${trace.label}`);
    }
    controller.signal.throwIfAborted();
    job.tutorials = await tutorials(job, provider);
    controller.signal.throwIfAborted();
    if (exhausted && job.traces.length >= 10)
      job.events.push("Action budget reached; exploration remains partial.");
    job.status =
      (exhausted && job.traces.length >= 10) ||
      job.traces.some((t) => t.status !== "verified") ||
      !job.tutorials.length
        ? "partial"
        : "completed";
  } catch (error) {
    job.status = controller.signal.aborted ? "cancelled" : "failed";
    job.error = controller.signal.aborted
      ? "Exploration cancelled; no subsequent actions executed."
      : error instanceof Error && /AI |budget|provider/i.test(error.message)
        ? error.message
        : "Exploration failed. Browser, destination, or policy unavailable.";
    job.events.push(job.error);
  } finally {
    // Keep the job busy until its browser is gone. Terminal state, persistence,
    // and releasing capacity then occur together without an intervening await.
    let terminalStatus = job.status;
    job.status = "running";
    clearTimeout(timer);
    controller.signal.removeEventListener("abort", abort);
    // Windows Chromium may stall graceful teardown. Bound it and kill only this
    // job-owned browser server (never global browser processes).
    let cleanupTimer: ReturnType<typeof setTimeout> | undefined;
    await Promise.race([
      (async () => {
        await context?.close().catch(() => undefined);
        await browser?.close().catch(() => undefined);
      })(),
      new Promise<void>((resolve) => {
        cleanupTimer = setTimeout(resolve, 3000);
      }),
    ]);
    if (cleanupTimer) clearTimeout(cleanupTimer);
    const browserPid = browserServer?.process()?.pid;
    if (process.platform === "win32" && browserPid) {
      // Kill this job's process tree directly: Playwright teardown can wait on
      // stalled Windows pipe handles even after the context has closed.
      await new Promise<void>((resolve) => {
        const killer = spawn("taskkill.exe", ["/PID", String(browserPid), "/T", "/F"], {
          windowsHide: true,
          stdio: "ignore",
          timeout: 10000,
        });
        killer.once("error", () => resolve());
        killer.once("exit", () => resolve());
      });
      let stillRunning = true;
      try {
        process.kill(browserPid, 0);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ESRCH") stillRunning = false;
      }
      if (stillRunning) {
        terminalStatus = "failed";
        job.error =
          "Browser cleanup could not be verified. Restart the local worker before another exploration.";
        job.events.push(job.error);
      }
      // RPC pipe cleanup must not keep a job running after its OS process exits.
      void browserServer?.kill().catch(() => undefined);
    } else {
      await browserServer?.kill().catch(() => undefined);
    }
    job.status = terminalStatus;
    job.completedAt = new Date().toISOString();
    checkpoint?.();
  }
}

import { normalizeEnvironment } from "../shared/environment.mjs";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseEnv } from "node:util";
import { chromium } from "playwright";
const ui = process.env.WEBGUIDE_TEST_UI || "http://127.0.0.1:4320";
const existing = process.env.WEBGUIDE_TEST_BACKEND;
const base = existing || "http://127.0.0.1:4398";
const configured = normalizeEnvironment(
  parseEnv(await readFile(process.env.WEBGUIDE_TEST_ENV || ".env", "utf8")),
);
const token = existing ? configured.WEBGUIDE_WORKER_TOKEN : randomBytes(32).toString("hex");
const directory = await mkdtemp(join(tmpdir(), "webguide-hosted-ui-"));
const env = {
  ...process.env,
  ...configured,
  WEBGUIDE_WORKER_MODE: "hosted",
  WEBGUIDE_WORKER_HOST: "127.0.0.1",
  PORT: "4398",
  WEBGUIDE_WORKER_TOKEN: token,
  WEBGUIDE_ALLOWED_HOSTS: "127.0.0.1:4398",
  WEBGUIDE_ALLOWED_ORIGINS: "http://127.0.0.1:4320",
  WEBGUIDE_DATA_DIR: directory,
};
const child = existing
  ? null
  : spawn(process.execPath, ["--import", "tsx", "worker/server.ts"], {
      env,
      windowsHide: true,
      stdio: "pipe",
    });
let browser;
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const report = { testedAt: new Date().toISOString(), checks: [], jobs: [] };
async function api(path) {
  const r = await fetch(base + path, { headers: { Authorization: `Bearer ${token}` } });
  assert.ok(r.ok, `HTTP ${r.status}`);
  return r.json();
}
try {
  for (let i = 0; i < 80; i++) {
    try {
      if ((await fetch(base + "/health")).ok) break;
    } catch {}
    await pause(100);
  }
  assert.equal((await api("/health")).aiModelAvailable, true);
  browser = await chromium.launch({ headless: true, chromiumSandbox: true });
  const page = await browser.newPage();
  await page.goto(ui, { waitUntil: "networkidle" });
  await page.getByRole("navigation").getByRole("button", { name: "Explorer" }).click();
  await page.getByLabel("Backend URL", { exact: true }).fill(base);
  await page.getByLabel("Worker access token", { exact: true }).fill(token);
  await page.getByRole("button", { name: "Check worker connection" }).click();
  await page.getByText("Worker: connected", { exact: true }).waitFor();
  report.checks.push("Explicit runtime URL and bearer connect to hosted-mode backend");
  await page.getByRole("button", { name: "Verify AI connection", exact: true }).click();
  await page.getByText(/Inference: verified/).waitFor({ timeout: 75000 });
  report.checks.push("Actual local Qwen inference verified through UI");
  for (const sandbox of [true, false]) {
    await page.getByLabel("Controlled fixture test (disposable application)").setChecked(sandbox);
    if (!sandbox)
      await page
        .getByLabel("Authorised website URL", { exact: true })
        .fill("https://evisionindia.com");
    const response = page.waitForResponse(
      (r) => r.url() === base + "/jobs" && r.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Start external exploration", exact: true }).click();
    const created = await response;
    assert.equal(created.status(), 202);
    let job = await created.json();
    const deadline = Date.now() + 210000;
    while (["queued", "running"].includes(job.status) && Date.now() < deadline) {
      await pause(1200);
      job = await api("/jobs/" + job.id);
    }
    assert.ok(
      ["completed", "partial"].includes(job.status),
      JSON.stringify({ status: job.status, error: job.error }),
    );
    assert.ok(job.tutorials.length > 0, "Evidence grounded guide required");
    await page
      .getByRole("heading", { name: job.tutorials[0].title, exact: true })
      .first()
      .waitFor({ timeout: 10000 });
    report.jobs.push({
      id: job.id,
      url: job.url,
      status: job.status,
      planner: job.planner,
      tutorials: job.tutorials.length,
    });
    report.checks.push(
      sandbox
        ? "Hosted real-AI fixture exploration and visible tutorial"
        : "Hosted real-AI evisionindia.com read-only exploration and visible tutorial",
    );
  }
  await page.getByLabel("Backend URL", { exact: true }).fill("https://different.example");
  assert.equal(await page.getByLabel("Worker access token", { exact: true }).inputValue(), "");
  await page.getByText("Worker: not connected", { exact: true }).waitFor();
  report.checks.push("URL change clears token, readiness and retained UI evidence");
  console.log(JSON.stringify(report, null, 2));
} finally {
  await writeFile("artifacts/hosted-ui-live-ai-report.json", JSON.stringify(report, null, 2));
  await browser?.close();
  child?.kill();
  await pause(1000);
  if (child && child.exitCode === null) child.kill("SIGKILL");
  await rm(directory, { recursive: true, force: true });
}

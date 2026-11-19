import { parseEnv } from "node:util";
import { normalizeEnvironment } from "../shared/environment.mjs";
import { chromium } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
const token = normalizeEnvironment(
  parseEnv(await fs.readFile(".env", "utf8")),
).WEBGUIDE_WORKER_TOKEN;
assert.ok(token);
const realAI = process.argv.includes("--ai");
const browser = await chromium.launch({ headless: true, chromiumSandbox: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto("http://127.0.0.1:4320/", { waitUntil: "networkidle" });
  await page.getByRole("navigation").getByRole("button", { name: "Explorer", exact: true }).click();
  assert.equal(
    await page.getByRole("button", { name: "Start external exploration" }).isDisabled(),
    true,
  );
  await page.getByLabel("Worker access token").fill(token);
  await page.getByRole("button", { name: "Check worker connection" }).click();
  await page.getByText("Worker: connected", { exact: true }).waitFor();
  if (realAI) {
    const verified = page.waitForResponse(
      (r) => r.url().endsWith("/ai/verify") && r.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Verify AI connection" }).click();
    assert.ok((await (await verified).json()).verifiedAt);
  }
  await page.getByLabel("Controlled fixture test", { exact: false }).check();
  await page.getByLabel("Exploration planner").selectOption(realAI ? "ai" : "deterministic");
  const created = page.waitForResponse(
    (r) => r.url().endsWith("/jobs") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Start external exploration" }).click();
  const id = (await (await created).json()).id;
  assert.ok(id);
  const job = page.locator(".gf-job").filter({ hasText: id });
  await job.locator(".gf-tutorial").first().waitFor({ timeout: 180000 });
  assert.ok((await job.innerText()).includes("Create task"));
  if (realAI) {
    assert.ok((await job.innerText()).includes("AI evidence-grounded"));
    const answered = page.waitForResponse(
      (r) => r.url().endsWith("/ask") && r.request().method() === "POST",
    );
    await job.getByRole("textbox", { name: /Question for/ }).fill("create task");
    await job.getByRole("button", { name: "Ask this job" }).click();
    const response = await answered;
    const body = await response.json();
    assert.equal(body.generator, "AI evidence selection", JSON.stringify(body));
  }
  await job.getByRole("textbox", { name: /Question for/ }).fill("delete task");
  await job.getByRole("button", { name: "Ask this job" }).click();
  await page.getByText("That feature has not been verified", { exact: false }).waitFor();
  await page.screenshot({
    path: realAI ? "artifacts/real-ai-ui.png" : "artifacts/worker-exploration.png",
    fullPage: true,
  });
  if (realAI) {
    await page
      .getByRole("navigation")
      .getByRole("button", { name: "Overview", exact: true })
      .click();
    assert.ok(await page.getByText("Inference verified", { exact: true }).isVisible());
    await page.screenshot({ path: "artifacts/verified-overview.png", fullPage: true });
  }
  assert.ok(
    !(await page.evaluate((secret) => JSON.stringify({ ...localStorage }).includes(secret), token)),
  );
  console.log(
    `PASS worker UI (${realAI ? "REAL QWEN" : "deterministic"}): disconnected disabled, token auth, readiness, fixture tutorial, grounded question, token not persisted`,
  );
} finally {
  await browser.close();
}

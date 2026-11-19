import { chromium } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const browser = await chromium.launch({ headless: true, chromiumSandbox: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const read = () =>
  page.evaluate(() => JSON.parse(localStorage.getItem("webguide-demo-v1") || "null"));
const nav = (name) => page.getByRole("navigation").getByRole("button", { name, exact: false });
const report = {
  checks: [],
  counts: {},
  realAI: "Not exercised by this deterministic UI suite; see live-ai-report.json",
};
async function check(name, action) {
  await action();
  report.checks.push(name);
  console.log(`PASS ${name}`);
}
try {
  await page.goto("http://127.0.0.1:4320/", { waitUntil: "networkidle" });
  await check("Dashboard rendered", async () =>
    assert.equal(
      await page.getByRole("heading", { level: 1 }).innerText(),
      "Where would you like to start?",
    ),
  );
  await fs.mkdir("artifacts", { recursive: true });
  await page.screenshot({ path: "artifacts/overview.png", fullPage: true });
  await check("Actual rendered autonomous demo", async () => {
    await page
      .getByRole("navigation")
      .getByRole("button", { name: "Explorer", exact: true })
      .click();
    await page.getByRole("button", { name: "Run Autonomous Demo" }).click();
    await page.waitForFunction(
      () => {
        const data = JSON.parse(localStorage.getItem("webguide-demo-v1") || "{}");
        return data.runs?.length && data.runs.at(-1).status !== "running";
      },
      { timeout: 30000 },
    );
    const data = await read();
    assert.ok(data.tutorials.length >= 4);
    assert.ok(data.runs.at(-1).observations.length > 0);
    assert.ok(
      data.tutorials.every((t) =>
        t.steps.every((s) => s.evidence.observationId && s.evidence.controlId),
      ),
    );
    report.counts = {
      tutorials: data.tutorials.length,
      traces: data.runs.at(-1).traces.length,
      status: data.runs.at(-1).status,
    };
  });
  await check("Refresh preserves records", async () => {
    const before = await read();
    await page.reload({ waitUntil: "networkidle" });
    const after = await read();
    assert.deepEqual(after, before);
  });
  await check("Navigation and tutorial modes", async () => {
    for (const name of [
      "Explorer",
      "Features",
      "Tutorials",
      "Ask WebGuide",
      "Settings",
      "Overview",
    ]) {
      await nav(name).click();
      assert.ok(await page.getByRole("heading", { level: 1 }).isVisible());
    }
    await nav("Tutorials").click();
    await page.getByLabel("Instruction mode").selectOption("refresher");
    await page.getByLabel("Search tutorials").fill("Create project");
    assert.ok((await page.locator(".gf-tutorial").count()) > 0);
  });
  await check("Unseen destructive task is not invented", async () => {
    await nav("Ask WebGuide").click();
    await page.getByLabel("Ask a question").fill("delete task permanently");
    await page.getByRole("button", { name: "Find evidence" }).click();
    assert.ok(
      await page
        .getByText("I do not have evidence for that feature.", { exact: false })
        .isVisible(),
    );
  });
  await check("Reset and repeat exploration", async () => {
    await nav("Explorer").click();
    await page.getByRole("button", { name: "Reset demo", exact: true }).click();
    assert.equal((await read()).demoState.tasks.length, 3);
    assert.ok(
      (await read()).tutorials.every((t) => t.verificationStatus === "Needs re-verification"),
    );
    await page
      .getByRole("navigation")
      .getByRole("button", { name: "Explorer", exact: true })
      .click();
    await page.getByRole("button", { name: "Run Autonomous Demo" }).click();
    await page.waitForFunction(() => {
      const runs = JSON.parse(localStorage.getItem("webguide-demo-v1")).runs;
      return runs.length === 2 && runs.at(-1).status !== "running";
    });
    assert.equal((await read()).runs.length, 2);
  });
  await check("Cancel prevents subsequent actions", async () => {
    await page
      .getByRole("navigation")
      .getByRole("button", { name: "Explorer", exact: true })
      .click();
    await page.getByRole("button", { name: "Run Autonomous Demo" }).click();
    await page.getByRole("button", { name: "Cancel exploration" }).click();
    await page.waitForFunction(
      () => JSON.parse(localStorage.getItem("webguide-demo-v1")).runs.at(-1).status === "cancelled",
    );
    const count = (await read()).runs.at(-1).traces.length;
    await page.waitForTimeout(500);
    assert.equal((await read()).runs.at(-1).traces.length, count);
  });
  await check("Mobile layout has no horizontal overflow", async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByLabel("Go to section", { exact: true }).selectOption("Overview");
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.screenshot({ path: "artifacts/mobile.png", fullPage: true });
  });
  assert.deepEqual(errors, []);
  report.checks.push("No uncaught browser errors");
  await fs.writeFile("artifacts/e2e-report.json", JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}

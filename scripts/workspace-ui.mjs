import { chromium } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
const browser = await chromium.launch({ headless: true, chromiumSandbox: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const nav = async (name) =>
  page.getByRole("navigation").getByRole("button", { name, exact: true }).click();
try {
  await page.goto("http://127.0.0.1:4320", { waitUntil: "networkidle" });
  await nav("Profile");
  await page.getByLabel("Display name", { exact: true }).fill("WebGuide Tester");
  await page.getByLabel("Workspace name").fill("QA workspace");
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await page.reload({ waitUntil: "networkidle" });
  await nav("Profile");
  assert.equal(
    await page.getByLabel("Display name", { exact: true }).inputValue(),
    "WebGuide Tester",
  );
  console.log("PASS profile save/reload and clean branding");
  await page.screenshot({ path: "artifacts/profile.png", fullPage: true });
  await nav("Saved websites");
  await page.getByLabel("Website name", { exact: true }).fill("Evision India");
  await page.getByLabel("Saved website URL").fill("https://evisionindia.com/");
  await page.getByRole("button", { name: "Save website", exact: true }).click();
  await page.getByRole("button", { name: "Open in Explorer" }).click();
  assert.equal(
    await page.getByLabel("Authorised website URL").inputValue(),
    "https://evisionindia.com/",
  );
  console.log("PASS saved website opens Explorer without starting job");
  await page.getByRole("button", { name: "Run Autonomous Demo" }).click();
  await page.waitForFunction(
    () => JSON.parse(localStorage.getItem("webguide-demo-v1")).runs.at(-1)?.status === "completed",
  );
  await page
    .getByRole("navigation")
    .getByRole("button", { name: /Tutorials/ })
    .click();
  await page.getByRole("button", { name: "Bookmark guide", exact: true }).first().click();
  await page.getByRole("button", { name: "Mark complete", exact: true }).first().click();
  await page.getByLabel("Tutorial collection").selectOption("bookmarked");
  assert.equal(await page.locator(".gf-tutorial").count(), 1);
  console.log("PASS tutorial bookmark/completion filtering");
  await nav("Settings");
  await page.getByLabel("Compact layout").check();
  await page.getByLabel("Reduce motion").check();
  await page.getByRole("button", { name: "Save preferences" }).click();
  assert.equal(await page.locator(".gf-compact").count(), 1);
  const dl = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export local evidence" }).click();
  const download = await dl;
  await download.saveAs("artifacts/workspace-backup.json");
  const backup = JSON.parse(await fs.readFile("artifacts/workspace-backup.json", "utf8"));
  assert.equal(backup.workspace.profile.displayName, "WebGuide Tester");
  await page.locator("input[type=file]").setInputFiles({
    name: "invalid.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"format":"bad"}'),
  });
  await page.getByRole("status").filter({ hasText: "Invalid or oversized" }).waitFor();
  await page.getByRole("button", { name: "Delete local records", exact: true }).click();
  await page.getByRole("button", { name: "Confirm delete records" }).click();
  await page.locator("input[type=file]").setInputFiles("artifacts/workspace-backup.json");
  await page.getByRole("button", { name: "Replace with backup" }).click();
  await page.waitForFunction(
    () => JSON.parse(localStorage.getItem("webguide-demo-v1")).tutorials.length === 10,
  );
  console.log("PASS preferences, download, invalid import safety, confirmed backup restore");
  await nav("Run history");
  await page.getByLabel("Search runs").fill("nonsense-no-match");
  assert.equal(await page.getByRole("button", { name: "View run guides" }).count(), 0);
  await page.getByLabel("Search runs").fill("");
  await page.getByRole("button", { name: "View run guides" }).first().click();
  assert.equal(await page.locator(".gf-tutorial").count(), 10);
  await nav("Profile");
  await page.setViewportSize({ width: 390, height: 844 });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await page.screenshot({ path: "artifacts/profile-mobile.png", fullPage: true });
  assert.deepEqual(errors, []);
  console.log("PASS history filtering, mobile layout and no browser errors");
} finally {
  await browser.close();
}

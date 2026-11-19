import { chromium } from "playwright";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
const browser = await chromium.launch({ headless: true, chromiumSandbox: true });
try {
  const page = await browser.newPage();
  await page.goto("http://127.0.0.1:4320", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Website companion", exact: true }).click();
  await page.getByRole("heading", { name: "Cannot see Load unpacked?" }).waitFor();
  for (const [width, height] of [
    [1440, 900],
    [390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    await page.screenshot({ path: `artifacts/companion-onboarding-${width}.png`, fullPage: true });
    assert(await page.getByRole("heading", { name: "Cannot see Load unpacked?" }).isVisible());
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  }
  await page.getByRole("link", { name: "Open website in a new tab", exact: true }).focus();
  const focus = await page
    .getByRole("link", { name: "Open website in a new tab", exact: true })
    .evaluate((e) => getComputedStyle(e).outlineStyle);
  assert.notEqual(focus, "none");
  await page.getByRole("button", { name: "Copy Chrome address" }).click();
  await page.locator(".wg-companion").getByRole("status").waitFor();
  assert.match(
    await page.locator(".wg-companion").getByRole("status").innerText(),
    /Copied|unavailable/,
  );
  await page.setContent(
    "<main><h1>Community services</h1><p>Opening hours: Monday to Friday, 9 AM to 5 PM.</p><button>View service details</button></main>",
  );
  await page.addScriptTag({ path: "shared/page-assistance.js" });
  await page.addScriptTag({ path: "browser-extension/companion.js" });
  await page.screenshot({ path: "artifacts/companion-dock-initial.png", fullPage: true });
  console.log("PASS setup desktop/mobile reflow, keyboard focus and copy feedback");
} finally {
  await browser.close();
}

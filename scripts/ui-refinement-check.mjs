import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
const out = "artifacts/ui-refinement";
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const results = [];
try {
  await page.goto(process.env.WEBGUIDE_UI_TEST_URL || "http://127.0.0.1:4350", {
    waitUntil: "networkidle",
  });
  for (const name of [
    "Overview",
    "Website companion",
    "Explorer",
    "Ask WebGuide",
    "Features",
    "Tutorials",
    "Saved websites",
    "Run history",
    "Profile",
    "Settings",
    "FAQs",
  ]) {
    await page
      .getByRole("navigation")
      .getByRole("button", { name, exact: name !== "Tutorials" })
      .click();
    await page.waitForFunction(
      (n) =>
        [...document.querySelectorAll('nav button[aria-current="page"]')].some((b) =>
          b.textContent.startsWith(n),
        ),
      name,
    );
    const axe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    const voice = await page.locator("#voice-assistant").boundingBox();
    const status = await page.locator(".wg-voice-status").boundingBox();
    assert(
      status && status.width > 100 && status.height > 20,
      "Guidance feedback must remain visible with options collapsed",
    );
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    const file = name.toLowerCase().replaceAll(" ", "-");
    await page.screenshot({ path: `${out}/${file}.png`, fullPage: true });
    results.push({
      name,
      violations: axe.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.html) })),
      voiceHeight: voice?.height,
      overflow,
    });
  }
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Website companion", exact: true })
    .click();
  await page.getByRole("link", { name: "Open website in a new tab" }).waitFor({ state: "visible" });
  await page.getByText("Open browser settings and installation help", { exact: true }).click();
  assert(await page.getByRole("button", { name: "Copy Chrome address" }).isVisible());
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    for (const name of ["Overview", "Website companion", "Explorer", "Ask WebGuide"]) {
      await page.getByRole("combobox", { name: "Go to section" }).selectOption(name);
      await page.waitForFunction(
        (n) =>
          [...document.querySelectorAll('nav button[aria-current="page"]')].some((b) =>
            b.textContent.startsWith(n),
          ),
        name,
      );
      results.push({
        name,
        width,
        overflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      });
    }
    await page.screenshot({ path: `${out}/mobile-${width}.png`, fullPage: true });
  }
  await fs.writeFile(`${out}/checks.json`, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results));
  assert(
    results.every((r) => !r.overflow && !r.violations?.length),
    "Layout or accessibility regression",
  );
} finally {
  await browser.close();
}

import { chromium } from "playwright";
import assert from "node:assert/strict";
const browser = await chromium.launch({ headless: true, chromiumSandbox: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:4320", { waitUntil: "networkidle" });
  const faq = () => page.getByRole("navigation").getByRole("button", { name: "FAQs", exact: true });
  await faq().click();
  assert.equal(await page.locator(".gf-faq").count(), 20);
  await page.getByLabel("Search FAQs").fill("cloud API key");
  assert.equal(await page.locator(".gf-faq").count(), 1);
  await page.locator(".gf-faq summary").click();
  assert.match(await page.locator(".gf-faq[open]").innerText(), /No\. The default setup/);
  await page.getByRole("button", { name: "Open Explorer", exact: true }).click();
  assert.equal(await page.getByRole("heading", { level: 1 }).innerText(), "Explorer");
  await faq().click();
  await page.getByLabel("FAQ topic").selectOption("Profile & data");
  assert.equal(await page.locator(".gf-faq").count(), 4);
  await page.getByLabel("Search FAQs").fill("not-a-real-answer");
  assert.equal(await page.locator(".gf-faq").count(), 0);
  await page.getByRole("button", { name: "Show all FAQs" }).click();
  assert.equal(await page.locator(".gf-faq").count(), 20);
  await page.locator(".gf-faq summary").first().focus();
  await page.keyboard.press("Enter");
  assert.equal(await page.locator(".gf-faq[open]").count(), 1);
  await page.screenshot({ path: "artifacts/faqs-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await page.screenshot({ path: "artifacts/faqs-mobile.png", fullPage: true });
  await page.getByLabel("Go to section").selectOption("Profile");
  assert.equal(await page.getByRole("heading", { level: 1 }).innerText(), "Profile");
  assert.deepEqual(errors, []);
  console.log(
    "PASS FAQ search, topic filters, empty state, navigation, keyboard expansion, mobile overflow and no browser errors",
  );
} finally {
  await browser.close();
}

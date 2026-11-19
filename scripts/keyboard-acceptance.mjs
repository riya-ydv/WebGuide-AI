import { chromium } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const browser = await chromium.launch({ headless: true });
const out = "artifacts/keyboard-acceptance";
await fs.mkdir(out, { recursive: true });
const checks = [];
try {
  const page = await browser.newPage();
  await page.goto(process.env.WEBGUIDE_UI_TEST_URL || "http://127.0.0.1:4320/", {
    waitUntil: "networkidle",
  });
  await page.keyboard.press("Tab");
  assert.equal(
    await page.evaluate(() => document.activeElement?.textContent),
    "Skip to voice controls",
  );
  await page.keyboard.press("Enter");
  assert.equal(await page.evaluate(() => document.activeElement?.id), "start-voice-guide");
  checks.push("Keyboard skip link reaches voice controls");
  await page.getByRole("button", { name: "Use my screen reader", exact: true }).click();
  assert.equal(
    await page
      .getByRole("button", { name: "Use my screen reader", exact: true })
      .getAttribute("aria-pressed"),
    "true",
  );
  const panel = page.locator("#voice-assistant");
  const status = panel.locator(".wg-voice-status");
  assert.equal(await status.getAttribute("aria-live"), "polite");
  await panel.getByRole("button", { name: "Read page", exact: true }).click();
  assert.match(await status.innerText(), /Allow page reading|Nothing has been scanned/i);
  checks.push("Read page requires explicit consent; screen-reader mode uses a live status");
  await panel.getByText("More voice and AI options", { exact: true }).click();
  await panel.getByText("Type a command or read the transcript", { exact: true }).click();
  await panel.getByLabel("Type a command", { exact: true }).fill("open profile");
  await panel.getByRole("button", { name: "Run command", exact: true }).click();
  await page.waitForFunction(
    () => document.querySelector("#section-heading")?.textContent === "Profile",
  );
  checks.push("Typed open profile command navigates to Profile");
  const consent = page.getByRole("checkbox", {
    name: "Allow page reading and navigation in this section",
    exact: true,
  });
  assert.equal(await consent.isChecked(), false);
  await consent.check();
  await panel.getByRole("button", { name: "Next", exact: true }).click();
  assert.ok((await status.innerText()).length > 0);
  await page.keyboard.press("Escape");
  assert.equal(await consent.isChecked(), false);
  assert.match(await status.innerText(), /Stopped/);
  assert.equal(
    await panel
      .getByRole("button", { name: "Listen: start microphone", exact: true })
      .getAttribute("aria-pressed"),
    "false",
  );
  await page.waitForTimeout(2000);
  assert.match(await status.innerText(), /Stopped/);
  checks.push("Escape revokes page consent, stops microphone and leaves stable stopped feedback");
  await page.screenshot({ path: `${out}/profile-stopped.png`, fullPage: true });
  await fs.writeFile(
    `${out}/checks.json`,
    JSON.stringify(
      {
        checks,
        limitations: [
          "Typed commands do not prove real microphone recognition",
          "ARIA checks do not prove audible Narrator or VoiceOver usability",
        ],
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify(checks));
} finally {
  await browser.close();
}

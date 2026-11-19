import { chromium } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
const b = await chromium.launch({ channel: "chrome", headless: false, chromiumSandbox: true });
try {
  const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
  await p.goto("http://127.0.0.1:4320", { waitUntil: "networkidle" });
  const panel = p.locator("[data-webguide-voice]");
  await panel.getByRole("button", { name: "Start voice guide", exact: true }).click();
  await p.waitForFunction(() => speechSynthesis.speaking, { timeout: 10000 });
  await p.waitForTimeout(250);
  await panel.getByRole("button", { name: "Stop", exact: true }).click();
  for (let i = 0; i < 5; i++) {
    await p.waitForTimeout(500);
    assert.equal(
      await p.evaluate(() => speechSynthesis.speaking || speechSynthesis.pending),
      false,
    );
  }
  await panel.getByRole("button", { name: "Read page", exact: true }).click();
  await p.waitForTimeout(750);
  assert.equal(await p.evaluate(() => speechSynthesis.speaking || speechSynthesis.pending), false);
  await p.screenshot({ path: "artifacts/webguide-final-desktop.png", fullPage: true });
  await p.setViewportSize({ width: 390, height: 844 });
  assert(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await p.screenshot({ path: "artifacts/webguide-final-mobile.png", fullPage: true });
  await fs.writeFile(
    "artifacts/native-voice-stop.json",
    JSON.stringify(
      {
        testedAt: new Date().toISOString(),
        nativeChrome: true,
        mockedSpeech: false,
        startedSpeaking: true,
        stoppedAndStayedSilent: true,
        readAfterStopStayedSilent: true,
      },
      null,
      2,
    ),
  );
  console.log(
    "PASS native Chrome speech actually started; Stop cancelled playback/queue; stayed silent and Read did not re-enable it.",
  );
} finally {
  await b.close();
}

import { chromium } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
const b = await chromium.launch({ headless: true, chromiumSandbox: true });
const c = await b.newContext({ viewport: { width: 1440, height: 1100 } });
const p = await c.newPage();
const errors = [];
p.on("pageerror", (e) => errors.push(e.message));
await p.addInitScript(() => {
  window.__spoken = [];
  window.__micStarts = 0;
  window.__micAborts = 0;
  window.speechSynthesis.cancel = () => {};
  window.speechSynthesis.speak = (u) => {
    window.__spoken.push(u.text);
    setTimeout(() => u.onend?.(), 0);
  };
  class FakeRecognition {
    start() {
      window.__micStarts++;
      window.__recognition = this;
      this.onstart?.();
    }
    abort() {
      window.__micAborts++;
      this.onend?.();
    }
  }
  window.SpeechRecognition = FakeRecognition;
});
try {
  await p.goto("http://127.0.0.1:4320", { waitUntil: "networkidle" });
  const panel = p.locator("[data-webguide-voice]");
  const status = () => panel.getByRole("status").innerText();
  const cmd = async (text) => {
    if (!(await panel.locator(".wg-more-voice").evaluate((el) => el.open)))
      await panel.getByText("More voice and AI options", { exact: true }).click();
    if (!(await panel.getByLabel("Type a command", { exact: true }).isVisible()))
      await panel
        .locator("summary")
        .filter({ hasText: "Type a command or read the transcript" })
        .click();
    await panel.getByLabel("Type a command", { exact: true }).fill(text);
    await panel.getByRole("button", { name: "Run command", exact: true }).click();
  };
  assert.deepEqual(await p.evaluate(() => window.__spoken), []);
  assert.equal(await p.evaluate(() => window.__micStarts), 0);
  await p.keyboard.press("Tab");
  assert.match(await p.evaluate(() => document.activeElement?.textContent), /Skip to voice/);
  await p.keyboard.press("Enter");
  assert.equal(await p.evaluate(() => document.activeElement?.id), "start-voice-guide");
  await cmd("open profile");
  await p.getByRole("heading", { name: "Profile", exact: true, level: 1 }).waitFor();
  assert.equal(await p.evaluate(() => document.activeElement?.tagName), "H1");
  await cmd("allow page reading");
  await cmd("focus Display name");
  await cmd("type Voice Tester");
  assert.equal(await p.getByLabel("Display name", { exact: true }).inputValue(), "Voice Tester");
  await cmd("click Save profile");
  assert.equal(await p.getByRole("status").filter({ hasText: "Profile saved" }).count(), 0);
  await cmd("cancel");
  assert.match(await status(), /cancel/i);
  await cmd("allow page reading");
  await cmd("click Save profile");
  await cmd("confirm");
  await p.getByText("Profile saved in this browser.", { exact: true }).waitFor();
  await cmd("open explorer");
  await cmd("allow page reading");
  await cmd("focus Worker access token");
  await cmd("type forbidden");
  assert.match(await status(), /cannot|private|sensitive|only/i);
  await cmd("open profile");
  await cmd("allow page reading");
  await cmd("click Save profile");
  await p.getByRole("navigation").getByRole("button", { name: "FAQs", exact: true }).click();
  await cmd("confirm");
  assert.match(await status(), /no.*action|nothing|no pending/i);
  await cmd("open profile");
  await cmd("allow page reading");
  await cmd("list headings");
  assert.match(await status(), /profile/i);
  await p.getByLabel("Email (optional)").fill("hidden-draft@example.test");
  await cmd("read page");
  assert.match(await status(), /profile/i);
  assert(!/hidden-draft@example.test/.test(await status()));
  await panel.locator("summary").filter({ hasText: "Voice options and microphones" }).click();
  await panel.getByRole("button", { name: "Enable spoken guidance", exact: true }).click();
  await p.waitForTimeout(50);
  assert((await p.evaluate(() => window.__spoken)).length > 0);
  await panel.getByRole("button", { name: "Listen: start microphone", exact: true }).click();
  assert.equal(await p.evaluate(() => window.__micStarts), 1);
  await p.evaluate(() => {
    const r = window.__recognition;
    r.onresult({
      resultIndex: 0,
      results: [{ isFinal: true, 0: { transcript: "open settings" } }],
    });
  });
  await p.getByRole("heading", { name: "Settings", exact: true, level: 1 }).waitFor();
  await p.keyboard.press("Escape");
  assert.match(await status(), /Stopped/);
  await cmd("allow page reading");
  await cmd("focus Default instruction mode");
  await cmd("choose Refresher — concise steps");
  assert.equal(await p.getByLabel("Default instruction mode").inputValue(), "beginner");
  await cmd("confirm");
  assert.equal(await p.getByLabel("Default instruction mode").inputValue(), "refresher");
  await panel.getByRole("button", { name: "Listen: start microphone", exact: true }).click();
  await p.evaluate(() => window.__recognition.onerror({ error: "not-allowed" }));
  await panel
    .getByRole("status")
    .filter({ hasText: /permission|denied|allowed|microphone/i })
    .waitFor();
  await p.evaluate(() => {
    window.speechSynthesis.speak = (u) =>
      setTimeout(() => u.onerror?.({ error: "synthesis-failed" }), 0);
  });
  await cmd("help");
  await panel.getByRole("button", { name: "Enable spoken guidance", exact: true }).waitFor();
  assert.equal(await panel.getByRole("status").getAttribute("aria-live"), "polite");
  await panel.getByLabel("Command language").selectOption("hi-IN");
  await cmd("खोलो प्रोफाइल");
  await p.getByRole("heading", { name: "Profile", exact: true, level: 1 }).waitFor();
  await p.setViewportSize({ width: 390, height: 844 });
  assert(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await p.screenshot({ path: "artifacts/webguide-voice-mobile.png", fullPage: true });
  await p.setViewportSize({ width: 320, height: 800 });
  assert(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  assert.deepEqual(errors, []);
  await fs.writeFile(
    "artifacts/voice-acceptance.json",
    JSON.stringify(
      {
        passed: true,
        checks: [
          "no autoplay",
          "skip links",
          "focus management",
          "typed and Hindi commands",
          "safe form fill",
          "confirmation and cancel",
          "sensitive field protection",
          "stale action invalidation",
          "page reading privacy",
          "speech synthesis dispatch",
          "simulated recognition event",
          "escape stop",
          "320px reflow",
          "confirmed dropdown selection",
          "microphone denial and speech failure fallback",
        ],
        limitations: [
          "Recognition events and synthesis were mocked: no real microphone/audio quality or screen reader verified",
        ],
      },
      null,
      2,
    ),
  );
  console.log(
    "PASS voice command pipeline, confirmation, reading privacy, keyboard focus, simulated speech APIs, Hindi commands and 320px reflow",
  );
} finally {
  await b.close();
}

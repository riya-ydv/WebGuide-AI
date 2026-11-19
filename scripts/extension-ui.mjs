import { chromium } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
const manifest = JSON.parse(await fs.readFile("browser-extension/manifest.json", "utf8"));
assert.deepEqual(manifest.permissions, ["activeTab", "scripting", "storage"]);
assert.equal(manifest.host_permissions, undefined);
const browser = await chromium.launch({ headless: true, chromiumSandbox: true });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setContent(
    `<!doctype html><html lang="en"><head><title>Synthetic companion test</title></head><body><main><h1>Accessible test page</h1><p>Welcome to the fixture.<span aria-hidden="true">ARIA_HIDDEN_SECRET</span><span style="display:none">CSS_HIDDEN_SECRET</span></p><h2>Tasks</h2><label id="context-label">Public label<span style="display:none">CSS_LABEL_SECRET</span></label><button aria-labelledby="context-label" aria-describedby="context-secret context-private">Context control</button><textarea id="context-secret">DESCRIPTION_FIELD_SECRET</textarea><p id="context-private" data-webguide-private>PRIVATE_DESCRIPTION_SECRET</p><form aria-label="Create task form" onsubmit="event.preventDefault();document.querySelector('#result').textContent='Task created'"><label>Task title<input aria-label="Task title" name="task" /></label><label>Password<input type="password" value="NEVER_READ_SECRET" /></label><button>Save profile<span style="display:none">HIDDEN_BUTTON_LABEL</span></button></form><section style="display:none"><button>Hidden explorer action</button></section><label>Task priority<select aria-label="Task priority"><option value="low">Low</option><option value="high">High</option><option disabled>Unavailable</option><option>Same</option><option>Same</option></select></label><button id="action" onclick="this.textContent='Activated';document.querySelector('#result').textContent='Activated'">Open panel</button><button>Duplicate</button><button>Duplicate</button><button>Pay now</button><a href="https://example.com/">External destination</a><a href="#result">Result link</a><nav aria-label="Footer navigation"><a href="#result">Footer link</a></nav><p id="result">Ready</p><p hidden>HIDDEN_PRIVATE_TEXT</p></main></body></html>`,
  );
  await page.evaluate(() => {
    window.__spoken = [];
    window.speechSynthesis.cancel = () => {};
    window.speechSynthesis.speak = (u) => window.__spoken.push(u.text);
  });
  await page.addScriptTag({ path: "shared/page-assistance.js" });
  const formLabels = await page.evaluate(() =>
    window.WebGuidePageAssistance.capture().controls.map((c) => c.name),
  );
  assert(formLabels.includes("Save profile"), "Visible form button keeps its accessible label");
  assert(
    !formLabels.some((name) => /Hidden explorer|HIDDEN_BUTTON_LABEL/.test(name)),
    "CSS-hidden sections and label descendants are excluded",
  );
  await page.evaluate(() => {
    const original = window.WebGuidePageAssistance;
    window.__captureCalls = 0;
    window.WebGuidePageAssistance = {
      ...original,
      capture: (...args) => {
        window.__captureCalls++;
        return original.capture(...args);
      },
    };
  });
  await page.addScriptTag({ path: "browser-extension/companion.js" });
  assert.equal(
    await page.evaluate(() => window.__captureCalls),
    0,
    "No capture on companion mount",
  );
  const captured = await page.evaluate(() => window.WebGuidePageAssistance.capture());
  assert.doesNotMatch(
    JSON.stringify(captured),
    /CSS_LABEL_SECRET|DESCRIPTION_FIELD_SECRET|PRIVATE_DESCRIPTION_SECRET|NEVER_READ_SECRET|CSS_HIDDEN_SECRET/,
  );
  assert.equal(captured.controls.find((c) => c.name === "Public label")?.description, undefined);
  assert.equal(
    await page.evaluate(() => window.WebGuidePageAssistance.capture().revision),
    captured.revision,
  );
  assert(captured.controls.length <= 60 && captured.headings.length <= 40);
  assert(JSON.stringify(captured).length < 22000);
  const dock = page.locator("#webguide-companion");
  assert.equal(await dock.locator("#settings").evaluate((e) => e.open), false);
  await dock.locator("#settings > summary").click();
  const command = async (text) => {
    await dock.getByLabel("Type a command", { exact: true }).fill(text);
    await dock.getByRole("button", { name: "Run command", exact: true }).click();
  };
  const status = () => dock.getByRole("status").innerText();
  assert.equal(await dock.getByRole("status").getAttribute("aria-live"), "polite");
  await dock.getByLabel("Time to confirm an action").selectOption("600");
  assert.deepEqual(await page.evaluate(() => window.__spoken), []);
  await page.evaluate(() => {
    window.__captureCalls = 0;
  });
  await command("read page");
  assert.equal(
    await page.evaluate(() => window.__captureCalls),
    0,
    "No capture before local permission",
  );
  assert.match(await status(), /No page has been scanned/);
  await dock.locator("#page-access").check();
  await command("read page");
  assert.match(await status(), /Accessible test page/);
  assert.doesNotMatch(
    await status(),
    /NEVER_READ_SECRET|HIDDEN_PRIVATE_TEXT|ARIA_HIDDEN_SECRET|CSS_HIDDEN_SECRET/,
  );
  assert.deepEqual(await page.evaluate(() => window.__spoken), []);
  await command("focus Task title");
  await command("type Hello test");
  assert.equal(await page.locator("input[name=task]").inputValue(), "");
  assert.equal(await dock.evaluate((e) => e.shadowRoot.activeElement?.id), "confirm");
  assert.match(await status(), /10 minutes/);
  await dock.getByRole("button", { name: "Confirm action", exact: true }).click();
  assert.equal(await page.locator("input[name=task]").inputValue(), "Hello test");
  assert.equal(await page.locator("#result").innerText(), "Ready");
  await command("focus Task priority");
  await command("list options");
  assert.match(await status(), /Low.*High/);
  assert.doesNotMatch(await status(), /Unavailable/);
  await command("select High");
  assert.equal(await page.getByLabel("Task priority").inputValue(), "low");
  await command("confirm");
  assert.equal(await page.getByLabel("Task priority").inputValue(), "high");
  await command("select Low");
  await command("cancel");
  assert.equal(await page.getByLabel("Task priority").inputValue(), "high");
  await dock.locator("#page-access").check();
  await command("select Same");
  assert.match(await status(), /exact name of one/);
  await command("select Unavailable");
  assert.match(await status(), /exact name of one/);
  await command("select Low");
  await page.locator("option[value=low]").evaluate((e) => (e.value = "changed"));
  await command("confirm");
  assert.match(await status(), /changed/);
  assert.equal(await page.getByLabel("Task priority").inputValue(), "high");
  await command("click Open panel");
  assert.equal(await page.locator("#action").innerText(), "Open panel");
  await dock.getByRole("button", { name: "Cancel action", exact: true }).click();
  assert.equal(await page.evaluate(() => document.activeElement?.id), "action");
  await command("confirm");
  assert.equal(await page.locator("#action").innerText(), "Open panel");
  await command("click Open panel");
  await page.locator("#action").evaluate((e) => (e.textContent = "Changed"));
  await command("confirm");
  assert.match(await status(), /changed/);
  assert.equal(await page.locator("#result").innerText(), "Ready");
  await command("click Changed");
  await command("confirm");
  assert.equal(await page.locator("#result").innerText(), "Activated");
  await page.waitForTimeout(300);
  await command("click Duplicate");
  assert.match(await status(), /More than one/);
  await command("click Pay now");
  assert.match(await status(), /sensitive/);
  await command("focus Password");
  await command("type secret");
  assert.match(await status(), /cannot|not supported|ordinary text/);
  assert.equal(await page.locator("main input[type=password]").inputValue(), "NEVER_READ_SECRET");
  await command("focus Task title");
  await command("cursor home");
  assert.equal(await page.locator("input[name=task]").evaluate((e) => e.selectionStart), 0);
  await command("cursor right");
  assert.equal(await page.locator("input[name=task]").evaluate((e) => e.selectionStart), 1);
  await command("cursor end");
  assert.equal(await page.locator("input[name=task]").evaluate((e) => e.selectionStart), 10);
  await command("cursor left");
  assert.equal(await page.locator("input[name=task]").evaluate((e) => e.selectionStart), 9);
  await command("first heading");
  assert.match(await status(), /Accessible test page/);
  await command("next heading");
  assert.match(await status(), /Tasks/);
  await command("previous heading");
  assert.match(await status(), /Accessible test page/);
  await command("last link");
  assert.match(await status(), /Footer link/);
  await command("previous link");
  assert.match(await status(), /Result link/);
  await command("next form");
  assert.match(await status(), /Create task form/);
  await command("first landmark");
  assert.match(await status(), /main/);
  await command("next landmark");
  assert.match(await status(), /Footer navigation/);
  await command("first field");
  assert.match(await status(), /Unnamed control/);
  await command("last");
  assert.match(await status(), /Footer link/);
  await command("first");
  assert.match(await status(), /Public label/);
  await command("focus Password");
  await command("cursor left");
  assert.match(await status(), /Sensitive fields/);
  await command("click External destination");
  await page.keyboard.press("Escape");
  await command("confirm");
  assert.match(await status(), /No page has been scanned/);
  assert.equal(await dock.locator("#page-access").isChecked(), false);
  await dock.locator("#page-access").check();
  await dock.getByRole("button", { name: "Listen", exact: true }).click();
  assert.match(await status(), /Allow microphone/);
  await command("next heading");
  assert.match(await status(), /Accessible test page/);
  await dock.getByRole("button", { name: "Start voice guide", exact: true }).click();
  assert.ok((await page.evaluate(() => window.__spoken)).length > 0);
  assert.equal(await dock.getByRole("status").getAttribute("aria-live"), "off");
  await page.evaluate(() => {
    window.speechSynthesis.speak = () => {
      throw new Error("speaker unavailable");
    };
  });
  await command("help");
  assert.match(await status(), /Spoken audio is unavailable/);
  assert.equal(await dock.getByRole("status").getAttribute("aria-live"), "polite");
  await page.evaluate(() => {
    window.__micStarts = 0;
    window.speechSynthesis.speak = (u) => {
      window.__spoken.push(u.text);
      setTimeout(() => u.onend?.(), 10);
    };
    window.SpeechRecognition = class {
      start() {
        window.__micStarts++;
        window.__recognition = this;
        setTimeout(() => this.onstart?.(), 0);
      }
      abort() {
        setTimeout(() => this.onend?.(), 0);
      }
    };
  });
  await dock.locator("#consent").check();
  await dock.locator("#continuous").check();
  await dock.getByRole("button", { name: "Listen", exact: true }).click();
  await page.waitForFunction(() => window.__micStarts === 1);
  await page.evaluate(() =>
    window.__recognition.onresult({ results: [[{ transcript: "next heading" }]] }),
  );
  await page.waitForFunction(() => window.__micStarts === 2);
  await page.evaluate(() => {
    const r = window.__recognition;
    window.__staleRecognition = {
      start: r.onstart,
      result: r.onresult,
      error: r.onerror,
      end: r.onend,
    };
  });
  await page.keyboard.press("Escape");
  await page.evaluate(() => {
    const old = window.__staleRecognition;
    old.start?.();
    old.result?.({ results: [[{ transcript: "click External destination" }]] });
    old.error?.({ error: "network" });
    old.end?.();
  });
  assert.equal(await dock.locator("#speech").getAttribute("aria-pressed"), "false");
  assert.match(await status(), /Stopped/);
  assert(await dock.locator("#confirmation").evaluate((e) => e.hidden));
  await page.waitForTimeout(650);
  assert.equal(await page.evaluate(() => window.__micStarts), 2);
  await page.evaluate(() => {
    window.__utterances = [];
    window.speechSynthesis.speak = (u) => {
      window.__utterances.push(u);
    };
  });
  await dock.getByRole("button", { name: "Start voice guide", exact: true }).click();
  await dock.locator("#page-access").check();
  await command("read page");
  await page.evaluate(() => {
    const u = window.__utterances.at(-1);
    window.__staleSpeech = { end: u.onend, error: u.onerror };
  });
  const utteranceCount = await page.evaluate(() => window.__utterances.length);
  await dock.getByRole("button", { name: "Stop and cancel", exact: true }).click();
  await page.evaluate(() => {
    window.__staleSpeech.end?.();
    window.__staleSpeech.error?.();
  });
  await command("help");
  await page.waitForTimeout(650);
  assert.equal(await page.evaluate(() => window.__utterances.length), utteranceCount);
  assert.equal(await page.evaluate(() => window.__micStarts), 2);
  assert.equal(await dock.locator("#speech").getAttribute("aria-pressed"), "false");
  await dock.locator("#settings > summary").click();
  await page.setViewportSize({ width: 390, height: 844 });
  assert(await dock.evaluate((e) => e.getBoundingClientRect().right <= window.innerWidth));
  await fs.mkdir("artifacts", { recursive: true });
  await page.screenshot({ path: "artifacts/webguide-companion.png", fullPage: true });
  await dock.getByRole("button", { name: "Close companion", exact: true }).click();
  assert.equal(await page.locator("#webguide-companion").count(), 0);
  assert.deepEqual(errors, []);
  console.log(
    "PASS companion permissions, no autoplay, page-reading privacy, confirmed fill/click, cancel, stale targets, ambiguity, sensitive actions, keyboard stop, microphone consent caret and semantic navigation, synthetic continuous-listening pause/stop, speech error fallback and mobile dock",
  );
} finally {
  await browser.close();
}

if (process.argv.includes("--native")) {
  const extension = path.resolve("browser-extension");
  const profile = await fs.mkdtemp(path.resolve("artifacts/extension-profile-"));
  const context = await chromium.launchPersistentContext(profile, {
    channel: "chromium",
    headless: true,
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
  });
  try {
    const worker =
      context.serviceWorkers()[0] ||
      (await context.waitForEvent("serviceworker", { timeout: 15000 }));
    assert(worker.url().startsWith("chrome-extension://"));
    const loaded = await worker.evaluate(() => chrome.runtime.getManifest());
    assert.equal(loaded.name, "WebGuide AI Browser Companion");
    assert.deepEqual(loaded.permissions, ["activeTab", "scripting", "storage"]);
    console.log(
      "PASS actual unpacked MV3 registration and native extension service worker (toolbar activation not simulated)",
    );
  } finally {
    await context.close();
  }
}
if (process.argv.includes("--real-site")) {
  const liveBrowser = await chromium.launch({ headless: true, chromiumSandbox: true });
  try {
    const page = await liveBrowser.newPage();
    await page.goto("https://evisionindia.com/", { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.addScriptTag({ path: "shared/page-assistance.js" });
    await page.addScriptTag({ path: "browser-extension/companion.js" });
    const dock = page.locator("#webguide-companion");
    await dock.locator("#settings > summary").click();
    const observations = {
      url: page.url(),
      observedAt: new Date().toISOString(),
      mode: "read-only injected companion; no website clicks or form submissions",
      outputs: {},
    };
    for (const text of ["list headings", "list links", "read page"]) {
      await dock.getByLabel("Type a command", { exact: true }).fill(text);
      await dock.getByRole("button", { name: "Run command", exact: true }).click();
      observations.outputs[text] = (await dock.getByRole("status").innerText()).slice(0, 2500);
      assert(observations.outputs[text].length > 20);
    }
    await fs.writeFile("artifacts/webguide-real-site.json", JSON.stringify(observations, null, 2));
    console.log(
      "PASS authorised evisionindia.com read-only headings, links and page text; no website actions sent",
    );
    console.log(
      JSON.stringify({
        headings: observations.outputs["list headings"].slice(0, 300),
        links: observations.outputs["list links"].slice(0, 200),
      }),
    );
  } finally {
    await liveBrowser.close();
  }
}

import { normalizeEnvironment } from "../shared/environment.mjs";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import fs from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { parseEnv } from "node:util";

const extensionId = "nnodbcjnbbdbbdakdhppclfbblcmjejl";
const extensionOrigin = `chrome-extension://${extensionId}`;
const fixtureUrl = (process.env.WEBGUIDE_TEST_UI || "http://127.0.0.1:4320") + "/demo-service.html";
const backend = process.env.WEBGUIDE_TEST_BACKEND || "http://127.0.0.1:4318";
const env = normalizeEnvironment(
  parseEnv(await fs.readFile(process.env.WEBGUIDE_TEST_ENV || ".env", "utf8")),
);
const token = env.WEBGUIDE_WORKER_TOKEN;
assert.ok(token?.length >= 32, "Private worker token is required");
const temporary = await fs.mkdtemp(path.join(tmpdir(), "webguide-extension-relay-"));
const extensionPath = path.join(temporary, "extension");
const report = {
  testedAt: new Date().toISOString(),
  mode: "real Chromium extension and real model; loopback host permission granted in temporary fixture manifest",
  nativePermissionPrompt:
    "NOT exercised; this test does not establish physical toolbar or browser permission-prompt acceptance",
  checks: [],
};
let context;
try {
  await fs.cp("browser-extension", extensionPath, { recursive: true });
  const manifestFile = path.join(extensionPath, "manifest.json");
  const manifest = JSON.parse(await fs.readFile(manifestFile, "utf8"));
  assert.ok(
    manifest.permissions.includes("storage"),
    "Session-backed extension build must be ready",
  );
  manifest.host_permissions = ["http://127.0.0.1/*"];
  await fs.writeFile(manifestFile, JSON.stringify(manifest, null, 2));
  context = await chromium.launchPersistentContext(path.join(temporary, "profile"), {
    channel: "chromium",
    headless: true,
    chromiumSandbox: true,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });
  let worker = context.serviceWorkers()[0] || (await context.waitForEvent("serviceworker"));
  assert.equal(new URL(worker.url()).hostname, extensionId);
  const page = await context.newPage();
  await page.goto(fixtureUrl, { waitUntil: "networkidle" });
  await page.locator("#visitor-name").fill("PRIVATE_EXTENSION_DRAFT_7319");
  let popup = await context.newPage();
  await popup.goto(`${extensionOrigin}/popup.html`);
  const tabId = await popup.evaluate(async (url) => {
    const tabs = await chrome.tabs.query({});
    return tabs.find((tab) => tab.url === url)?.id;
  }, fixtureUrl);
  assert.ok(Number.isInteger(tabId));
  const send = (message) => popup.evaluate((value) => chrome.runtime.sendMessage(value), message);
  const waiting = await send({
    type: "WEBGUIDE_STAGE_CONNECT",
    tabId,
    endpoint: backend.replace("127.0.0.1", "localhost"),
    token,
  });
  assert.equal(waiting.ok, true);
  assert.equal(
    waiting.data.pending,
    true,
    "The optional localhost origin has not been granted in this fixture",
  );
  await popup.close();
  popup = await context.newPage();
  await popup.goto(`${extensionOrigin}/popup.html`);
  const retainedPending = await send({ type: "WEBGUIDE_CONNECT_STATUS", tabId });
  assert.equal(retainedPending.ok, true);
  assert.equal(retainedPending.data.pending, true);
  assert.equal(retainedPending.data.connected, false);
  assert.equal(JSON.stringify(retainedPending).includes(token), false);
  report.checks.push(
    "Pending origin-permission connection survives popup closure without exposing token (no native permission dialog exercised)",
  );
  const staged = await send({ type: "WEBGUIDE_STAGE_CONNECT", tabId, endpoint: backend, token });
  assert.equal(staged.ok, true);
  assert.equal(typeof staged.data.pending, "boolean");
  await popup.close();
  popup = await context.newPage();
  await popup.goto(`${extensionOrigin}/popup.html`);
  let status;
  for (let attempt = 0; attempt < 100; attempt++) {
    status = await send({ type: "WEBGUIDE_CONNECT_STATUS", tabId });
    if (status.data?.connected) break;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  assert.equal(status?.ok, true);
  assert.equal(
    status?.data?.connected,
    true,
    "Connection must finish despite initiating popup closing",
  );
  assert.equal(JSON.stringify(status).includes(token), false);
  report.checks.push(
    "Authenticated connection remains available after popup closure; status returns no token",
  );
  let sentContext;
  context.on("request", (request) => {
    if (request.url() === backend + "/guidance" && request.method() === "POST")
      sentContext = request.postDataJSON();
  });
  const opened = await send({ type: "WEBGUIDE_OPEN", tabId });
  assert.equal(opened.ok, true);
  const dock = page.locator("#webguide-companion");
  await dock.waitFor();
  await dock.locator("#page-access").check();
  await dock.locator("#settings > summary").click();
  await dock.locator("#goal").fill("What are the service hours?");
  await dock.locator("#share-context").check();
  await dock.locator("#ask-guidance").click();
  await page.waitForFunction(
    () =>
      document.querySelector("#webguide-companion")?.shadowRoot?.getElementById("guidance-state")
        ?.textContent === "Current-page guidance — task not yet completed",
    {},
    { timeout: 70000 },
  );
  const guidance = await dock.locator("#guidance-message").innerText();
  assert.match(guidance, /9|nine/i);
  assert.match(guidance, /5|five/i);
  assert.ok(sentContext, "Actual extension background POST observed");
  assert.equal(JSON.stringify(sentContext).includes("PRIVATE_EXTENSION_DRAFT_7319"), false);
  assert.equal(await dock.locator("#guidance-token").inputValue(), "");
  report.checks.push(
    "Actual service-worker authenticated guidance POST returned real model service hours",
    "Private draft and backend token absent from page-context payload and website token field",
  );
  report.guidance = guidance;
  await dock.locator("#stop").click();
  assert.equal(await dock.locator("#share-context").isChecked(), false);
  assert.equal(await dock.locator("#speech").getAttribute("aria-pressed"), "false");
  report.checks.push("Stop clears page-sharing consent and disables speech");

  const cdp = await context.newCDPSession(popup);
  const versions = new Map();
  cdp.on("ServiceWorker.workerVersionUpdated", ({ versions: updates }) =>
    updates.forEach((version) => versions.set(version.versionId, version)),
  );
  await cdp.send("ServiceWorker.enable");
  for (
    let attempt = 0;
    attempt < 40 &&
    ![...versions.values()].some((version) => version.scriptURL.startsWith(extensionOrigin));
    attempt++
  )
    await new Promise((resolve) => setTimeout(resolve, 100));
  const version = [...versions.values()].find(
    (item) => item.scriptURL.startsWith(extensionOrigin) && item.runningStatus === "running",
  );
  assert.ok(version, "Must identify this extension service worker before stopping it");
  await cdp.send("ServiceWorker.stopWorker", { versionId: version.versionId });
  for (
    let attempt = 0;
    attempt < 40 && versions.get(version.versionId)?.runningStatus !== "stopped";
    attempt++
  )
    await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal(versions.get(version.versionId)?.runningStatus, "stopped");
  status = await send({ type: "WEBGUIDE_CONNECT_STATUS", tabId });
  assert.equal(status.ok, true);
  assert.equal(status.data.connected, true, "Session connection must recover after worker restart");
  assert.equal(JSON.stringify(status).includes(token), false);
  report.checks.push(
    "Actual service-worker stop/restart retains session connection without returning token",
  );
  await page.reload({ waitUntil: "networkidle" });
  assert.equal((await send({ type: "WEBGUIDE_OPEN", tabId })).ok, true);
  await page.locator("#webguide-companion").waitFor();
  assert.equal((await send({ type: "WEBGUIDE_OPEN", tabId })).ok, true);
  assert.equal(await page.locator("#webguide-companion").count(), 1);
  report.checks.push("Reload and repeated injection create exactly one companion");
  await cdp.detach();
  report.passed = true;
  console.log(JSON.stringify(report, null, 2));
} finally {
  await fs.writeFile("artifacts/extension-relay-live.json", JSON.stringify(report, null, 2));
  await context?.close();
  assert.equal(path.dirname(path.resolve(temporary)), path.resolve(tmpdir()));
  assert.ok(path.basename(temporary).startsWith("webguide-extension-relay-"));
  await fs.rm(temporary, { recursive: true, force: true });
}

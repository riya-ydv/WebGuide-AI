import { normalizeEnvironment } from "../shared/environment.mjs";
/** Run only after the isolated fresh release services are ready. Never starts or reuses an old model. */
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { parseEnv } from "node:util";
import assert from "node:assert/strict";
const supplied = process.argv[2];
if (!supplied)
  throw Error(
    "Usage: node scripts/fresh-install-ui.mjs <fresh-project-directory> [env-file-relative-to-project]",
  );
const project = await fs.realpath(path.resolve(supplied));
const source = await fs.realpath(path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."));
assert.notEqual(project, source, "Fresh test must target a separate extracted project");
const envPath = path.resolve(project, process.argv[3] || ".env");
assert(envPath.startsWith(project + path.sep), "Read only the fresh project environment");
const env = normalizeEnvironment(parseEnv(await fs.readFile(envPath, "utf8")));
const token = env.WEBGUIDE_WORKER_TOKEN;
assert(token?.length >= 32, "Fresh launcher-generated worker credential required");
assert.notEqual(
  env.WEBGUIDE_AI_BASE_URL,
  "http://127.0.0.1:11435/v1",
  "Do not use the prior development Qwen service",
);
const requireFresh = createRequire(path.join(project, "package.json"));
const playwrightPath = requireFresh.resolve("playwright");
assert(
  playwrightPath.startsWith(project + path.sep),
  "Use dependencies installed in the fresh project",
);
assert.equal(
  env.WEBGUIDE_MANAGED_OLLAMA,
  "1",
  "Fresh test requires application-managed model setup",
);
assert.equal(
  env.WEBGUIDE_AI_BASE_URL,
  "http://127.0.0.1:11436",
  "Fresh test uses isolated managed model port",
);
process.env.PLAYWRIGHT_BROWSERS_PATH = path.join(project, ".webguide-local", "browsers");
const { chromium } = requireFresh("playwright");
assert(
  chromium.executablePath().startsWith(project + path.sep),
  "Fresh browser cache stays inside extracted app",
);
const { createLauncherConnection } = await import(
  pathToFileURL(path.join(project, "scripts/launcher-connection.mjs")).href
);
const artifacts = path.join(project, ".webguide-local", "fresh-ui-evidence");
await fs.mkdir(artifacts, { recursive: true });
const bridge = await createLauncherConnection({ workerToken: token });
const checks = [];
let browser;
let modelAnswer;
let page;
try {
  browser = await chromium.launch({ headless: true, chromiumSandbox: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.addInitScript(() => {
    window.__freshMicStarts = 0;
    const Original = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (Original) {
      class Counted extends Original {
        start() {
          window.__freshMicStarts++;
          return super.start();
        }
      }
      window.SpeechRecognition = Counted;
      window.webkitSpeechRecognition = Counted;
    }
    const original = navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices);
    if (original)
      navigator.mediaDevices.getUserMedia = (...args) => {
        window.__freshMicStarts++;
        return original(...args);
      };
  });
  page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(bridge.url, { waitUntil: "networkidle" });
  const showGuidance = async () => {
    const options = page.locator("details.wg-more-voice");
    if (!(await options.evaluate((element) => element.open)))
      await options.locator(":scope > summary").click();
    await page.getByLabel("Your website goal", { exact: true }).waitFor();
  };
  await showGuidance();
  await page.getByText("AI connected", { exact: true }).waitFor({ timeout: 20000 });
  assert.equal(new URL(page.url()).hash, "", "Launcher nonce removed from address");
  assert.equal(
    await page.evaluate(() => window.__freshMicStarts),
    0,
    "No automatic microphone start",
  );
  assert.equal(
    await page.evaluate(
      (t) =>
        Object.values(localStorage).some((v) => v.includes(t)) ||
        Object.values(sessionStorage).some((v) => v.includes(t)),
      token,
    ),
    false,
    "Worker token is not persisted by app",
  );
  checks.push(
    "fresh module one-time launcher URL automatically connects verified worker without token entry",
    "nonce removed and no automatic microphone or persisted worker token",
  );
  const nav = async (name) => {
    await page.getByRole("navigation").getByRole("button", { name, exact: true }).click();
    await page.getByRole("heading", { name, exact: true }).first().waitFor();
  };
  await nav("Profile");
  await page.getByLabel("Display name", { exact: true }).fill("Fresh Demo Visitor");
  await page.getByLabel("Workspace name").fill("Fresh local check");
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await nav("FAQs");
  await page.getByLabel("Search FAQs").fill("backup");
  assert((await page.locator(".gf-faq").count()) > 0);
  await page.locator(".gf-faq summary").first().click();
  await nav("Saved websites");
  await page.getByLabel("Website name", { exact: true }).fill("Controlled practice");
  await page.getByLabel("Saved website URL").fill("http://127.0.0.1:4320/demo-service.html");
  await page.getByRole("button", { name: "Save website", exact: true }).click();
  await page.getByRole("button", { name: "Edit website", exact: true }).click();
  await page.getByLabel("Website name", { exact: true }).fill("Edited practice");
  await page.getByRole("button", { name: "Save website changes", exact: true }).click();
  await page.getByRole("button", { name: "Remove website", exact: true }).click();
  await page.getByRole("button", { name: "Keep website", exact: true }).click();
  assert(await page.getByRole("heading", { name: "Edited practice" }).isVisible());
  await page.getByRole("button", { name: "Remove website", exact: true }).click();
  await page.getByRole("button", { name: "Confirm remove", exact: true }).click();
  assert.equal(await page.getByRole("heading", { name: "Edited practice" }).count(), 0);
  checks.push(
    "profile saved",
    "FAQ search and disclosure",
    "saved website create/edit/cancel deletion/confirmed removal",
  );
  await nav("Website companion");
  const next = context.waitForEvent("page");
  await page.getByRole("link", { name: "Open practice website", exact: true }).click();
  const practice = await next;
  await practice.waitForLoadState("networkidle");
  assert.equal(await practice.locator("#webguide-companion").count(), 0);
  await practice.getByRole("button", { name: "Open WebGuide AI", exact: true }).click();
  assert.equal(await practice.locator("#webguide-companion").count(), 1);
  assert.equal(await practice.evaluate(() => window.__freshMicStarts), 0);
  await practice.close();
  checks.push("practice opens actual embedded widget only after activation");
  await nav("Profile");
  assert.equal(
    await page.getByLabel("Display name", { exact: true }).inputValue(),
    "Fresh Demo Visitor",
  );
  await showGuidance();
  await page
    .getByLabel("Your website goal", { exact: true })
    .fill("Which button saves my profile changes?");
  await page.getByLabel("Allow page reading and navigation in this section").check();
  await page.getByLabel("Allow AI guidance to receive this page for this request").check();
  const responsePromise = page.waitForResponse(
    (r) => new URL(r.url()).pathname === "/guidance" && r.request().method() === "POST",
    { timeout: 90000 },
  );
  await page.getByRole("button", { name: "Guide me", exact: true }).click();
  const response = await responsePromise;
  assert(response.ok(), "Real model guidance HTTP success");
  modelAnswer = await response.json();
  assert.doesNotMatch(modelAnswer.message, /\bwg-target-\d+\b/, "Spoken guidance excludes internal IDs");
  assert.equal(
    modelAnswer.status,
    "guidance",
    "Model supplies supported guidance, not an unavailable state",
  );
  const sentContext = response.request().postDataJSON().context;
  assert(
    sentContext.controls.some((control) => control.name === "Save profile"),
    "Current snapshot includes the actual save button",
  );
  assert(
    !sentContext.controls.some((control) => /Run Autonomous Demo/.test(control.name)),
    "Hidden explorer actions are absent",
  );
  assert.match(
    JSON.stringify(modelAnswer),
    /save profile/i,
    "Response names the actual profile save control",
  );
  assert.doesNotMatch(
    JSON.stringify(modelAnswer),
    /Run Autonomous Demo/i,
    "No unrelated action recommended",
  );
  await page.locator(".wg-guidance-result").waitFor({ timeout: 10000 });
  checks.push("actual fresh configured model names Save profile with no unrelated demo action");
  await page.screenshot({
    path: path.join(artifacts, "fresh-profile-guidance.png"),
    fullPage: true,
  });
  await page.reload({ waitUntil: "networkidle" });
  await nav("Profile");
  assert.equal(
    await page.getByLabel("Display name", { exact: true }).inputValue(),
    "Fresh Demo Visitor",
  );
  assert.equal(await page.evaluate(() => window.__freshMicStarts), 0);
  checks.push("profile persists across browser reload");
  assert.deepEqual(errors, [], "No browser application errors");
  await fs.writeFile(
    path.join(artifacts, "report.json"),
    JSON.stringify(
      {
        testedAt: new Date().toISOString(),
        project,
        dependencyPath: playwrightPath,
        checks,
        modelAnswer,
        limits: [
          "This test uses a new isolated browser context and bridge generated by the same fresh launcher module; it does not automate OS double-click.",
          "Runtime download isolation and process ownership must be confirmed by launcher evidence separately.",
          "No real external forms or microphone audio used.",
        ],
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({ passed: checks.length, report: path.join(artifacts, "report.json") }),
  );
} catch (error) {
  const clean = String(error?.message || error)
    .split(token)
    .join("[REDACTED]")
    .replace(/webguide-connect=[^\s"']+/g, "webguide-connect=[REDACTED]");
  await fs.writeFile(
    path.join(artifacts, "failure.json"),
    JSON.stringify({ status: "failed", completedChecks: checks, error: clean }, null, 2),
  );
  await page
    ?.screenshot({ path: path.join(artifacts, "failure.png"), fullPage: true })
    .catch(() => {});
  throw Error(clean);
} finally {
  await browser?.close();
  await bridge.close();
}

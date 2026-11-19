import { parseEnv } from "node:util";
import { normalizeEnvironment } from "../shared/environment.mjs";
import { chromium } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
const token = normalizeEnvironment(
  parseEnv(await fs.readFile(process.env.WEBGUIDE_TEST_ENV || ".env", "utf8")),
).WEBGUIDE_WORKER_TOKEN;
assert(token);
const ui = process.env.WEBGUIDE_TEST_UI || "http://127.0.0.1:4320";
const backend = process.env.WEBGUIDE_TEST_BACKEND || "http://127.0.0.1:4318";
const browser = await chromium.launch({ headless: true, chromiumSandbox: true });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(ui, { waitUntil: "networkidle" });
  const nav = page.getByRole("navigation");
  await nav.getByRole("button", { name: "Explorer", exact: true }).click();
  await page.getByLabel("Backend URL", { exact: true }).fill(backend);
  await page.getByLabel("Worker access token", { exact: true }).fill(token);
  await page.getByRole("button", { name: "Check worker connection", exact: true }).click();
  await page.getByText("Worker: connected", { exact: true }).waitFor();
  await nav.getByRole("button", { name: "Profile", exact: true }).click();
  await page.getByLabel("Display name", { exact: true }).fill("PRIVATE_DRAFT_123");
  await page.getByText("More voice and AI options", { exact: true }).click();
  await page
    .getByLabel("Your website goal", { exact: true })
    .fill("Explain Display name and how to save profile");
  await page
    .getByLabel("Allow page reading and navigation in this section", { exact: false })
    .check();
  await page.getByLabel("Allow AI guidance to receive this page for this request").check();
  const sent = page.waitForRequest((r) => r.url().endsWith("/guidance"));
  const replied = page.waitForResponse((r) => r.url().endsWith("/guidance"), { timeout: 70000 });
  await page.getByRole("button", { name: "Guide me", exact: true }).click();
  const request = await sent;
  const payload = request.postDataJSON();
  assert(!JSON.stringify(payload).includes("PRIVATE_DRAFT_123"));
  assert(payload.context.controls.some((c) => c.name === "Display name"));
  const save = payload.context.controls.find((c) => c.name === "Save profile");
  assert(save, "Profile save button must have an extracted accessible name");
  const response = await replied;
  assert.equal(response.status(), 200);
  const answer = await response.json();
  assert.equal(answer.status, "guidance");
  assert(
    !JSON.stringify(answer).includes("Run Autonomous Demo"),
    "Unrelated demo action must not be recommended for saving profile",
  );
  assert(
    answer.steps.some((step) => step.targetId === save.id),
    "Save guidance must reference the actual profile save control",
  );
  assert.equal(answer.contextRevision, payload.context.revision);
  const results = page.locator(".wg-guidance-result");
  await results.waitFor();
  assert((await results.innerText()).length > 30);
  await page.getByLabel("Your website goal", { exact: true }).fill("Different goal");
  await results.waitFor({ state: "detached" });
  await nav.getByRole("button", { name: "Website companion", exact: true }).click();
  const newPage = page.waitForEvent("popup");
  await page.getByRole("link", { name: "Open practice website", exact: true }).click();
  const practice = await newPage;
  await practice.waitForLoadState("networkidle");
  assert(practice.url().endsWith("/demo-service.html"));
  await practice.getByRole("button", { name: "Open WebGuide AI", exact: true }).click();
  await practice.locator("#webguide-companion").waitFor();
  await page.getByLabel("Website address", { exact: true }).fill(ui + "/demo-service.html");
  const opened = page.waitForEvent("popup");
  await page.getByRole("link", { name: "Open website in a new tab", exact: true }).click();
  const external = await opened;
  await external.waitForLoadState("domcontentloaded");
  assert(external.url().endsWith("/demo-service.html"));
  assert.deepEqual(errors, []);
  await fs.writeFile(
    "artifacts/app-guidance-live.json",
    JSON.stringify(
      {
        testedAt: new Date().toISOString(),
        realModel: true,
        checks: [
          "shared verified connection",
          "actual current-page guidance",
          "draft value excluded",
          "goal edit clears old result",
          "practice website opens with widget",
          "website link opens directly",
        ],
        answer,
      },
      null,
      2,
    ),
  );
  console.log(
    "PASS real current-page Qwen guidance, private draft exclusion, goal-change reset, embedded practice widget and direct website opening",
  );
} finally {
  await browser.close();
}

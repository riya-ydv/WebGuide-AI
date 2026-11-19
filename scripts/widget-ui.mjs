import { parseEnv } from "node:util";
import { normalizeEnvironment } from "../shared/environment.mjs";
import { chromium } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
const browser = await chromium.launch({ headless: true, chromiumSandbox: true });
try {
  const page = await browser.newPage();
  await page.goto("http://127.0.0.1:4320/demo-service.html");
  assert.equal(await page.locator("#webguide-companion").count(), 0);
  await page.getByRole("button", { name: "Open WebGuide AI", exact: true }).click();
  const dock = page.locator("#webguide-companion");
  await dock.locator("#settings > summary").click();
  await dock.getByText("AI guidance connection", { exact: true }).click();
  await dock.locator("#guidance-endpoint").fill("http://127.0.0.1:4318");
  let requests = 0;
  if (process.argv.includes("--live")) {
    const token = normalizeEnvironment(
      parseEnv(await fs.readFile(".env", "utf8")),
    ).WEBGUIDE_WORKER_TOKEN;
    assert(token, "Worker token configured");
    await dock.locator("#guidance-token").fill(token);
  } else {
    await dock.locator("#guidance-token").fill("fixture-token-00000000000000000000000");
    await page.route("**/guidance", async (route) => {
      assert.equal(new URL(route.request().url()).pathname, "/guidance");
      requests++;
      const body = route.request().postDataJSON();
      await route.fulfill({
        json: {
          message: "The service is open Monday to Friday, 9 AM to 5 PM.",
          steps: [],
          status: "guidance",
          contextRevision: body.context.revision,
        },
      });
    });
  }
  await dock.locator("#goal").fill("What are the service hours?");
  await page.evaluate(() => {
    const s = document.querySelector("#webguide-companion").shadowRoot;
    s.getElementById("share-context").checked = true;
    s.getElementById("goal-form").requestSubmit();
    s.getElementById("speech").click();
  });
  await page.waitForTimeout(150);
  assert.equal(requests, 0);
  assert.equal(await dock.locator("#speech").getAttribute("aria-pressed"), "false");
  await dock.locator("#share-context").uncheck();
  await dock.locator("#share-context").check();
  await dock.locator("#read").click();
  await page.evaluate(() =>
    document
      .querySelector("#webguide-companion")
      .shadowRoot.getElementById("goal-form")
      .requestSubmit(),
  );
  await page.waitForTimeout(150);
  assert.equal(requests, 0, "An unrelated real click cannot authorize a synthetic form submit");
  await dock.locator("#ask-guidance").click();
  await page.waitForFunction(
    () =>
      document.querySelector("#webguide-companion").shadowRoot.getElementById("guidance-state")
        .textContent === "Current-page guidance — task not yet completed",
    {},
    { timeout: 65000 },
  );
  const guidance = await dock.locator("#guidance-message").innerText();
  assert.match(guidance, /9|nine|Monday/i);
  await dock.locator("#repeat-guidance").click();
  await dock.locator("#command").fill("click Show accessibility details");
  await dock.getByRole("button", { name: "Run command", exact: true }).click();
  await dock.locator("#confirm").click();
  await page.waitForTimeout(350);
  assert.equal(await page.locator("#access-panel").isVisible(), true);
  assert.match(await dock.locator("#status").innerText(), /Website reported/);
  await page.locator("#visitor-name").fill("Demo Visitor");
  await page.locator("#visit-topic").selectOption({ label: "Accessibility support" });
  await dock.locator("#command").fill("click Request support visit");
  await dock.getByRole("button", { name: "Run command", exact: true }).click();
  await dock.locator("#confirm").click();
  await page.waitForTimeout(350);
  assert.match(await page.locator("#form-receipt").innerText(), /HCS-001/);
  assert.match(await dock.locator("#status").innerText(), /Website reported/);
  assert.match(await dock.locator("#guidance-state").innerText(), /Page changed/);
  await dock.locator("#stop").click();
  assert.equal(await dock.locator("#share-context").isChecked(), false);
  await fs.writeFile(
    process.argv.includes("--live")
      ? "artifacts/widget-live-report.json"
      : "artifacts/widget-fixture-report.json",
    JSON.stringify(
      {
        mode: process.argv.includes("--live")
          ? "actual configured model"
          : "stubbed protocol fixture",
        guidance,
        checks: [
          "explicit activation",
          "synthetic sharing blocked",
          "synthetic speech blocked",
          "consented guidance",
          "repeat",
          "confirmed details control",
          "synthetic request receipt",
          "stale guidance",
          "stop consent reset",
        ],
      },
      null,
      2,
    ),
  );
  console.log(
    "PASS widget current-page guidance and controlled real-DOM workflows; " +
      (process.argv.includes("--live")
        ? "actual configured worker/model"
        : "stubbed guidance protocol"),
  );
} finally {
  await browser.close();
}

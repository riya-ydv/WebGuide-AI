import { createServer } from "node:net";
import { spawn } from "node:child_process";
import { chromium } from "playwright";
import assert from "node:assert/strict";
const reservation = createServer();
await new Promise((resolve, reject) => { reservation.once("error", reject); reservation.listen(0, "127.0.0.1", resolve); });
const port = reservation.address().port;
await new Promise((resolve) => reservation.close(resolve));
const child = spawn(process.execPath, [".output/server/index.mjs"], {
  env: { ...process.env, PORT: String(port), HOST: "127.0.0.1", NODE_ENV: "production" },
  stdio: "pipe",
  windowsHide: true,
});
let logs = "";
child.stdout.on("data", (b) => (logs += b));
child.stderr.on("data", (b) => (logs += b));
let browser;
try {
  let ready = false;
  for (let i = 0; i < 60; i++) {
    if (child.exitCode !== null) throw Error("Production server exited: " + logs);
    try {
      const r = await fetch(`http://127.0.0.1:${port}`);
      if (r.ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  assert(ready, "Production server did not start");
  browser = await chromium.launch({ headless: true, chromiumSandbox: true });
  const c = await browser.newContext();
  const p = await c.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  let forbidden = 0;
  await p.route("**/*", async (route) => {
    const u = route.request().url();
    if (u.startsWith("https://webguide.test")) {
      const response = await route.fetch({
        url: u.replace("https://webguide.test", `http://127.0.0.1:${port}`),
      });
      await route.fulfill({ response });
    } else {
      forbidden++;
      await route.abort();
    }
  });
  await p.goto("https://webguide.test", { waitUntil: "networkidle" });
  assert.match(await p.title(), /WebGuide AI/);
  assert.equal(
    await p.evaluate(() => typeof window.WebGuidePageAssistance?.capture),
    "function",
    "Shared guidance core must survive production tree shaking",
  );
  await p.getByRole("navigation").getByRole("button", { name: "Explorer", exact: true }).click();
  await p.getByText("Connection settings and AI check", { exact: true }).click();
  await p.getByLabel("Backend URL", { exact: true }).waitFor();
  assert.equal(await p.getByLabel("Backend URL", { exact: true }).inputValue(), "");
  assert.equal(await p.getByLabel("Worker access token", { exact: true }).inputValue(), "");
  assert.equal(forbidden, 0);
  assert.deepEqual(errors, []);
  const download = await fetch(`http://127.0.0.1:${port}/webguide-companion.zip`);
  assert.equal(download.status, 200);
  const bytes = new Uint8Array(await download.arrayBuffer());
  assert.equal(String.fromCharCode(...bytes.slice(0, 2)), "PK");
  console.log(
    "PASS Node production HTTP200, hosted-origin UI, no localhost/backend leak, extension ZIP download and no browser errors",
  );
} finally {
  await browser?.close();
  child.kill();
}

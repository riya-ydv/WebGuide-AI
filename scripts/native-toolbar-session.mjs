import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
const profile = await fs.mkdtemp(path.resolve("artifacts/toolbar-e2e-"));
const extension = path.resolve("browser-extension");
const context = await chromium.launchPersistentContext(profile, {
  channel: "chromium",
  headless: false,
  args: [
    `--disable-extensions-except=${extension}`,
    `--load-extension=${extension}`,
    "--remote-debugging-port=9231",
  ],
  viewport: { width: 1280, height: 900 },
});
await context.pages()[0].goto("http://127.0.0.1:4320/demo-service.html");
console.log("Isolated toolbar test browser ready on CDP9231");
await new Promise((resolve) => context.on("close", resolve));

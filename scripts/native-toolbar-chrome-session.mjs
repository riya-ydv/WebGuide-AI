import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
const profile = process.argv[2]
  ? path.resolve(process.argv[2])
  : await fs.mkdtemp(path.resolve("artifacts/toolbar-e2e-"));
if (!profile.startsWith(path.resolve("artifacts") + path.sep))
  throw Error("Use a test profile inside artifacts");
const context = await chromium.launchPersistentContext(profile, {
  channel: "chrome",
  headless: false,
  chromiumSandbox: true,
  ignoreDefaultArgs: ["--disable-extensions"],
  args: ["--remote-debugging-port=9232"],
  viewport: { width: 1280, height: 900 },
});
await context
  .pages()[0]
  .goto("http://127.0.0.1:4320/demo-service.html", { waitUntil: "domcontentloaded" });
console.log("Toolbar test browser ready on CDP9232; profile " + path.basename(profile));
await new Promise((resolve) => context.on("close", resolve));

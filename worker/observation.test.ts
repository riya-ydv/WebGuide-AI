import { test } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { observe } from "./observation.js";
test(
  "real rendered observation excludes zero-size/hidden controls and preserves target identity after layout changes",
  { timeout: 30000 },
  async () => {
    const server = await chromium.launchServer({ headless: true, chromiumSandbox: true });
    try {
      const browser = await chromium.connect(server.wsEndpoint());
      const page = await browser.newPage();
      await page.setContent(
        '<title>Observation regression</title><button id="first">First</button><button id="second">Second</button><button style="visibility:hidden">Hidden</button><a style="display:block;width:0;height:0;overflow:hidden">Zero size</a><button style="opacity:0">Transparent</button>',
      );
      const before = await observe(page, "before");
      assert.deepEqual(
        before.controls.map((c) => c.label),
        ["First", "Second"],
      );
      await page.locator("#first").evaluate((el) => el.remove());
      const after = await observe(page, "after");
      assert.equal(after.controls.length, 1);
      assert.equal(after.controls[0]?.id, before.controls[1]?.id);
    } finally {
      await server.kill();
    }
  },
);

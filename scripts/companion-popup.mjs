import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
const profile = await fs.mkdtemp(path.resolve("artifacts/native-popup-"));
const extension = path.resolve("browser-extension");
const context = await chromium.launchPersistentContext(profile, {
  channel: "chromium",
  headless: true,
  args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
});
try {
  const worker = context.serviceWorkers()[0] || (await context.waitForEvent("serviceworker"));
  const page = context.pages()[0];
  await page.goto("http://127.0.0.1:4320/demo-service.html");
  const cdp = await context.newCDPSession(page);
  await worker.evaluate(() => chrome.action.openPopup());
  await page.waitForTimeout(500);
  const target = (await cdp.send("Target.getTargets")).targetInfos.find((t) =>
    t.url.endsWith("/popup.html"),
  );
  assert(target, "Actual action popup exists");
  const { sessionId } = await cdp.send("Target.attachToTarget", {
    targetId: target.targetId,
    flatten: false,
  });
  let seq = 0;
  async function call(method, params = {}) {
    const id = ++seq;
    const result = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(Error("CDP timeout")), 10000);
      const handler = (e) => {
        const m = JSON.parse(e.message);
        if (e.sessionId === sessionId && m.id === id) {
          clearTimeout(timeout);
          cdp.off("Target.receivedMessageFromTarget", handler);
          m.error ? reject(Error(m.error.message)) : resolve(m.result);
        }
      };
      cdp.on("Target.receivedMessageFromTarget", handler);
    });
    await cdp.send("Target.sendMessageToTarget", {
      sessionId,
      message: JSON.stringify({ id, method, params }),
    });
    return result;
  }
  const measure = async () =>
    JSON.parse(
      (
        await call("Runtime.evaluate", {
          expression:
            "JSON.stringify({width:innerWidth,htmlWidth:document.documentElement.getBoundingClientRect().width,scrollWidth:document.documentElement.scrollWidth,bodyWidth:document.body.getBoundingClientRect().width})",
          returnByValue: true,
        })
      ).result.value,
    );
  const collapsed = await measure();
  assert.equal(collapsed.htmlWidth, 390, "Actual popup has a stable 390px layout width");
  assert(
    collapsed.width >= 390 && collapsed.scrollWidth <= collapsed.width,
    "Popup fits horizontally",
  );
  await call("Runtime.evaluate", { expression: 'document.querySelector("details").open=true' });
  await page.waitForTimeout(300);
  const expanded = await measure();
  assert(expanded.scrollWidth <= expanded.width, "Expanded connection controls do not overflow");
  await call("Runtime.evaluate", { expression: 'document.documentElement.style.zoom="1.25"' });
  await page.waitForTimeout(300);
  const zoomed = await measure();
  assert(zoomed.scrollWidth <= zoomed.width, "Zoomed popup retains horizontal fit");
  await call("Runtime.evaluate", {
    expression:
      'document.documentElement.style.zoom="1";document.querySelector("details").open=false',
  });
  await page.waitForTimeout(300);
  await fs.writeFile(
    "artifacts/companion-popup-layout.json",
    JSON.stringify({ collapsed, expanded, zoomed }, null, 2),
  );
  console.log(
    "PASS actual extension popup stable width, expanded connection and 125% CSS zoom layout",
  );
  const popupCapture = await call("Page.captureScreenshot", { format: "png" });
  await fs.writeFile(
    "artifacts/companion-popup-current.png",
    Buffer.from(popupCapture.data, "base64"),
  );
  const position = await call("Runtime.evaluate", {
    expression:
      'JSON.stringify((()=>{const r=document.querySelector("#open").getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})())',
    returnByValue: true,
  });
  const pos = JSON.parse(position.result.value);
  await call("Input.dispatchMouseEvent", {
    type: "mousePressed",
    button: "left",
    clickCount: 1,
    ...pos,
  });
  await call("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    button: "left",
    clickCount: 1,
    ...pos,
  });
  await page.waitForTimeout(1200);
  const status = await call("Runtime.evaluate", {
    expression: 'document.querySelector("#status").textContent',
    returnByValue: true,
  });
  console.log("Native popup status:", status.result.value);
  assert.equal(
    await page.locator("#webguide-companion").count(),
    0,
    "Programmatic popup cannot bypass activeTab",
  );
  assert.match(status.result.value, /pinned extension icon/);
  console.log(
    "PASS actual native action popup and safe missing-activeTab error via trusted CDP input; physical toolbar grant, microphone and optional worker permission require manual verification",
  );
} finally {
  await context.close();
}

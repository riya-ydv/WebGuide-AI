import { parseEnv } from "node:util";
import { normalizeEnvironment } from "../shared/environment.mjs";
import { chromium } from "playwright";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
const b = await chromium.connectOverCDP("http://127.0.0.1:9232");
const context = b.contexts()[0];
const page = context.pages().find((p) => p.url().startsWith("https://evisionindia.com/"));
assert(page, "External test tab exists");
assert.equal(await page.locator("#webguide-companion").count(), 1, "Real toolbar injected dock");
const cdp = await context.newCDPSession(page);
const target = (await cdp.send("Target.getTargets")).targetInfos.find((t) =>
  t.url.endsWith("/popup.html"),
);
assert(target, "Open the toolbar popup first");
const { sessionId } = await cdp.send("Target.attachToTarget", {
  targetId: target.targetId,
  flatten: false,
});
let seq = 0;
async function call(method, params = {}) {
  const id = ++seq;
  const result = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error("Popup CDP timeout")), 10000);
    const handler = (e) => {
      const m = JSON.parse(e.message);
      if (e.sessionId === sessionId && m.id === id) {
        clearTimeout(timer);
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
const token = normalizeEnvironment(
  parseEnv(await fs.readFile(".env", "utf8")),
).WEBGUIDE_WORKER_TOKEN;
assert(token);
await call("Runtime.evaluate", {
  expression: `document.querySelector('details').open=true; document.querySelector('#endpoint').value='http://127.0.0.1:4318'; document.querySelector('#token').value=${JSON.stringify(token)}; document.querySelector('#connect').scrollIntoView(); void 0`,
});
const position = await call("Runtime.evaluate", {
  expression: `JSON.stringify((()=>{const r=document.querySelector('#connect').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})())`,
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
console.log(
  "Connection requested through real popup; inspect Chrome permission prompt. No token output.",
);
await cdp.detach();

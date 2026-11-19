import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";
import { webcrypto } from "node:crypto";
const source = await readFile("browser-extension/background.js", "utf8");
const data = {};
const origins = new Set();
let fetches = 0;
let level;
const id = "nnodbcjnbbdbbdakdhppclfbblcmjejl";
function boot() {
  const listeners = {};
  const event = (name) => ({
    addListener(fn) {
      listeners[name] = fn;
    },
  });
  const chrome = {
    runtime: { id, getURL: (p) => `chrome-extension://${id}/${p}`, onMessage: event("message") },
    storage: {
      session: {
        async setAccessLevel(o) {
          level = o.accessLevel;
        },
        async get(k) {
          return k === null ? structuredClone(data) : { [k]: structuredClone(data[k]) };
        },
        async set(o) {
          Object.assign(data, structuredClone(o));
        },
        async remove(k) {
          delete data[k];
        },
      },
    },
    permissions: {
      async contains(o) {
        return o.origins.every((v) => origins.has(v));
      },
      onAdded: event("added"),
      onRemoved: event("removed"),
    },
    tabs: {
      async get() {
        return { url: "https://example.com/" };
      },
      onRemoved: event("tabremoved"),
    },
    scripting: { async executeScript() {} },
  };
  const context = vm.createContext({
    chrome,
    importScripts() {},
    URL,
    Map,
    crypto: webcrypto,
    AbortSignal,
    AbortController,
    setTimeout,
    clearTimeout,
    fetch: async () => {
      fetches++;
      return { ok: true, body: { async cancel() {} } };
    },
    WebGuidePageAssistance: {
      async requestGuidance() {
        return { steps: [] };
      },
    },
  });
  vm.runInContext(source, context);
  const send = (message, sender = { id, url: `chrome-extension://${id}/popup.html` }) =>
    new Promise((resolve) => {
      const kept = listeners.message(message, sender, resolve);
      if (!kept) resolve(null);
    });
  return { listeners, send };
}
let worker = boot();
const token = "x".repeat(40);
let reply = await worker.send({
  type: "WEBGUIDE_STAGE_CONNECT",
  tabId: 1,
  endpoint: "https://worker.example",
  token,
});
assert.equal(reply.data.pending, true);
assert.equal(fetches, 0);
assert.equal(level, "TRUSTED_CONTEXTS");
// Popup and service worker can vanish before browser permission arrives.
worker = boot();
origins.add("https://worker.example/*");
worker.listeners.added();
for (let i = 0; i < 30 && data["webguide-tab-1"]?.status !== "connected"; i++)
  await new Promise((r) => setTimeout(r, 2));
reply = await worker.send({ type: "WEBGUIDE_CONNECT_STATUS", tabId: 1 });
assert.equal(reply.data.connected, true);
assert(!JSON.stringify(reply).includes(token));
assert.equal(data["webguide-tab-1"].expiresAt, undefined);
assert.equal(
  await worker.send(
    { type: "WEBGUIDE_CONNECT_STATUS", tabId: 1 },
    { id: "untrusted", url: "https://example.com" },
  ),
  null,
);
reply = await worker.send(
  { type: "WEBGUIDE_STAGE_CONNECT", tabId: 1, endpoint: "https://worker.example", token },
  { id, url: "https://example.com/", tab: { id: 1 } },
);
assert.equal(reply.ok, false);
reply = await worker.send(
  { type: "WEBGUIDE_GUIDANCE", request: { context: { url: "https://other.example" } } },
  { id, url: "https://example.com/", tab: { id: 1 } },
);
assert.equal(reply.ok, false);
origins.clear();
worker.listeners.removed();
await new Promise((r) => setTimeout(r, 5));
assert.equal(data["webguide-tab-1"], undefined);
console.log(
  "PASS pending setup survives popup/worker loss, permission event completes setup, protected session, no status token disclosure, sender/context rejection, permission revocation cleanup",
);

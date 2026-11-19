/* global chrome, importScripts */
importScripts("page-assistance.js");
const requests = new Map();
const connecting = new Map();
const sessionReady = chrome.storage.session.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });
const key = (tabId) => `webguide-tab-${tabId}`;
async function read(tabId) {
  await sessionReady;
  const record = (await chrome.storage.session.get(key(tabId)))[key(tabId)];
  if (record?.status === "pending" && Date.now() > record.expiresAt) {
    await chrome.storage.session.remove(key(tabId));
    return null;
  }
  return record || null;
}
async function write(tabId, record) {
  await sessionReady;
  await chrome.storage.session.set({ [key(tabId)]: record });
}
async function clear(tabId) {
  requests.get(tabId)?.abort();
  requests.delete(tabId);
  connecting.delete(tabId);
  await sessionReady;
  await chrome.storage.session.remove(key(tabId));
}
function endpointUrl(raw) {
  const url = new URL(raw);
  if (
    url.protocol !== "https:" &&
    !(url.protocol === "http:" && ["127.0.0.1", "localhost"].includes(url.hostname))
  )
    throw new Error("Use HTTPS or a loopback worker endpoint.");
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/")
    throw new Error("Use only the worker origin, without a path, credentials or query.");
  return url;
}
async function finishConnection(tabId) {
  const record = await read(tabId);
  if (!record || record.status !== "pending" || connecting.has(tabId)) return;
  if (!(await chrome.permissions.contains({ origins: [`${new URL(record.endpoint).origin}/*`] })))
    return;
  if (connecting.has(tabId)) return;
  connecting.set(tabId, record.nonce);
  try {
    const headers = { Authorization: `Bearer ${record.token}` };
    for (const route of ["/health", "/jobs?limit=1"]) {
      const response = await fetch(new URL(route, record.endpoint), {
        headers,
        signal: AbortSignal.timeout(10000),
        redirect: "error",
        credentials: "omit",
        cache: "no-store",
      });
      await response.body?.cancel();
      if (!response.ok)
        throw new Error(
          response.status === 401
            ? "Worker access token was rejected."
            : "Worker connection failed. Check its URL and allowed origins.",
        );
    }
    const current = await read(tabId);
    if (current?.nonce !== record.nonce) return;
    const connected = {
      ...record,
      status: "connected",
      message: "Worker connected for this browser session.",
    };
    delete connected.expiresAt;
    await write(tabId, connected);
  } catch (error) {
    if ((await read(tabId))?.nonce === record.nonce)
      await write(tabId, {
        status: "error",
        nonce: record.nonce,
        endpoint: record.endpoint,
        message: error.message || "Worker connection failed.",
      });
  } finally {
    if (connecting.get(tabId) === record.nonce) connecting.delete(tabId);
  }
}
async function resumePending() {
  await sessionReady;
  const all = await chrome.storage.session.get(null);
  await Promise.all(
    Object.keys(all)
      .filter((name) => /^webguide-tab-\d+$/.test(name))
      .map(async (name) => {
        const tabId = Number(name.slice("webguide-tab-".length));
        const record = await read(tabId);
        if (record?.status === "pending") await finishConnection(tabId);
      }),
  );
}
chrome.permissions.onAdded.addListener(() => {
  void resumePending();
});
chrome.permissions.onRemoved.addListener(() => {
  void (async () => {
    await sessionReady;
    const all = await chrome.storage.session.get(null);
    for (const name of Object.keys(all).filter((item) => /^webguide-tab-\d+$/.test(item))) {
      const record = all[name];
      if (
        record.endpoint &&
        !(await chrome.permissions.contains({ origins: [`${new URL(record.endpoint).origin}/*`] }))
      )
        await clear(Number(name.slice("webguide-tab-".length)));
    }
  })();
});
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id) return false;
  (async () => {
    const popup = sender.url === chrome.runtime.getURL("popup.html");
    if (
      [
        "WEBGUIDE_STAGE_CONNECT",
        "WEBGUIDE_CONNECT_STATUS",
        "WEBGUIDE_CANCEL_CONNECT",
        "WEBGUIDE_OPEN",
      ].includes(message?.type)
    ) {
      if (!popup) throw new Error("Use the extension toolbar popup for setup.");
      if (!Number.isInteger(message.tabId)) throw new Error("Choose a website tab first.");
      const tab = await chrome.tabs.get(message.tabId);
      if (!/^https?:\/\//.test(tab.url || ""))
        throw new Error("Open an ordinary HTTP or HTTPS website first.");
      if (message.type === "WEBGUIDE_STAGE_CONNECT") {
        const url = endpointUrl(message.endpoint);
        if (
          typeof message.token !== "string" ||
          message.token.length < 32 ||
          message.token.length > 512 ||
          /\s/.test(message.token)
        )
          throw new Error("Enter a worker access token of 32 to 512 characters.");
        await clear(message.tabId);
        await write(message.tabId, {
          status: "pending",
          endpoint: url.href,
          token: message.token,
          nonce: crypto.randomUUID(),
          expiresAt: Date.now() + 120000,
        });
        await finishConnection(message.tabId);
        return { pending: (await read(message.tabId))?.status === "pending" };
      }
      if (message.type === "WEBGUIDE_CANCEL_CONNECT") {
        await clear(message.tabId);
        return { connected: false };
      }
      if (message.type === "WEBGUIDE_CONNECT_STATUS") {
        await finishConnection(message.tabId);
        const record = await read(message.tabId);
        return {
          connected: record?.status === "connected",
          pending: record?.status === "pending",
          endpoint: record?.endpoint || "",
          message:
            record?.message ||
            (record?.status === "pending"
              ? "Waiting for worker-origin permission. Reopen this popup after allowing it."
              : "AI not connected. Reading and navigation work without a worker."),
        };
      }
      await chrome.scripting.executeScript({
        target: { tabId: message.tabId },
        files: ["page-assistance.js", "companion.js"],
      });
      return { opened: true };
    }
    const tabId = sender.tab?.id;
    if (!Number.isInteger(tabId)) throw new Error("Use the companion on the current website.");
    if (message?.type === "WEBGUIDE_CONNECTION")
      return { connected: (await read(tabId))?.status === "connected" };
    if (message?.type === "WEBGUIDE_CANCEL") {
      requests.get(tabId)?.abort();
      requests.delete(tabId);
      return { cancelled: true };
    }
    if (message?.type === "WEBGUIDE_DISCONNECT") {
      await clear(tabId);
      return { connected: false };
    }
    if (message?.type !== "WEBGUIDE_GUIDANCE") throw new Error("Unsupported companion request.");
    const connection = await read(tabId);
    if (connection?.status !== "connected")
      throw new Error(
        "AI is not connected. Open the WebGuide toolbar popup and connect your worker. Reading and navigation work without AI.",
      );
    if (requests.has(tabId)) throw new Error("A guidance request is already running for this tab.");
    const request = message.request;
    if (!request?.context || new URL(request.context.url).origin !== new URL(sender.url).origin)
      throw new Error("Context must belong to the requesting website.");
    const controller = new AbortController();
    requests.set(tabId, controller);
    const timer = setTimeout(() => controller.abort(), 65000);
    try {
      const result = await globalThis.WebGuidePageAssistance.requestGuidance({
        ...request,
        endpoint: connection.endpoint,
        token: connection.token,
        signal: controller.signal,
      });
      if (controller.signal.aborted || (await read(tabId))?.nonce !== connection.nonce)
        throw new Error("Guidance connection changed. Ask again using the new connection.");
      return result;
    } finally {
      clearTimeout(timer);
      if (requests.get(tabId) === controller) requests.delete(tabId);
    }
  })().then(
    (data) => respond({ ok: true, data }),
    (error) =>
      respond({
        ok: false,
        error:
          error?.name === "AbortError"
            ? "Guidance cancelled or timed out."
            : error.message || "Companion request failed.",
      }),
  );
  return true;
});
chrome.tabs.onRemoved.addListener((tabId) => {
  void clear(tabId);
});
void resumePending();

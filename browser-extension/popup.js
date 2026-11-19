/* global chrome */
const status = document.getElementById("status");
let tabId;
async function send(message) {
  const result = await chrome.runtime.sendMessage(message);
  if (!result?.ok) throw new Error(result?.error || "Extension did not respond.");
  return result.data;
}
async function refreshConnection() {
  if (!tabId) return;
  const connection = await send({ type: "WEBGUIDE_CONNECT_STATUS", tabId });
  status.textContent = connection.message;
  if (connection.endpoint && !document.getElementById("endpoint").value)
    document.getElementById("endpoint").value = connection.endpoint;
}
chrome.tabs
  .query({ active: true, currentWindow: true })
  .then(async (tabs) => {
    tabId = tabs[0]?.id;
    if (!tabId) throw new Error("Choose an ordinary website tab first.");
    await refreshConnection();
  })
  .catch((error) => {
    status.textContent = error.message;
  });
document.getElementById("extension-origin").textContent = `chrome-extension://${chrome.runtime.id}`;
document.getElementById("open").onclick = async () => {
  try {
    if (!tabId) throw new Error("Choose a website tab first.");
    await send({ type: "WEBGUIDE_OPEN", tabId });
    status.textContent = "Companion opened. Close this popup to use it on the page.";
  } catch {
    status.textContent =
      "This page could not be opened. Click the pinned extension icon on an ordinary website, then choose Open companion. Browser settings, extension stores and protected viewers remain restricted.";
  }
};
document.getElementById("connect").onclick = async () => {
  const button = document.getElementById("connect");
  button.disabled = true;
  try {
    if (!tabId) throw new Error("Choose a website tab first.");
    const url = new URL(document.getElementById("endpoint").value);
    if (
      url.protocol !== "https:" &&
      !(url.protocol === "http:" && ["127.0.0.1", "localhost"].includes(url.hostname))
    )
      throw new Error("Use HTTPS or a loopback worker URL.");
    if (url.username || url.password || url.search || url.hash || url.pathname !== "/")
      throw new Error("Use only the worker origin, without credentials or a path.");
    const token = document.getElementById("token").value;
    if (token.length < 32 || token.length > 512 || /\s/.test(token))
      throw new Error("Enter a worker access token of 32 to 512 characters.");
    // Start both calls inside the user gesture. Background staging survives popup closure.
    const staged = send({ type: "WEBGUIDE_STAGE_CONNECT", tabId, endpoint: url.href, token });
    const permission = chrome.permissions.request({ origins: [`${url.origin}/*`] });
    document.getElementById("token").value = "";
    status.textContent =
      "Allow access to your worker. If Chrome closes this popup, reopen it to see connection status.";
    const [granted] = await Promise.all([permission, staged]);
    if (!granted) {
      await send({ type: "WEBGUIDE_CANCEL_CONNECT", tabId });
      throw new Error("Worker permission declined. Reading and navigation still work.");
    }
    await refreshConnection();
  } catch (error) {
    status.textContent = error.message || "Could not connect worker.";
  } finally {
    button.disabled = false;
  }
};

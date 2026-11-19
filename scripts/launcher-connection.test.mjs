import { test } from "node:test";
import http from "node:http";
import assert from "node:assert/strict";
import { createLauncherConnection } from "./launcher-connection.mjs";
const token = "x".repeat(64);
async function setup(ttlMs = 90000) {
  const bridge = await createLauncherConnection({ workerToken: token, ttlMs });
  const [port, nonce] = new URL(bridge.url).hash.split("=")[1].split(".");
  return { ...bridge, port, nonce };
}
function post(b, overrides = {}) {
  return fetch(`http://127.0.0.1:${b.port}/connect`, {
    method: "POST",
    headers: {
      Origin: "http://127.0.0.1:4320",
      "Content-Type": "application/json",
      ...overrides.headers,
    },
    body: JSON.stringify({ nonce: b.nonce }),
    ...overrides,
  });
}
test("only exact origin nonce can redeem once; no durable token in URL", async () => {
  const b = await setup();
  try {
    assert(!b.url.includes(token));
    const bad = await post(b, { body: JSON.stringify({ nonce: "f".repeat(64) }) });
    assert.equal(bad.status, 403);
    const foreign = await post(b, {
      headers: { Origin: "https://foreign.test", "Content-Type": "application/json" },
    });
    assert.equal(foreign.status, 403);
    const hostStatus = await new Promise((resolve, reject) => {
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port: Number(b.port),
          path: "/connect",
          method: "POST",
          headers: {
            Origin: "http://127.0.0.1:4320",
            Host: "localhost:" + b.port,
            "Content-Type": "application/json",
          },
        },
        (res) => {
          res.resume();
          resolve(res.statusCode);
        },
      );
      req.on("error", reject);
      req.end(JSON.stringify({ nonce: b.nonce }));
    });
    assert.equal(hostStatus, 403);
    const response = await post(b);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual(await response.json(), { endpoint: "http://127.0.0.1:4318", token });
    assert.equal((await post(b)).status, 410);
    await b.done;
    await assert.rejects(() => post(b));
    await b.done;
  } finally {
    await b.close();
  }
});
test("rejects oversized bodies, simple-content CSRF and paths", async () => {
  const b = await setup();
  try {
    assert.equal((await post(b, { body: "x".repeat(300) })).status, 413);
    assert.equal(
      (
        await post(b, {
          headers: { Origin: "http://127.0.0.1:4320", "Content-Type": "text/plain" },
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await fetch(`http://127.0.0.1:${b.port}/other`, {
          headers: { Origin: "http://127.0.0.1:4320" },
        })
      ).status,
      404,
    );
  } finally {
    await b.close();
  }
});
test("expires and closes loopback endpoint", async () => {
  const b = await setup(20);
  try {
    await new Promise((resolve) => setTimeout(resolve, 50));
    await assert.rejects(() => post(b));
    await b.done;
  } finally {
    await b.close();
  }
});

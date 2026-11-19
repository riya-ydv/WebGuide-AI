import http from "node:http";
import { randomBytes, timingSafeEqual } from "node:crypto";
export async function createLauncherConnection({ workerToken, ttlMs = 90000 }) {
  if (
    typeof workerToken !== "string" ||
    workerToken.length < 32 ||
    workerToken.length > 512 ||
    /\s/.test(workerToken)
  )
    throw Error("Invalid launcher worker credential.");
  if (!Number.isFinite(ttlMs)) throw Error("Invalid launcher connection lifetime.");
  const nonce = randomBytes(32).toString("hex");
  let used = false;
  const expires = Date.now() + Math.min(Math.max(ttlMs, 1), 90000);
  let port = 0;
  const server = http.createServer(async (req, res) => {
    const origin = "http://127.0.0.1:4320";
    const allowed =
      req.headers.host === `127.0.0.1:${port}` &&
      req.headers.origin === origin &&
      req.socket.remoteAddress === "127.0.0.1";
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Content-Type-Options", "nosniff");
    function end(status, body = { error: "Local connection unavailable." }) {
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(body));
    }
    if (!allowed) {
      end(403);
      return;
    }
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    if (req.url !== "/connect") {
      end(404);
      return;
    }
    if (req.method === "OPTIONS") {
      if (
        req.headers["access-control-request-method"] !== "POST" ||
        req.headers["access-control-request-headers"]?.toLowerCase() !== "content-type"
      ) {
        end(403);
        return;
      }
      res.setHeader("Access-Control-Allow-Methods", "POST");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      res.writeHead(204);
      res.end();
      return;
    }
    if (
      req.method !== "POST" ||
      req.headers["content-type"] !== "application/json" ||
      (req.headers["sec-fetch-site"] && req.headers["sec-fetch-site"] !== "same-site")
    ) {
      end(403);
      return;
    }
    if (used || Date.now() >= expires) {
      end(410);
      return;
    }
    if (Number(req.headers["content-length"] || 0) > 256) {
      end(413);
      return;
    }
    let body = "";
    try {
      for await (const chunk of req) {
        body += chunk.toString("utf8");
        if (Buffer.byteLength(body) > 256) {
          end(413);
          return;
        }
      }
    } catch {
      end(400);
      return;
    }
    let value;
    try {
      value = JSON.parse(body);
    } catch {
      end(400);
      return;
    }
    if (
      !value ||
      Object.keys(value).length !== 1 ||
      typeof value.nonce !== "string" ||
      !/^[a-f0-9]{64}$/.test(value.nonce) ||
      !timingSafeEqual(Buffer.from(value.nonce), Buffer.from(nonce))
    ) {
      end(403);
      return;
    }
    if (used || Date.now() >= expires) {
      end(410);
      return;
    }
    used = true;
    res.once("finish", () => {
      const retire = setTimeout(() => {
        void close();
      }, 250);
      retire.unref();
    });
    end(200, { endpoint: "http://127.0.0.1:4318", token: workerToken });
  });
  const done = new Promise((resolve) => server.once("close", resolve));
  server.requestTimeout = 5000;
  server.headersTimeout = 5000;
  server.maxHeadersCount = 20;
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  port = server.address().port;
  const close = () =>
    new Promise((resolve) => {
      server.closeAllConnections();
      server.close(() => resolve());
    });
  const expiry = setTimeout(
    () => {
      void close();
    },
    Math.max(1, expires - Date.now()),
  );
  expiry.unref();
  return {
    url: `http://127.0.0.1:4320/#webguide-connect=${port}.${nonce}`,
    done,
    close: () => {
      clearTimeout(expiry);
      return close();
    },
  };
}

import { normalizeEnvironment } from "../shared/environment.mjs";
import { isIP } from "node:net";
import { resolve } from "node:path";

export function workerConfiguration(input = process.env) {
  const env = normalizeEnvironment(input);
  const hosted = env["WEBGUIDE_WORKER_MODE"] === "hosted";
  const host = env["WEBGUIDE_WORKER_HOST"] || (hosted ? "0.0.0.0" : "127.0.0.1");
  if (!isIP(host)) throw new Error("WEBGUIDE_WORKER_HOST must be an IP bind address");
  const port = Number(env["PORT"] || env["WEBGUIDE_WORKER_PORT"] || (hosted ? 8080 : 4318));
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid worker port");
  const token = env["WEBGUIDE_WORKER_TOKEN"] || "";
  if (token.length < 32 || token.length > 512 || /\s/.test(token) || token.startsWith("replace-"))
    throw new Error("Set a random worker token of 32 to 512 non-whitespace characters");
  if (!hosted && !["127.0.0.1", "::1"].includes(host))
    throw new Error("Non-loopback binding requires WEBGUIDE_WORKER_MODE=hosted");
  const hosts =
    env["WEBGUIDE_ALLOWED_HOSTS"] || (hosted ? "" : `127.0.0.1:${port},localhost:${port}`);
  const origins =
    env["WEBGUIDE_ALLOWED_ORIGINS"] ||
    (hosted
      ? ""
      : "http://127.0.0.1:4320,http://localhost:4320,chrome-extension://nnodbcjnbbdbbdakdhppclfbblcmjejl");
  if (!hosts || !origins)
    throw new Error(
      "Hosted mode requires explicit WEBGUIDE_ALLOWED_HOSTS and WEBGUIDE_ALLOWED_ORIGINS",
    );
  const allowedHosts = new Set(
    hosts.split(",").map((value) => {
      const name = value.trim().toLowerCase();
      const url = new URL(`https://${name}`);
      if (
        !name ||
        url.host !== name ||
        url.username ||
        url.password ||
        url.pathname !== "/" ||
        /[*\s]/.test(name)
      )
        throw new Error(
          "Allowed hosts must be exact host[:port] values without schemes or wildcards",
        );
      return name;
    }),
  );
  const allowedOrigins = new Set(
    origins.split(",").map((value) => {
      const origin = value.trim();
      // Extension service-worker POSTs carry this origin. Node's URL.origin is
      // "null" for the scheme, so validate the complete exact Chrome ID instead.
      if (/^chrome-extension:\/\/[a-p]{32}$/.test(origin)) return origin;
      const url = new URL(origin);
      const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
      if (
        url.origin !== origin ||
        url.username ||
        url.password ||
        !(url.protocol === "https:" || (local && url.protocol === "http:"))
      )
        throw new Error(
          "Allowed origins must be exact HTTPS origins, loopback HTTP, or chrome-extension:// followed by an exact 32-character Chrome extension ID",
        );
      return origin;
    }),
  );
  const retention = Math.max(
    60000,
    Math.min(Number(env["WEBGUIDE_RETENTION_MS"]) || 3600000, 86400000),
  );
  const configuredDataDir = env["WEBGUIDE_DATA_DIR"];
  if (hosted && !configuredDataDir)
    throw new Error("Hosted mode requires WEBGUIDE_DATA_DIR on a private persistent volume");
  const dataDir = configuredDataDir || resolve(".webguide-local", "data");
  const sandboxOrigin = env["WEBGUIDE_SANDBOX_ORIGIN"];
  if (sandboxOrigin && sandboxOrigin !== "http://127.0.0.1:4319")
    throw new Error("Only the controlled loopback fixture on port 4319 may enable sandbox actions");
  return {
    hosted,
    host,
    port,
    token,
    allowedHosts,
    allowedOrigins,
    retention,
    dataDir,
    sandboxOrigin,
  };
}

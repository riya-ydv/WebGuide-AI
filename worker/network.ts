import dns from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import ipaddr from "ipaddr.js";

export function publicAddress(address: string): boolean {
  try {
    return ipaddr.process(address).range() === "unicast";
  } catch {
    return false;
  }
}
export function cleanUrl(raw: string) {
  const u = new URL(raw);
  u.search = "";
  u.hash = "";
  return u.toString();
}
export async function destination(raw: string, origin: string, sandboxOrigin?: string) {
  const url = new URL(raw);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.origin !== origin
  )
    throw new Error("Destination outside authorised origin");
  const isSandbox = sandboxOrigin === url.origin;
  if (isSandbox && (url.hostname !== "127.0.0.1" || url.port !== "4319"))
    throw new Error("Sandbox must be the controlled loopback fixture on port 4319");
  const addresses = await dns.lookup(url.hostname.replace(/^\[|\]$/g, ""), { all: true });
  if (!addresses.length || (!isSandbox && addresses.some((a) => !publicAddress(a.address))))
    throw new Error("Private or reserved destination blocked");
  return { url, address: addresses[0]!, isSandbox };
}

// Resolve once and pin the socket to that approved IP. Redirects are NOT followed:
// each redirected browser request goes through this same policy again.
export async function pinnedGet(
  raw: string,
  origin: string,
  sandboxOrigin: string | undefined,
  signal: AbortSignal,
) {
  const { url, address } = await destination(raw, origin, sandboxOrigin);
  return new Promise<{ status: number; headers: Record<string, string>; body: Buffer }>(
    (resolve, reject) => {
      const transport = url.protocol === "https:" ? https : http;
      const request = transport.get(
        url,
        {
          signal,
          timeout: 8000,
          // DNS was already validated; disable Node's second family-selection lookup.
          family: address.family,
          lookup: (_host, _options, callback) => callback(null, address.address, address.family),
          headers: { "User-Agent": "WebGuide-AI-Authorised-Explorer/1.0", Accept: "*/*" },
        },
        (response) => {
          const chunks: Buffer[] = [];
          let size = 0;
          response.on("data", (chunk: Buffer) => {
            size += chunk.length;
            if (size > 2_000_000) request.destroy(new Error("Response limit"));
            else chunks.push(chunk);
          });
          response.on("error", reject);
          response.on("end", () => {
            const headers: Record<string, string> = {};
            for (const name of ["content-type", "location", "cache-control"]) {
              const value = response.headers[name];
              if (typeof value === "string") headers[name] = value;
            }
            resolve({ status: response.statusCode ?? 502, headers, body: Buffer.concat(chunks) });
          });
        },
      );
      request.on("timeout", () => request.destroy(new Error("Network timeout")));
      request.on("error", reject);
    },
  );
}

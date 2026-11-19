import { afterEach, expect, it, vi } from "vitest";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});
function location(origin = "http://127.0.0.1:4320") {
  const location = {
    origin,
    hash: "#webguide-connect=49123." + "a".repeat(64),
    pathname: "/",
    search: "",
  };
  const replaceState = vi.fn(() => {
    location.hash = "";
  });
  vi.stubGlobal("window", { location, history: { state: null, replaceState } });
  return { location, replaceState };
}
it("removes capability before any fetch and verifies fixed local worker; no storage", async () => {
  const env = location();
  const fetcher = vi.fn(async (url: string) => {
    expect(env.location.hash).toBe("");
    return new Response(
      JSON.stringify(
        url.endsWith("/connect")
          ? { endpoint: "http://127.0.0.1:4318", token: "t".repeat(64) }
          : url.endsWith("/health")
            ? { workerConnected: true, mode: "local-single-user" }
            : [],
      ),
    );
  });
  vi.stubGlobal("fetch", fetcher);
  const { consumeLauncherConnection } = await import("./launcher-connection");
  const result = await consumeLauncherConnection();
  expect(result?.endpoint).toBe("http://127.0.0.1:4318");
  expect(fetcher).toHaveBeenCalledTimes(3);
  expect(env.replaceState).toHaveBeenCalledWith(null, "", "/");
  expect(await consumeLauncherConnection()).toBeNull();
});
it("never contacts a backend on hosted origins", async () => {
  const env = location("https://app.example");
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  const { consumeLauncherConnection } = await import("./launcher-connection");
  expect(await consumeLauncherConnection()).toBeNull();
  expect(env.location.hash).toBe("");
  expect(fetcher).not.toHaveBeenCalled();
});
it("rejects a bridge-provided remote endpoint before sending any token", async () => {
  location();
  const fetcher = vi.fn(
    async () =>
      new Response(JSON.stringify({ endpoint: "https://evil.example", token: "t".repeat(64) })),
  );
  vi.stubGlobal("fetch", fetcher);
  const { consumeLauncherConnection } = await import("./launcher-connection");
  await expect(consumeLauncherConnection()).rejects.toThrow("Invalid local worker");
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it("requires authenticated worker validation", async () => {
  location();
  const fetcher = vi.fn(async (url: string) =>
    url.endsWith("/connect")
      ? new Response(JSON.stringify({ endpoint: "http://127.0.0.1:4318", token: "t".repeat(64) }))
      : new Response("{}", { status: 401 }),
  );
  vi.stubGlobal("fetch", fetcher);
  const { consumeLauncherConnection } = await import("./launcher-connection");
  await expect(consumeLauncherConnection()).rejects.toThrow();
});

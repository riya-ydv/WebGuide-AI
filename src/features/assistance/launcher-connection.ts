type LauncherConnection = { endpoint: string; token: string; health: unknown; jobs: unknown };
let pending: Promise<LauncherConnection | null> | undefined;
async function readBounded(response: Response) {
  if (!response.ok)
    throw Error(
      "Local launcher connection expired or was refused. Reopen Start WebGuide or connect manually.",
    );
  const reader = response.body?.getReader();
  if (!reader) throw Error("Local connection returned no data.");
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 65536) throw Error("Local connection response was too large.");
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
}
export function consumeLauncherConnection(): Promise<LauncherConnection | null> {
  if (pending) return pending;
  if (typeof window === "undefined" || !window.location.hash.startsWith("#webguide-connect="))
    return Promise.resolve(null);
  const fragment = window.location.hash;
  window.history.replaceState(
    window.history.state,
    "",
    window.location.pathname + window.location.search,
  );
  if (window.location.origin !== "http://127.0.0.1:4320") return Promise.resolve(null);
  const match = /^#webguide-connect=(\d{1,5})\.([a-f0-9]{64})$/.exec(fragment);
  const port = Number(match?.[1]);
  if (!match || port < 1024 || port > 65535)
    return Promise.reject(Error("Invalid local launcher connection. Reopen Start WebGuide."));
  const nonce = match[2];
  pending = (async () => {
    const options = {
      redirect: "error" as const,
      credentials: "omit" as const,
      cache: "no-store" as const,
      signal: AbortSignal.timeout(10000),
    };
    const data = await readBounded(
      await fetch(`http://127.0.0.1:${port}/connect`, {
        ...options,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nonce }),
      }),
    );
    if (
      !data ||
      typeof data !== "object" ||
      !("endpoint" in data) ||
      data.endpoint !== "http://127.0.0.1:4318" ||
      !("token" in data) ||
      typeof data.token !== "string" ||
      data.token.length < 32 ||
      data.token.length > 512 ||
      /\s/.test(data.token)
    )
      throw Error("Invalid local worker connection.");
    const headers = { Authorization: `Bearer ${data.token}` };
    const health = await readBounded(
      await fetch(`${data.endpoint}/health`, { ...options, headers }),
    );
    const jobs = await readBounded(
      await fetch(`${data.endpoint}/jobs?limit=1`, { ...options, headers }),
    );
    if (
      !health ||
      typeof health !== "object" ||
      !("workerConnected" in health) ||
      health.workerConnected !== true ||
      !("mode" in health) ||
      health.mode !== "local-single-user" ||
      !Array.isArray(jobs)
    )
      throw Error("The local worker could not be verified.");
    return { endpoint: data.endpoint, token: data.token, health, jobs };
  })();
  void pending.then(
    () => {
      pending = undefined;
    },
    () => {
      pending = undefined;
    },
  );
  return pending;
}

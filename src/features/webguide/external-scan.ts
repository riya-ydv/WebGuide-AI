import { canStartExternalScan } from "./policy";

export function requestExternalScan(url: string, workerConnected: boolean) {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { accepted: false as const, reason: "Enter a valid website URL." };
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return {
      accepted: false as const,
      reason: "Only HTTP and HTTPS website addresses are supported.",
    };
  }
  if (parsed.username || parsed.password) {
    return {
      accepted: false as const,
      reason: "Remove embedded credentials from the website address.",
    };
  }
  const workerDecision = canStartExternalScan(workerConnected);
  if (!workerDecision.allowed) return { accepted: false as const, reason: workerDecision.reason };
  return { accepted: true as const, url: `${parsed.origin}${parsed.pathname}` };
}

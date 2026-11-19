/** Canonical WebGuide settings with read-only compatibility for older local installations. */
export function normalizeEnvironment(input = {}) {
  const env = { ...input };
  const oldPrefix = "GUIDE" + "FLOW_";
  for (const [key, value] of Object.entries(input)) {
    if (!key.startsWith(oldPrefix)) continue;
    const canonical = "WEBGUIDE_" + key.slice(oldPrefix.length);
    // Explicit canonical settings, including an intentionally blank value, take precedence.
    if (env[canonical] === undefined) env[canonical] = value;
  }
  return env;
}

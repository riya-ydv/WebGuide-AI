/** Read existing workspaces without rewriting or deleting the original recovery copy. */
export function readCompatibleStorage(storage: Pick<Storage, "getItem">, key: string) {
  const current = storage.getItem(key);
  if (current !== null) return current;
  const legacyPrefix = "guide" + "flow";
  const legacyKeys: Record<string, string> = {
    "webguide-demo-v1": `${legacyPrefix}-demo-v1`,
    "webguide-workspace-v1": `${legacyPrefix}-workspace-v1`,
  };
  return legacyKeys[key] ? storage.getItem(legacyKeys[key]) : null;
}

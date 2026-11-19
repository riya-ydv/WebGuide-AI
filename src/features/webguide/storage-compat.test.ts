import { describe, expect, it } from "vitest";
import { readCompatibleStorage } from "./storage-compat";

describe("workspace storage migration", () => {
  it("preserves an old workspace and prefers an explicitly empty current value", () => {
    const entries = new Map([
      ["guide" + "flow-workspace-v1", '{"profile":{"displayName":"Existing user"}}'],
    ]);
    const storage = { getItem: (key: string) => entries.get(key) ?? null };
    expect(readCompatibleStorage(storage, "webguide-workspace-v1")).toContain("Existing user");
    entries.set("webguide-workspace-v1", "");
    expect(readCompatibleStorage(storage, "webguide-workspace-v1")).toBe("");
    expect(entries.size).toBe(2);
    expect(readCompatibleStorage(storage, "unrelated-key")).toBeNull();
  });
});

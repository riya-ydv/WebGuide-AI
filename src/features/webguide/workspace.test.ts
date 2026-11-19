import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WorkspaceSettings } from "@/components/WorkspaceSettings";
import { defaultWorkspace, parseWorkspace, validateWorkspace } from "./workspace";

afterEach(cleanup);
describe("browser workspace", () => {
  it("falls back for absent, corrupt, or unsupported storage without sharing mutable defaults", () => {
    for (const raw of [null, "{broken", JSON.stringify({ schemaVersion: 2 }), "null"])
      expect(parseWorkspace(raw)).toEqual(defaultWorkspace());
    const first = defaultWorkspace();
    first.profile.displayName = "Changed";
    expect(defaultWorkspace().profile.displayName).toBe("My profile");
  });
  it("round-trips profile, preferences, saved sites, bookmarks and completion", () => {
    const value = defaultWorkspace();
    value.profile = {
      displayName: "Jatin",
      email: "jatin@example.com",
      role: "Designer",
      workspaceName: "WebGuide AI",
      avatarColor: "teal",
    };
    value.preferences = {
      defaultInstructionMode: "refresher",
      compactLayout: true,
      reducedMotion: true,
    };
    value.savedSites = [{ id: "ev", name: "Evision India", url: "https://evisionindia.com/" }];
    value.bookmarkedTutorialIds = ["tutorial-1"];
    value.completedTutorialIds = ["tutorial-2"];
    expect(validateWorkspace(JSON.stringify(value))).toEqual(value);
  });
  it.each([
    "javascript:alert(1)",
    "data:text/plain,hello",
    "ftp://example.com",
    "https://user:password@example.com",
    "https://user@example.com",
    "not a url",
  ])("rejects unsafe saved address %s", (url) => {
    expect(() =>
      validateWorkspace(
        JSON.stringify({ ...defaultWorkspace(), savedSites: [{ id: "site", name: "Site", url }] }),
      ),
    ).toThrow();
  });
  it("accepts local HTTP fixture URLs", () => {
    expect(
      validateWorkspace(
        JSON.stringify({
          ...defaultWorkspace(),
          savedSites: [{ id: "fixture", name: "Fixture", url: "http://127.0.0.1:4319/" }],
        }),
      ).savedSites,
    ).toHaveLength(1);
  });
  it("rejects invalid imports instead of silently replacing workspace", () => {
    const value = defaultWorkspace();
    expect(() => validateWorkspace("bad json")).toThrow();
    expect(() => validateWorkspace(" ".repeat(512_001))).toThrow(/limit/);
    expect(() => validateWorkspace(JSON.stringify({ ...value, schemaVersion: 2 }))).toThrow();
    expect(() => validateWorkspace(JSON.stringify({ ...value, unexpected: true }))).toThrow();
    expect(() =>
      validateWorkspace(JSON.stringify({ ...value, bookmarkedTutorialIds: ["a", "a"] })),
    ).toThrow();
    expect(() =>
      validateWorkspace(JSON.stringify({ ...value, profile: { ...value.profile, email: "bad" } })),
    ).toThrow();
    expect(() =>
      validateWorkspace(
        JSON.stringify({ ...value, preferences: { ...value.preferences, compactLayout: "true" } }),
      ),
    ).toThrow();
  });
  it("saves profile edits and preserves unrelated workspace data", () => {
    const value = defaultWorkspace();
    value.bookmarkedTutorialIds = ["keep"];
    const onChange = vi.fn();
    render(createElement(WorkspaceSettings, { value, onChange }));
    fireEvent.change(screen.getByLabelText("Display name"), { target: { value: "  Jatin  " } });
    fireEvent.change(screen.getByLabelText("Workspace name"), {
      target: { value: "WebGuide team" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        profile: expect.objectContaining({ displayName: "Jatin", workspaceName: "WebGuide team" }),
        bookmarkedTutorialIds: ["keep"],
      }),
    );
    expect(screen.getByRole("status").textContent).toContain("saved in this browser");
  });
  it("rejects blank profile names", () => {
    const onChange = vi.fn();
    render(createElement(WorkspaceSettings, { value: defaultWorkspace(), onChange }));
    fireEvent.change(screen.getByLabelText("Display name"), { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toContain("display name");
  });
  it("submits changed preferences", () => {
    const onChange = vi.fn();
    render(
      createElement(WorkspaceSettings, {
        value: defaultWorkspace(),
        onChange,
        section: "preferences",
      }),
    );
    fireEvent.change(screen.getByLabelText("Default instruction mode"), {
      target: { value: "refresher" },
    });
    fireEvent.click(screen.getByLabelText("Compact layout"));
    fireEvent.click(screen.getByLabelText("Reduce motion"));
    fireEvent.click(screen.getByRole("button", { name: "Save preferences" }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        preferences: {
          defaultInstructionMode: "refresher",
          compactLayout: true,
          reducedMotion: true,
        },
      }),
    );
  });
});

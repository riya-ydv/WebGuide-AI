import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AccessibleDashboard, dashboardProgress } from "./AccessibleDashboard";
import { emptyWebGuideData } from "@/features/webguide/storage";
import { defaultWorkspace } from "@/features/webguide/workspace";

describe("optional evidence-based progress", () => {
  it("does not award milestones for missing guides or unverified actions", () => {
    const data = emptyWebGuideData(),
      workspace = defaultWorkspace();
    workspace.completedTutorialIds = ["deleted-guide"];
    expect(dashboardProgress(data, workspace).every((step) => !step.complete)).toBe(true);
    workspace.savedSites = [{ id: "site", name: "Example", url: "https://example.com" }];
    expect(dashboardProgress(data, workspace).map((step) => step.complete)).toEqual([
      true,
      false,
      false,
    ]);
  });
  it("keeps every main action available with progress hidden and exposes a labelled progress control", () => {
    localStorage.clear();
    const onNavigate = vi.fn();
    render(
      <AccessibleDashboard
        data={emptyWebGuideData()}
        workspace={defaultWorkspace()}
        onNavigate={onNavigate}
        aiStatus="Not checked"
      />,
    );
    expect(
      screen.getByRole("link", { name: /Open practice website.*opens a new tab/ }),
    ).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Your saved websites/ }));
    expect(onNavigate).toHaveBeenCalledWith("Saved websites");
    fireEvent.click(screen.getByRole("button", { name: "Show progress" }));
    expect(
      screen.getByRole("progressbar", { name: "Workspace milestones reached" }),
    ).toHaveAttribute("value", "0");
    expect(screen.getByRole("button", { name: "Hide progress" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(localStorage.getItem("webguide-show-progress-v1")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Hide progress" }));
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });
});

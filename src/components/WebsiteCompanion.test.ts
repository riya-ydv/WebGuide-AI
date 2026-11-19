import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WebsiteCompanion } from "./WebsiteCompanion";
afterEach(cleanup);
describe("website companion activation guidance", () => {
  it("exposes installation before website opening without a collapsed prerequisite", () => {
    render(createElement(WebsiteCompanion));
    const heading = screen.getByRole("heading", {
      name: "1. Install once in desktop Chrome or Edge",
    });
    expect(heading.closest("details")).toBeNull();
    expect(screen.getByText("The browser extension must be installed first.")).toBeInTheDocument();
    expect(screen.getByText(/On Mac, double-click the ZIP in Finder/)).toBeInTheDocument();
    expect(screen.getByText(/right-click the ZIP and choose Extract All/)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Download WebGuide browser companion" }),
    ).toHaveAttribute("download");
  });
  it("keeps a direct website link and announces activation instructions without claiming installation", () => {
    render(createElement(WebsiteCompanion));
    const link = screen.getByRole("link", { name: "Open website in a new tab" });
    expect(link).toHaveAttribute("href", "https://evisionindia.com/");
    expect(link).toHaveAttribute("target", "_blank");
    fireEvent.click(link);
    expect(screen.getByRole("status")).toHaveTextContent("Next, switch to evisionindia.com");
    expect(screen.getByRole("status")).toHaveTextContent("Open companion on this page");
    expect(screen.getByRole("status")).toHaveTextContent(
      "cannot check whether the extension is installed or active",
    );
    fireEvent.change(screen.getByRole("textbox", { name: "Website address" }), {
      target: { value: "https://example.com" },
    });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
  it("explains missing developer controls and copies the browser settings address", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    render(createElement(WebsiteCompanion));
    fireEvent.click(screen.getByText("Open browser settings and installation help"));
    expect(screen.getByRole("heading", { name: "Cannot see Load unpacked?" })).toBeInTheDocument();
    expect(screen.getByText(/You do not need Pack extension/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Copy Chrome address" }));
    expect(writeText).toHaveBeenCalledWith("chrome://extensions");
    expect(await screen.findByRole("status")).toHaveTextContent("Paste it into the address bar");
  });
  it("refuses credential-bearing addresses without announcing a new tab", () => {
    render(createElement(WebsiteCompanion));
    fireEvent.change(screen.getByRole("textbox", { name: "Website address" }), {
      target: { value: "https://user:secret@example.com" },
    });
    fireEvent.click(screen.getByRole("link", { name: "Open website in a new tab" }));
    expect(screen.getByRole("alert")).toHaveTextContent("without a username or password");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});

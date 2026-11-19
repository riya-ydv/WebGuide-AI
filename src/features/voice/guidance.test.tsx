import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { PageGuidance, type GuidanceActions } from "@/components/PageGuidance";
import { getBackendSession, setBackendSession } from "@/features/assistance/backend-session";
import { parseVoiceCommand } from "./commands";
afterEach(() => {
  cleanup();
  setBackendSession(null);
  vi.restoreAllMocks();
});
const context: PageContext = {
  url: "https://example.test/",
  title: "Practice",
  revision: "one",
  text: "Task form",
  controls: [],
  headings: [],
};
const answer: PageGuidanceResult = {
  message: "Find the task name.",
  steps: [],
  status: "guidance",
  contextRevision: "one",
};
function setup(pageAccessGranted = true, share = true) {
  setBackendSession({ endpoint: "http://localhost:4318", token: "test-only" });
  let resolve!: (value: PageGuidanceResult) => void;
  const requestGuidance = vi.fn(
    (_options: Parameters<Window["WebGuidePageAssistance"]["requestGuidance"]>[0]) =>
      new Promise<PageGuidanceResult>((done) => {
        resolve = done;
      }),
  );
  const capture = vi.fn(() => context);
  const original = window.WebGuidePageAssistance;
  window.WebGuidePageAssistance = { ...original, capture, requestGuidance };
  const announce = vi.fn();
  const ref = createRef<GuidanceActions>();
  render(
    <PageGuidance
      ref={ref}
      section="Explorer"
      pageAccessGranted={pageAccessGranted}
      language="en-IN"
      announce={announce}
      onConnect={() => {}}
    />,
  );
  fireEvent.change(screen.getByLabelText("Your website goal"), {
    target: { value: "Create a task" },
  });
  if (share)
    fireEvent.click(
      screen.getByLabelText("Allow AI guidance to receive this page for this request"),
    );
  fireEvent.click(screen.getByRole("button", { name: "Guide me" }));
  const startedAnnouncement = announce.mock.calls.map((call) => call[0]);
  announce.mockClear();
  return { resolve, announce, ref, capture, requestGuidance, startedAnnouncement };
}
describe("context guidance boundaries", () => {
  it("routes explicit natural goals without turning arbitrary text into actions", () => {
    expect(parseVoiceCommand("help me create a task")).toEqual({
      kind: "guide",
      value: "create a task",
    });
    expect(parseVoiceCommand("how do I save this task")).toEqual({
      kind: "guide",
      value: "save this task",
    });
    expect(parseVoiceCommand("repeat")).toEqual({ kind: "repeat" });
    expect(parseVoiceCommand("explain field")).toEqual({ kind: "explain" });
    expect(parseVoiceCommand("delete everything immediately")).toEqual({ kind: "unknown" });
  });
  it("uses verified memory session and current evidence", async () => {
    const test = setup();
    expect(test.requestGuidance.mock.calls[0]?.[0]).toMatchObject({
      goal: "Create a task",
      mode: "guide",
      context,
      token: "test-only",
    });
    await act(async () => test.resolve(answer));
    expect(test.announce).toHaveBeenCalledWith("Find the task name.");
    expect(screen.getByRole("button", { name: "Repeat guidance" })).toBeVisible();
  });
  it("rejects a response when page context changed", async () => {
    const test = setup();
    test.capture.mockReturnValue({ ...context, revision: "two" });
    await act(async () => test.resolve(answer));
    expect(test.announce).toHaveBeenCalledWith(
      "This page changed. Ask again so I can use the current page.",
    );
    expect(screen.queryByRole("button", { name: "Repeat guidance" })).toBeNull();
  });
  it("Stop cancels a pending request and ignores its late response", async () => {
    const test = setup();
    act(() => test.ref.current?.cancel());
    await act(async () => test.resolve(answer));
    expect(test.announce).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Repeat guidance" })).toBeNull();
  });
  it("editing the goal cancels its pending response instead of speaking old intent", async () => {
    const test = setup();
    const signal = test.requestGuidance.mock.calls[0]?.[0].signal;
    fireEvent.change(screen.getByLabelText("Your website goal"), {
      target: { value: "Find my saved websites" },
    });
    expect(signal?.aborted).toBe(true);
    await act(async () => test.resolve(answer));
    expect(test.announce).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Repeat guidance" })).toBeNull();
    expect(screen.getByRole("button", { name: "Guide me" })).toBeEnabled();
  });
  it("does not repeat stale guidance after the page changes", async () => {
    const test = setup();
    await act(async () => test.resolve(answer));
    test.announce.mockClear();
    test.capture.mockReturnValue({ ...context, revision: "two" });
    fireEvent.click(screen.getByRole("button", { name: "Repeat guidance" }));
    expect(test.announce).toHaveBeenCalledWith("The page changed. Ask for fresh guidance.");
    expect(test.announce).not.toHaveBeenCalledWith(answer.message);
    expect(screen.queryByRole("button", { name: "Repeat guidance" })).toBeNull();
  });
  it("session copies caller data and can be cleared", () => {
    const value = { endpoint: "http://localhost:4318", token: "transient" };
    setBackendSession(value);
    value.token = "changed";
    expect(getBackendSession()?.token).toBe("transient");
    setBackendSession(null);
    expect(getBackendSession()).toBeNull();
  });
});

it("announces progress and exposes cancellation before the model completes", async () => {
  const test = setup();
  expect(test.startedAnnouncement).toContain(
    "Looking at this page. You can cancel while I prepare guidance.",
  );
  fireEvent.click(screen.getByRole("button", { name: "Cancel guidance request" }));
  expect(test.requestGuidance.mock.calls[0]?.[0].signal?.aborted).toBe(true);
  await act(async () => test.resolve(answer));
  expect(screen.queryByRole("region", { name: "Guidance for this page" })).toBeNull();
  expect(test.announce).toHaveBeenLastCalledWith("Guidance cancelled.");
});

it("never captures before local and AI permission, nor after cancellation", () => {
  const test = setup(false);
  expect(test.capture).not.toHaveBeenCalled();
  expect(test.requestGuidance).not.toHaveBeenCalled();
});
it("requires one-request AI consent before any capture", () => {
  const test = setup(true, false);
  expect(test.capture).not.toHaveBeenCalled();
  expect(test.requestGuidance).not.toHaveBeenCalled();
});

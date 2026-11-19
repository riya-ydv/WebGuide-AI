import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { VoiceAssistant } from "@/components/VoiceAssistant";
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
function setup() {
  const speak = vi.fn();
  const cancel = vi.fn();
  vi.stubGlobal("speechSynthesis", {
    speak,
    cancel,
    getVoices: () => [],
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
  vi.stubGlobal(
    "SpeechSynthesisUtterance",
    class {
      constructor(public text: string) {}
    },
  );
  render(<VoiceAssistant currentSection="Overview" onNavigate={() => {}} />);
  return { speak, cancel };
}
it("offers screen-reader operation without automatic speech or microphone", () => {
  const { speak } = setup();
  expect(speak).not.toHaveBeenCalled();
  const mode = screen.getByRole("button", { name: "Use my screen reader" });
  expect(mode).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(screen.getByRole("button", { name: "Quick help" }));
  expect(speak).not.toHaveBeenCalled();
  expect(screen.getByRole("status")).toHaveTextContent("Tab");
});
it("switches from requested audio to screen-reader announcements and Escape stays stopped", () => {
  const { speak, cancel } = setup();
  fireEvent.click(screen.getByRole("button", { name: "Start voice guide" }));
  expect(speak).toHaveBeenCalled();
  expect(screen.getByRole("status")).toHaveAttribute("aria-live", "off");
  fireEvent.click(screen.getByRole("button", { name: "Use my screen reader" }));
  expect(cancel).toHaveBeenCalled();
  expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
  const calls = speak.mock.calls.length;
  fireEvent.keyDown(document, { key: "Escape" });
  expect(speak).toHaveBeenCalledTimes(calls);
  expect(screen.getByRole("status")).toHaveTextContent("Stopped");
});

it("does not read page content before permission and Escape revokes it", () => {
  setup();
  const permission = screen.getByLabelText("Allow page reading and navigation in this section");
  fireEvent.click(screen.getByRole("button", { name: "Read page" }));
  expect(screen.getByRole("status")).toHaveTextContent("Nothing has been scanned");
  expect(permission).toHaveFocus();
  fireEvent.click(permission);
  expect(permission).toBeChecked();
  fireEvent.keyDown(document, { key: "Escape" });
  expect(permission).not.toBeChecked();
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  expect(screen.getByRole("status")).toHaveTextContent("Nothing has been scanned");
});

it("cancels silent speech startup within four seconds and exposes screen-reader feedback", () => {
  vi.useFakeTimers();
  const { cancel } = setup();
  fireEvent.click(screen.getByRole("button", { name: "Start voice guide" }));
  act(() => vi.advanceTimersByTime(4000));
  expect(cancel).toHaveBeenCalled();
  expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
  expect(screen.getByRole("status")).toHaveTextContent("Speech playback failed");
});

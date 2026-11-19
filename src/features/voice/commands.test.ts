import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { VoiceAssistant } from "@/components/VoiceAssistant";
import {
  accessibleName,
  canActivate,
  isSensitive,
  normalizeName,
  navigationTarget,
  moveCaret,
  insertFieldText,
  pageText,
  parseVoiceCommand,
  resolveSection,
  resolveTarget,
  setFieldText,
} from "./commands";

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockImplementation(function (
    this: HTMLElement,
  ) {
    return (this.closest("[hidden]") ? [] : [{ width: 100, height: 30 }]) as unknown as DOMRectList;
  });
});
afterEach(() => {
  cleanup();
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
function fixture(html: string) {
  const root = document.createElement("main");
  root.id = "main-content";
  root.innerHTML = html;
  document.body.append(root);
  return root;
}

describe("voice command interpretation", () => {
  it("recognises bounded English and Hindi commands without fuzzy actions", () => {
    expect(parseVoiceCommand("Read page!")).toEqual({ kind: "read-page" });
    expect(parseVoiceCommand("अगला")).toEqual({ kind: "next" });
    expect(parseVoiceCommand("खोलो प्रोफाइल")).toEqual({ kind: "open", value: "प्रोफाइल" });
    expect(resolveSection("प्रोफाइल")).toBe("Profile");
    expect(parseVoiceCommand("click Delete account")).toEqual({
      kind: "click",
      value: "Delete account",
    });
    expect(parseVoiceCommand("click delete then confirm")).toEqual({
      kind: "click",
      value: "delete then confirm",
    });
    expect(parseVoiceCommand("please delete everything automatically")).toEqual({
      kind: "unknown",
    });
    expect(parseVoiceCommand("x".repeat(1001))).toEqual({ kind: "unknown" });
  });
  it("preserves text entry casing and punctuation", () => {
    expect(parseVoiceCommand("Type Hello, World!")).toEqual({
      kind: "type",
      value: "Hello, World!",
    });
    expect(normalizeName(" Save—changes! ")).toBe("save changes");
  });
});
describe("DOM action boundaries", () => {
  it("requires exact unique visible enabled labels and ignores voice UI", () => {
    const root = fixture(
      "<button>Save</button><button>Save changes</button><button hidden>Hidden</button><div data-webguide-voice><button>Listen</button></div><button disabled>Disabled</button>",
    );
    expect(resolveTarget(root, "save").target?.textContent).toBe("Save");
    for (const query of ["changes", "Hidden", "Listen", "Disabled"])
      expect(resolveTarget(root, query).target).toBeUndefined();
    root.insertAdjacentHTML("beforeend", "<button>Save</button>");
    expect(resolveTarget(root, "save").error).toMatch(/Several/);
  });
  it("uses explicit accessible labels instead of input values", () => {
    const root = fixture(
      '<label for="email">Contact email</label><input id="email" value="private@example.com"><button aria-label="Close dialog">X</button>',
    );
    expect(accessibleName(root.querySelector("input")!)).toBe("Contact email");
    expect(accessibleName(root.querySelector("button")!)).toBe("Close dialog");
  });
  it("blocks sensitive fields and script or download-like protocols", () => {
    const root = fixture(
      '<input type="password"><input aria-label="Worker access token"><input autocomplete="cc-number"><input type="file"><a href="javascript:alert(1)">Bad</a>',
    );
    for (const input of root.querySelectorAll("input")) {
      expect(isSensitive(input)).toBe(true);
      expect(setFieldText(input, "test")).toBe(false);
    }
    expect(canActivate(root.querySelector("a")!)).toBe(false);
  });
  it("fills only editable permitted fields and never submits a form", () => {
    const root = fixture(
      '<form><input aria-label="Task title" maxlength="8"><input type="checkbox"><textarea readonly></textarea></form>',
    );
    const submitted = vi.fn();
    root.querySelector("form")!.addEventListener("submit", submitted);
    const input = root.querySelector("input")!;
    expect(setFieldText(input, "A task")).toBe(true);
    expect(input.value).toBe("A task");
    expect(submitted).not.toHaveBeenCalled();
    expect(setFieldText(input, "longer than limit")).toBe(false);
    expect(setFieldText(root.querySelector("input[type=checkbox]")!, "yes")).toBe(false);
    expect(setFieldText(root.querySelector("textarea")!, "text")).toBe(false);
  });
  it("does not read field values or assistant controls", () => {
    const root = fixture(
      '<h1>Page heading</h1><p>Readable text</p><input value="private-value"><textarea>private body</textarea><div hidden>hidden text</div><div data-webguide-voice>assistant text</div>',
    );
    expect(pageText(root)).toBe("Page heading Readable text");
  });
});
describe("accessible voice confirmation", () => {
  it("never requests microphone or speaks on mount and requires confirmation for every click", () => {
    const root = fixture('<button type="button">Perform action</button>');
    const clicked = vi.fn();
    root.querySelector("button")!.addEventListener("click", clicked);
    const speak = vi.fn();
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: {
        speak,
        cancel: vi.fn(),
        getVoices: () => [],
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
    });
    render(createElement(VoiceAssistant, { currentSection: "Overview", onNavigate: vi.fn() }));
    expect(speak).not.toHaveBeenCalled();
    if (
      !(
        screen.getByLabelText(
          "Allow page reading and navigation in this section",
        ) as HTMLInputElement
      ).checked
    )
      fireEvent.click(screen.getByLabelText("Allow page reading and navigation in this section"));
    fireEvent.change(screen.getByLabelText("Type a command"), {
      target: { value: "click Perform action" },
    });
    fireEvent.click(screen.getByText("Run command"));
    expect(clicked).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Confirm action"));
    expect(clicked).toHaveBeenCalledTimes(1);
    if (
      !(
        screen.getByLabelText(
          "Allow page reading and navigation in this section",
        ) as HTMLInputElement
      ).checked
    )
      fireEvent.click(screen.getByLabelText("Allow page reading and navigation in this section"));
    fireEvent.change(screen.getByLabelText("Type a command"), { target: { value: "confirm" } });
    fireEvent.click(screen.getByText("Run command"));
    expect(clicked).toHaveBeenCalledTimes(1);
  });
  it("rejects a removed or renamed control at confirmation time", () => {
    const root = fixture("<button>Save draft</button>");
    const button = root.querySelector("button")!;
    const clicked = vi.fn();
    button.addEventListener("click", clicked);
    render(createElement(VoiceAssistant, { currentSection: "Overview", onNavigate: vi.fn() }));
    if (
      !(
        screen.getByLabelText(
          "Allow page reading and navigation in this section",
        ) as HTMLInputElement
      ).checked
    )
      fireEvent.click(screen.getByLabelText("Allow page reading and navigation in this section"));
    fireEvent.change(screen.getByLabelText("Type a command"), {
      target: { value: "click Save draft" },
    });
    fireEvent.click(screen.getByText("Run command"));
    button.textContent = "Delete draft";
    fireEvent.click(screen.getByText("Confirm action"));
    expect(clicked).not.toHaveBeenCalled();
    expect(screen.getByRole("status").textContent).toMatch(/No current safe action/);
  });
});

describe("selection and session safety", () => {
  it("requires confirmation to choose a focused option and never submits", () => {
    const root = fixture(
      '<form><label for="mode">Instruction mode</label><select id="mode"><option>Beginner</option><option>Refresher</option><option disabled>Unavailable</option></select></form>',
    );
    const select = root.querySelector("select")!;
    const submit = vi.fn();
    root.querySelector("form")!.addEventListener("submit", submit);
    render(createElement(VoiceAssistant, { currentSection: "Overview", onNavigate: vi.fn() }));
    expect(parseVoiceCommand("चुनो Refresher")).toEqual({ kind: "choose", value: "Refresher" });
    const command = (value: string) => {
      if (
        !(
          screen.getByLabelText(
            "Allow page reading and navigation in this section",
          ) as HTMLInputElement
        ).checked
      )
        fireEvent.click(screen.getByLabelText("Allow page reading and navigation in this section"));
      fireEvent.change(screen.getByLabelText("Type a command"), { target: { value } });
      fireEvent.click(screen.getByText("Run command"));
    };
    command("focus Instruction mode");
    command("select Refresher");
    expect(select.value).toBe("Beginner");
    fireEvent.click(screen.getByText("Confirm action"));
    expect(select.value).toBe("Refresher");
    expect(submit).not.toHaveBeenCalled();
    command("choose Unavailable");
    expect(screen.queryByText("Confirm action")).toBeNull();
  });
  it("invalidates pending actions when the section changes", () => {
    const root = fixture("<button>Save draft</button>");
    const click = vi.fn();
    root.querySelector("button")!.addEventListener("click", click);
    const { rerender } = render(
      createElement(VoiceAssistant, { currentSection: "Overview", onNavigate: vi.fn() }),
    );
    if (
      !(
        screen.getByLabelText(
          "Allow page reading and navigation in this section",
        ) as HTMLInputElement
      ).checked
    )
      fireEvent.click(screen.getByLabelText("Allow page reading and navigation in this section"));
    fireEvent.change(screen.getByLabelText("Type a command"), {
      target: { value: "click Save draft" },
    });
    fireEvent.click(screen.getByText("Run command"));
    expect(screen.getByText("Confirm action")).toBeTruthy();
    rerender(createElement(VoiceAssistant, { currentSection: "Profile", onNavigate: vi.fn() }));
    expect(screen.queryByText("Confirm action")).toBeNull();
    expect(click).not.toHaveBeenCalled();
  });
});

it("uses only authored wrapped label text, never textarea values or option labels", () => {
  const root = fixture(
    "<label>Default instruction mode<select><option>Beginner</option><option>Refresher</option></select></label><label>Notes<textarea>private draft text</textarea></label>",
  );
  const select = root.querySelector("select")!;
  const textarea = root.querySelector("textarea")!;
  expect(accessibleName(select)).toBe("Default instruction mode");
  expect(accessibleName(textarea)).toBe("Notes");
  expect(resolveTarget(root, "Default instruction mode").target).toBe(select);
  expect(pageText(root)).not.toContain("private draft text");
});

it("announces when page reading reaches its bounded text limit", () => {
  const root = fixture("<p>" + "Long text ".repeat(2000) + "</p>");
  expect(pageText(root)).toContain("Reading stopped at the text limit");
  expect(pageText(root).length).toBeLessThan(15200);
});

describe("expanded navigation and caret", () => {
  it("moves relative to document position across headings, links, fields and landmarks", () => {
    const root = fixture(
      '<section aria-label="First region"><h1>Welcome</h1><button>Start</button><a href="/next">Continue</a><h2>Details</h2><label>Name<input></label></section><section aria-label="Second region"><h2>End</h2></section>',
    );
    const button = root.querySelector("button")!;
    expect(navigationTarget(root, button, "heading", "next").target?.textContent).toBe("Details");
    expect(navigationTarget(root, button, "heading", "previous").target?.textContent).toBe(
      "Welcome",
    );
    expect(navigationTarget(root, null, "link", "first").target?.textContent).toBe("Continue");
    expect(navigationTarget(root, null, "form", "last").target?.tagName).toBe("INPUT");
    expect(
      navigationTarget(root, null, "landmark", "last").target?.getAttribute("aria-label"),
    ).toBe("Second region");
    expect(parseVoiceCommand("next heading")).toEqual({
      kind: "navigate",
      group: "heading",
      direction: "next",
    });
    expect(parseVoiceCommand("first")).toEqual({
      kind: "navigate",
      group: "control",
      direction: "first",
    });
  });
  it("moves the real text selection without submitting or changing content", () => {
    const root = fixture(
      '<form><textarea aria-label="Notes">first\nsecond\nlast</textarea></form>',
    );
    const target = root.querySelector("textarea")!;
    const submitted = vi.fn();
    root.querySelector("form")!.addEventListener("submit", submitted);
    target.setSelectionRange(3, 3);
    expect(moveCaret(target, "down").moved).toBe(true);
    expect(target.selectionStart).toBe(9);
    moveCaret(target, "home");
    expect(target.selectionStart).toBe(6);
    moveCaret(target, "right", true);
    expect(target.selectionEnd).toBe(7);
    expect(target.selectionStart).toBe(6);
    moveCaret(target, "all");
    expect(target.selectionStart).toBe(0);
    expect(target.selectionEnd).toBe(target.value.length);
    expect(target.value).toBe("first\nsecond\nlast");
    expect(submitted).not.toHaveBeenCalled();
  });
  it("does not split a surrogate pair and excludes password, readonly and unsupported fields", () => {
    const root = fixture(
      '<input aria-label="Text"><input type="password"><input type="email"><textarea readonly>Read only</textarea>',
    );
    const input = root.querySelector("input")!;
    input.value = "A😀B";
    input.setSelectionRange(1, 1);
    moveCaret(input, "right");
    expect(input.selectionStart).toBe(3);
    moveCaret(input, "left");
    expect(input.selectionStart).toBe(1);
    for (const target of [
      root.querySelector<HTMLElement>("input[type=password]")!,
      root.querySelector<HTMLElement>("input[type=email]")!,
      root.querySelector("textarea")!,
    ])
      expect(moveCaret(target, "all").moved).toBe(false);
    expect(parseVoiceCommand("select right")).toEqual({
      kind: "caret",
      direction: "right",
      extend: true,
    });
  });
  it("never reads live editable content even when focused directly", () => {
    const root = fixture(
      '<div contenteditable="true">Private live draft</div><p>Public content</p>',
    );
    const editor = root.querySelector("div")!;
    expect(isSensitive(editor)).toBe(true);
    expect(accessibleName(editor)).toBe("Editable content");
    expect(pageText(root)).toBe("Public content");
  });
});

type ResultMock = {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
};
function mockSpeech() {
  const sessions: MockRecognition[] = [];
  class MockRecognition {
    lang = "";
    continuous = false;
    interimResults = false;
    onstart: (() => void) | null = null;
    onend: (() => void) | null = null;
    onerror: ((event: { error: string }) => void) | null = null;
    onresult: ((event: ResultMock) => void) | null = null;
    constructor() {
      sessions.push(this);
    }
    start() {
      this.onstart?.();
    }
    abort() {
      this.onend?.();
    }
  }
  class MockUtterance {
    text: string;
    lang = "";
    rate = 1;
    onend: (() => void) | null = null;
    onerror: (() => void) | null = null;
    constructor(text: string) {
      this.text = text;
    }
  }
  const utterances: MockUtterance[] = [];
  const cancel = vi.fn();
  vi.stubGlobal("SpeechRecognition", MockRecognition);
  vi.stubGlobal("SpeechSynthesisUtterance", MockUtterance);
  vi.stubGlobal("speechSynthesis", {
    getVoices: () => [],
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    cancel,
    speak: (utterance: MockUtterance) => utterances.push(utterance),
  });
  let handled = 0;
  const finishSpeech = () => {
    let limit = 0;
    while (handled < utterances.length && limit++ < 100) utterances[handled++]?.onend?.();
  };
  return { sessions, utterances, cancel, finishSpeech };
}
describe("opt-in conversation lifecycle", () => {
  it("starts guidance without microphone capture and never listens to its own speech", () => {
    vi.useFakeTimers();
    const speech = mockSpeech();
    fixture("<button>First control</button><button>Second control</button>");
    render(createElement(VoiceAssistant, { currentSection: "Overview", onNavigate: vi.fn() }));
    expect(speech.sessions).toHaveLength(0);
    expect(speech.utterances).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Start voice guide" }));
    expect(speech.utterances.length).toBeGreaterThan(0);
    expect(speech.sessions).toHaveLength(0);
    act(() => speech.finishSpeech());
    fireEvent.click(screen.getByLabelText("Keep listening after each response"));
    act(() => speech.finishSpeech());
    fireEvent.click(screen.getByRole("button", { name: "Listen: start microphone" }));
    expect(speech.sessions).toHaveLength(1);
    act(() =>
      speech.sessions[0]?.onresult?.({
        resultIndex: 0,
        results: [{ isFinal: true, 0: { transcript: "next" } }],
      }),
    );
    act(() => vi.advanceTimersByTime(100));
    act(() => vi.advanceTimersByTime(1000));
    expect(speech.sessions).toHaveLength(1);
    act(() => speech.finishSpeech());
    act(() => vi.advanceTimersByTime(450));
    expect(speech.sessions).toHaveLength(2);
    fireEvent.keyDown(document, { key: "Escape" });
    act(() => vi.advanceTimersByTime(300000));
    expect(speech.sessions).toHaveLength(2);
    expect(
      (screen.getByLabelText("Keep listening after each response") as HTMLInputElement).checked,
    ).toBe(false);
  });
  it("stops continuous capture on permission failure and speaks the failure after release", () => {
    vi.useFakeTimers();
    const speech = mockSpeech();
    fixture("<h1>Page</h1>");
    render(createElement(VoiceAssistant, { currentSection: "Overview", onNavigate: vi.fn() }));
    fireEvent.click(screen.getByRole("button", { name: "Start voice guide" }));
    act(() => speech.finishSpeech());
    fireEvent.click(screen.getByLabelText("Keep listening after each response"));
    act(() => speech.finishSpeech());
    fireEvent.click(screen.getByRole("button", { name: "Listen: start microphone" }));
    act(() => speech.sessions[0]?.onerror?.({ error: "not-allowed" }));
    expect(speech.utterances.at(-1)?.text).toMatch(/permission was denied/);
    act(() => speech.finishSpeech());
    act(() => vi.advanceTimersByTime(10000));
    expect(speech.sessions).toHaveLength(1);
  });
  it("returns speech failures to a live text status instead of leaving silent errors", () => {
    const speech = mockSpeech();
    render(createElement(VoiceAssistant, { currentSection: "Overview", onNavigate: vi.fn() }));
    fireEvent.click(screen.getByRole("button", { name: "Start voice guide" }));
    act(() => speech.utterances.at(-1)?.onerror?.());
    expect(screen.getByRole("status").getAttribute("aria-live")).toBe("polite");
    expect(screen.getByRole("status").textContent).toContain("Speech playback failed");
  });
  it("provides the expanded keyboard navigation without intercepting plain typing", () => {
    fixture("<h1>Title</h1><button>First</button><h2>Second heading</h2><button>Second</button>");
    render(createElement(VoiceAssistant, { currentSection: "Overview", onNavigate: vi.fn() }));
    fireEvent.click(screen.getByLabelText("Allow page reading and navigation in this section"));
    fireEvent.keyDown(document, { altKey: true, shiftKey: true, code: "KeyH" });
    expect(document.activeElement?.textContent).toBe("Title");
    fireEvent.keyDown(document, { altKey: true, shiftKey: true, code: "KeyH" });
    expect(document.activeElement?.textContent).toBe("Second heading");
    fireEvent.keyDown(document, { code: "KeyN" });
    expect(document.activeElement?.textContent).toBe("Second heading");
  });
});

it("inserts at the actual caret without overwriting surrounding text", () => {
  const root = fixture('<textarea aria-label="Notes">Hello world</textarea>');
  const field = root.querySelector("textarea")!;
  field.setSelectionRange(6, 11);
  expect(insertFieldText(field, "friend")).toBe(true);
  expect(field.value).toBe("Hello friend");
  expect(field.selectionStart).toBe(12);
  expect(parseVoiceCommand("insert Hello, friend!")).toEqual({
    kind: "insert",
    value: "Hello, friend!",
  });
});

describe("bounded listening and microphone diagnostics", () => {
  it("stops after three silent attempts rather than retrying forever", () => {
    vi.useFakeTimers();
    const speech = mockSpeech();
    render(createElement(VoiceAssistant, { currentSection: "Overview", onNavigate: vi.fn() }));
    fireEvent.click(screen.getByLabelText("Keep listening after each response"));
    fireEvent.click(screen.getByRole("button", { name: "Listen: start microphone" }));
    for (let attempt = 0; attempt < 3; attempt++) {
      act(() => speech.sessions[attempt]?.onerror?.({ error: "no-speech" }));
      act(() => vi.advanceTimersByTime(500));
    }
    expect(speech.sessions).toHaveLength(3);
    expect(screen.getByRole("status").textContent).toContain("three attempts");
    act(() => vi.advanceTimersByTime(10000));
    expect(speech.sessions).toHaveLength(3);
  });
  it("only requests capture from a diagnostic button and closes its tracks", async () => {
    vi.useFakeTimers();
    const stop = vi.fn();
    const track = { label: "USB microphone", stop, getSettings: () => ({ deviceId: "usb-mic" }) };
    const stream = { getTracks: () => [track], getAudioTracks: () => [track] };
    const getUserMedia = vi.fn(async () => stream);
    const enumerateDevices = vi.fn(async () => [
      { kind: "audioinput", deviceId: "usb-mic", label: "USB microphone" },
    ]);
    const original = navigator.mediaDevices;
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia, enumerateDevices },
    });
    try {
      render(createElement(VoiceAssistant, { currentSection: "Overview", onNavigate: vi.fn() }));
      expect(getUserMedia).not.toHaveBeenCalled();
      await act(async () => {
        fireEvent.click(
          screen.getByRole("button", { name: "Check available microphones", hidden: true }),
        );
        await Promise.resolve();
      });
      expect(getUserMedia).toHaveBeenCalledWith({ audio: true });
      act(() => vi.advanceTimersByTime(1500));
      expect(stop).toHaveBeenCalledTimes(1);
      expect(screen.getByRole("status").textContent).toContain("system default microphone");
      fireEvent.change(screen.getByLabelText("Microphone for capture test"), {
        target: { value: "usb-mic" },
      });
      await act(async () => {
        fireEvent.click(
          screen.getByRole("button", { name: "Test selected microphone", hidden: true }),
        );
        await Promise.resolve();
      });
      expect(getUserMedia).toHaveBeenLastCalledWith({ audio: { deviceId: { exact: "usb-mic" } } });
      fireEvent.keyDown(document, { key: "Escape" });
      expect(stop).toHaveBeenCalledTimes(2);
    } finally {
      Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: original });
    }
  });
});

describe("Stop is a persistent speech boundary", () => {
  it("cannot resume a multi-chunk utterance or announce stale errors after Stop", () => {
    vi.useFakeTimers();
    const speech = mockSpeech();
    fixture("<h1>Reading test</h1><p>" + "A long sentence for speech. ".repeat(30) + "</p>");
    render(createElement(VoiceAssistant, { currentSection: "Overview", onNavigate: vi.fn() }));
    fireEvent.click(screen.getByRole("button", { name: "Start voice guide" }));
    act(() => speech.finishSpeech());
    fireEvent.click(screen.getByRole("button", { name: "Read page" }));
    const interrupted = speech.utterances.at(-1)!;
    const count = speech.utterances.length;
    fireEvent.click(screen.getByRole("button", { name: "Stop" }));
    act(() => {
      interrupted.onend?.();
      interrupted.onerror?.();
      speech.finishSpeech();
      vi.runAllTimers();
    });
    expect(speech.utterances).toHaveLength(count);
    expect(speech.sessions).toHaveLength(0);
    expect(screen.getByRole("status").textContent).toBe(
      "Stopped. Microphone off and pending action cancelled.",
    );
    expect(screen.getByRole("status").getAttribute("aria-live")).toBe("polite");
    fireEvent.click(screen.getByRole("button", { name: "Read page" }));
    expect(speech.utterances).toHaveLength(count);
    fireEvent.click(screen.getByRole("button", { name: "Start voice guide" }));
    expect(speech.utterances.length).toBeGreaterThan(count);
  });
  it("discards delayed recognition results and pending confirmation timers after Stop", () => {
    vi.useFakeTimers();
    const speech = mockSpeech();
    const navigate = vi.fn();
    fixture("<button>Do action</button>");
    render(createElement(VoiceAssistant, { currentSection: "Overview", onNavigate: navigate }));
    fireEvent.click(screen.getByRole("button", { name: "Start voice guide" }));
    act(() => speech.finishSpeech());
    fireEvent.click(screen.getByLabelText("Keep listening after each response"));
    act(() => speech.finishSpeech());
    fireEvent.click(screen.getByRole("button", { name: "Listen: start microphone" }));
    const session = speech.sessions[0]!;
    act(() =>
      session.onresult?.({
        resultIndex: 0,
        results: [{ isFinal: true, 0: { transcript: "open profile" } }],
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Stop" }));
    const count = speech.utterances.length;
    act(() => {
      session.onstart?.();
      session.onend?.();
      session.onerror?.({ error: "no-speech" });
      session.onresult?.({
        resultIndex: 0,
        results: [{ isFinal: true, 0: { transcript: "open settings" } }],
      });
      speech.finishSpeech();
      vi.runAllTimers();
    });
    expect(navigate).not.toHaveBeenCalled();
    expect(speech.sessions).toHaveLength(1);
    expect(speech.utterances).toHaveLength(count);
    expect(screen.getByRole("status").textContent).toBe(
      "Stopped. Microphone off and pending action cancelled.",
    );
    if (
      !(
        screen.getByLabelText(
          "Allow page reading and navigation in this section",
        ) as HTMLInputElement
      ).checked
    )
      fireEvent.click(screen.getByLabelText("Allow page reading and navigation in this section"));
    fireEvent.change(screen.getByLabelText("Type a command"), {
      target: { value: "click Do action" },
    });
    fireEvent.click(screen.getByText("Run command"));
    expect(screen.getByText("Confirm action")).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    act(() => vi.runAllTimers());
    expect(screen.queryByText("Confirm action")).toBeNull();
    expect(screen.getByRole("status").textContent).toBe(
      "Stopped. Microphone off and pending action cancelled.",
    );
    expect(speech.utterances).toHaveLength(count);
  });
});

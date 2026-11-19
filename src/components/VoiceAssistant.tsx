import { PageGuidance, type GuidanceActions } from "./PageGuidance";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  accessibleName,
  canActivate,
  isEnabled,
  isSensitive,
  isVisible,
  pageText,
  parseVoiceCommand,
  resolveSection,
  resolveTarget,
  setFieldText,
  resolveOption,
  setSelection,
  navigationTarget,
  moveCaret,
  insertFieldText,
} from "@/features/voice/commands";
type RecognitionResultEvent = {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
};
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: RecognitionResultEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  start(): void;
  abort(): void;
};
type SpeechWindow = Window & {
  SpeechRecognition?: new () => Recognition;
  webkitSpeechRecognition?: new () => Recognition;
};
type Pending = {
  kind: "click" | "choose";
  option?: HTMLOptionElement;
  previousValue?: string;
  element: HTMLElement;
  name: string;
  href: string | null;
  section: string;
  expires: number;
};
const help =
  "Say Guide me to followed by your goal for connected AI guidance. Say Repeat, Simplify, or Explain field for more help. Say Next, Back, Read page, Read focused, Next heading, Next link, Next form, Next landmark, First or Last. Say Open profile to change section. Focus and an exact name finds a control. Click current asks for confirmation. Type and text replaces a field. Insert and text adds at its cursor; Choose and an option selects it after confirmation. Cursor left, right, up, down, home or end moves the text caret. Select left or right extends selection. Say Select all to select a field's text. Confirm applies a pending action. Cancel or Stop ends listening. Escape always stops voice. Keyboard: Alt Shift M for microphone, N or P for next or previous control, R to read, H for next heading, L for next link and F for next form field. Shift is already part of these shortcuts.";
const quickHelp =
  "Use Tab to move between controls and Enter to activate. Choose Listen or press Alt Shift M, then say Next, Read page, Open profile, or Help. Escape stops WebGuide speech, microphone and pending actions. Your screen reader keeps its own controls.";
const hindiHelp =
  "अगला, पिछला, पेज पढ़ो, यह पढ़ो, अगला शीर्षक, अगला लिंक, खोलो प्रोफाइल, फोकस और नाम, क्लिक और नाम, लिखो और टेक्स्ट, या चुनो और विकल्प कहें। क्लिक और चयन के लिए पुष्टि कहें। रद्द या रुको से सुनना बंद होगा। एस्केप से आवाज और माइक्रोफोन बंद होते हैं।";
const CONVERSATION_MS = 5 * 60 * 1000;
const MAX_LISTENS = 30;
export function VoiceAssistant({
  onNavigate,
  currentSection,
}: {
  onNavigate: (section: string) => void;
  currentSection: string;
}) {
  const [language, setLanguage] = useState("en-IN");
  const [rate, setRate] = useState(1);
  const [confirmationSeconds, setConfirmationSeconds] = useState(120);
  const [pageAccess, setPageAccess] = useState(false);
  const pageAccessRef = useRef<HTMLInputElement>(null);
  const [spoken, setSpoken] = useState(false);
  const [supported, setSupported] = useState({
    recognition: false,
    synthesis: false,
    capture: false,
  });
  const [listening, setListening] = useState(false);
  const [talking, setTalking] = useState(false);
  const [keepListening, setKeepListening] = useState(false);
  const [conversationActive, setConversationActive] = useState(false);
  const [status, setStatus] = useState("Ready. Start voice guide to hear a short introduction.");
  const [transcript, setTranscript] = useState("");
  const [typed, setTyped] = useState("");
  const [pending, setPending] = useState<Pending | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceName, setVoiceName] = useState("");
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [testDevice, setTestDevice] = useState("");
  const [checkingMic, setCheckingMic] = useState(false);
  const [micReport, setMicReport] = useState("");
  const recognition = useRef<Recognition | null>(null);
  const commandTimer = useRef<number | null>(null);
  const restartTimer = useRef<number | null>(null);
  const captureTimer = useRef<number | null>(null);
  const conversationTimer = useRef<number | null>(null);
  const lastTarget = useRef<HTMLElement | null>(null);
  const speechGeneration = useRef(0);
  const speechStartTimer = useRef<number | null>(null);
  const stopEpoch = useRef(0);
  const mounted = useRef(true);
  const spokenRef = useRef(false);
  const speakingRef = useRef(false);
  const keepListeningRef = useRef(false);
  const activeRef = useRef(false);
  const listenCount = useRef(0);
  const noSpeechCount = useRef(0);
  const sessionStarted = useRef(0);
  const diagnosticBusy = useRef(false);
  const diagnosticStream = useRef<MediaStream | null>(null);
  const diagnosticGeneration = useRef(0);
  const diagnosticTimer = useRef<number | null>(null);
  const guidanceRef = useRef<GuidanceActions>(null);
  const moreVoiceRef = useRef<HTMLDetailsElement>(null);
  const confirmationRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (moreVoiceRef.current) moreVoiceRef.current.open = false;
  }, [currentSection]);
  const lastInstruction = useRef("");
  const runRef = useRef<(input: string) => void>(() => undefined);
  const toggleRef = useRef<() => void>(() => undefined);
  const startRecognitionRef = useRef<() => void>(() => undefined);
  const announceRef = useRef<(message: string, force?: boolean) => void>(() => undefined);
  const scheduleRef = useRef<() => void>(() => undefined);
  const main = () =>
    document.getElementById("main-content") ?? document.querySelector<HTMLElement>("main");
  const clearTimer = (timer: { current: number | null }) => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  };
  const stopSpeech = useCallback(() => {
    clearTimer(speechStartTimer);
    speechGeneration.current += 1;
    speakingRef.current = false;
    setTalking(false);
    if (typeof window !== "undefined" && "speechSynthesis" in window)
      window.speechSynthesis.cancel();
  }, []);
  const stopListening = useCallback(() => {
    clearTimer(commandTimer);
    clearTimer(restartTimer);
    clearTimer(captureTimer);
    const session = recognition.current;
    recognition.current = null;
    session?.abort();
    setListening(false);
  }, []);
  const stopDiagnostics = useCallback(() => {
    diagnosticGeneration.current += 1;
    diagnosticBusy.current = false;
    clearTimer(diagnosticTimer);
    diagnosticStream.current?.getTracks().forEach((track) => track.stop());
    diagnosticStream.current = null;
    setCheckingMic(false);
  }, []);
  const endConversation = useCallback(() => {
    activeRef.current = false;
    setConversationActive(false);
    clearTimer(conversationTimer);
    clearTimer(restartTimer);
  }, []);
  const stopAll = useCallback(() => {
    guidanceRef.current?.cancel();
    setPageAccess(false);
    stopEpoch.current += 1;
    spokenRef.current = false;
    setSpoken(false);
    endConversation();
    keepListeningRef.current = false;
    setKeepListening(false);
    stopSpeech();
    stopListening();
    stopDiagnostics();
    setPending(null);
    if (
      confirmationRef.current
        ?.closest(".wg-voice-confirmation")
        ?.contains(document.activeElement) &&
      lastTarget.current?.isConnected
    )
      lastTarget.current.focus();
    setStatus("Stopped. Microphone off and pending action cancelled.");
  }, [endConversation, stopSpeech, stopListening, stopDiagnostics]);
  const scheduleListening = useCallback(() => {
    clearTimer(restartTimer);
    if (
      !mounted.current ||
      !activeRef.current ||
      speakingRef.current ||
      recognition.current ||
      diagnosticStream.current
    )
      return;
    if (
      listenCount.current >= MAX_LISTENS ||
      Date.now() - sessionStarted.current >= CONVERSATION_MS
    ) {
      endConversation();
      announceRef.current("Conversation limit reached. Press Listen to begin a new session.");
      return;
    }
    const epoch = stopEpoch.current;
    restartTimer.current = window.setTimeout(() => {
      restartTimer.current = null;
      if (
        mounted.current &&
        epoch === stopEpoch.current &&
        activeRef.current &&
        !speakingRef.current &&
        !recognition.current
      )
        startRecognitionRef.current();
    }, 450);
  }, [endConversation]);
  scheduleRef.current = scheduleListening;
  const announce = useCallback(
    (message: string, force = false) => {
      lastInstruction.current = message;
      setStatus(message);
      stopListening();
      stopSpeech();
      if (!(spokenRef.current || force) || !("speechSynthesis" in window)) {
        scheduleRef.current();
        return;
      }
      const chunks = message.match(/[^.!?।]{1,220}(?:[.!?।]|\s|$)|.{1,220}/gu) ?? [message];
      const generation = speechGeneration.current;
      speakingRef.current = true;
      setTalking(true);
      const say = (index: number) => {
        if (!mounted.current || generation !== speechGeneration.current) return;
        if (index >= chunks.length) {
          speakingRef.current = false;
          setTalking(false);
          scheduleRef.current();
          return;
        }
        const utterance = new SpeechSynthesisUtterance(chunks[index] ?? "");
        utterance.lang = language;
        utterance.rate = rate;
        const choice =
          voices.find((voice) => voice.name === voiceName) ??
          voices.find((voice) => voice.lang.toLowerCase().startsWith(language.slice(0, 2)));
        if (choice) utterance.voice = choice;
        utterance.onstart = () => {
          if (generation === speechGeneration.current) clearTimer(speechStartTimer);
        };
        utterance.onend = () => {
          if (generation !== speechGeneration.current) return;
          clearTimer(speechStartTimer);
          say(index + 1);
        };
        utterance.onerror = () => {
          if (generation !== speechGeneration.current) return;
          clearTimer(speechStartTimer);
          if (mounted.current && generation === speechGeneration.current) {
            speechGeneration.current += 1;
            window.speechSynthesis.cancel();
            spokenRef.current = false;
            setSpoken(false);
            speakingRef.current = false;
            setTalking(false);
            endConversation();
            setStatus(
              `Speech playback failed. Text and screen-reader guidance are available. ${message}`,
            );
          }
        };
        try {
          speechStartTimer.current = window.setTimeout(() => {
            utterance.onerror?.(new Event("error") as SpeechSynthesisErrorEvent);
          }, 4000);
          window.speechSynthesis.resume?.();
          window.speechSynthesis.speak(utterance);
        } catch {
          utterance.onerror?.(new Event("error") as SpeechSynthesisErrorEvent);
        }
      };
      say(0);
    },
    [endConversation, language, rate, stopListening, stopSpeech, voiceName, voices],
  );
  announceRef.current = announce;
  const focusPageTarget = useCallback((target: HTMLElement) => {
    document
      .querySelectorAll("[data-webguide-focused]")
      .forEach((element) => element.removeAttribute("data-webguide-focused"));
    if (!target.matches("a[href],button,input,select,textarea,summary,[tabindex]")) {
      target.setAttribute("tabindex", "-1");
      target.addEventListener(
        "blur",
        () => {
          if (target.getAttribute("tabindex") === "-1") target.removeAttribute("tabindex");
        },
        { once: true },
      );
    }
    target.setAttribute("data-webguide-focused", "true");
    target.focus();
    target.scrollIntoView?.({ block: "nearest", inline: "nearest", behavior: "instant" });
    lastTarget.current = target;
  }, []);
  const run = useCallback(
    (input: string) => {
      if (["allow page reading", "पेज पढ़ने की अनुमति"].includes(input.trim().toLowerCase())) {
        setPageAccess(true);
        announce(
          "Page reading allowed for this section. Say Read page or Next. Stop revokes permission.",
        );
        return;
      }
      if (["allow ai guidance", "एआई की अनुमति"].includes(input.trim().toLowerCase())) {
        if (!pageAccess) {
          announce("First say Allow page reading.");
          return;
        }
        guidanceRef.current?.grantSharing();
        return;
      }
      const command = parseVoiceCommand(input);
      if (!pageAccess && !["stop", "cancel", "help", "open", "unknown"].includes(command.kind)) {
        pageAccessRef.current?.focus();
        announce(
          "Allow page reading first using the checkbox, or say Allow page reading. Nothing has been scanned.",
        );
        return;
      }
      if (["guide", "simplify", "explain"].includes(command.kind) && moreVoiceRef.current)
        moreVoiceRef.current.open = true;
      if (command.kind === "repeat") {
        announce(lastInstruction.current || "No instruction to repeat yet.");
        return;
      }
      if (command.kind === "simplify") {
        guidanceRef.current?.ask("simplify");
        return;
      }
      if (command.kind === "explain") {
        const target = lastTarget.current;
        if (target && isVisible(target) && !isSensitive(target))
          guidanceRef.current?.ask(
            "explain",
            `Explain the field or control named ${accessibleName(target)} and any visible requirements.`,
          );
        else announce("Focus a non-private page field first, then say Explain field.");
        return;
      }
      if (command.kind === "guide") {
        guidanceRef.current?.ask("guide", command.value);
        return;
      }
      const root = main();
      if (command.kind === "stop" || command.kind === "cancel") {
        stopAll();
        return;
      }
      if (command.kind === "confirm") {
        const action = pending;
        setPending(null);
        if (
          !action ||
          action.expires < Date.now() ||
          action.section !== currentSection ||
          !root?.contains(action.element) ||
          !isVisible(action.element) ||
          !isEnabled(action.element) ||
          isSensitive(action.element) ||
          (action.kind === "click" && !canActivate(action.element)) ||
          accessibleName(action.element) !== action.name ||
          action.element.getAttribute("href") !== action.href
        ) {
          announce("No current safe action to confirm. Ask to click the control again.");
          return;
        }
        action.element.focus();
        if (action.kind === "choose") {
          if (
            !(action.element instanceof HTMLSelectElement) ||
            action.element.value !== action.previousValue ||
            !action.option ||
            resolveOption(action.element, action.option.label) !== action.option ||
            !setSelection(action.element, action.option)
          ) {
            announce("That selection changed or is no longer available. Choose the option again.");
            return;
          }
          announce(`Selected ${action.option.label} in ${action.name}. Check the resulting page.`);
        } else {
          announce(`Activating ${action.name}. Check the resulting page for confirmation.`);
          action.element.click();
        }
        return;
      }
      setPending(null);
      if (command.kind === "help") {
        announce(language.startsWith("hi") ? hindiHelp : quickHelp);
        return;
      }
      if (command.kind === "open") {
        const section = resolveSection(command.value);
        if (!section) {
          announce(
            "Unknown section. Try Open profile, Open tutorials, Open explorer, Open settings or Open FAQs.",
          );
          return;
        }
        onNavigate(section);
        announce(`Opening ${section}.`);
        return;
      }
      if (!root) {
        announce("Page content is not ready. Please retry.");
        return;
      }
      if (command.kind === "read-page") {
        announce(pageText(root) || "No readable page text is available.");
        return;
      }
      if (command.kind === "headings" || command.kind === "links") {
        const elements = Array.from(
          root.querySelectorAll<HTMLElement>(
            command.kind === "headings" ? "h1,h2,h3,h4,h5,h6" : "a[href]",
          ),
        ).filter(isVisible);
        announce(
          elements.length
            ? elements
                .slice(0, 60)
                .map((element, index) => `${index + 1}. ${accessibleName(element)}`)
                .join(". ")
            : `No ${command.kind} on this page.`,
        );
        return;
      }
      if (command.kind === "scroll-down" || command.kind === "scroll-up") {
        window.scrollBy({
          top: (command.kind === "scroll-down" ? 1 : -1) * window.innerHeight * 0.75,
          behavior: "instant",
        });
        announce(command.kind === "scroll-down" ? "Scrolled down." : "Scrolled up.");
        return;
      }
      const focused = lastTarget.current;
      if (command.kind === "read-focused") {
        announce(
          focused && root.contains(focused) && isVisible(focused)
            ? `${accessibleName(focused)}. ${focused.getAttribute("role") ?? focused.tagName.toLowerCase()}. ${isSensitive(focused) ? "Private field. Values are not read aloud." : ""}`
            : "No page control is selected. Say Next.",
        );
        return;
      }
      if (command.kind === "next" || command.kind === "previous" || command.kind === "navigate") {
        const group = command.kind === "navigate" ? command.group : "control";
        const direction = command.kind === "navigate" ? command.direction : command.kind;
        const { target, index, count } = navigationTarget(root, focused, group, direction);
        if (!target) {
          announce(`No available ${group}s on this page.`);
          return;
        }
        focusPageTarget(target);
        announce(
          `${index + 1} of ${count} ${group}s. ${accessibleName(target).slice(0, 220)}. ${target.getAttribute("role") ?? target.tagName.toLowerCase()}.`,
        );
        return;
      }
      if (command.kind === "caret") {
        if (!focused || !root.contains(focused)) {
          announce("Focus a text field first. Say Next form or Focus and its name.");
          return;
        }
        const result = moveCaret(focused, command.direction, command.extend);
        if (!result.moved) {
          announce(
            "Cursor movement is available in editable text fields only. Private and unsupported fields are protected.",
          );
          return;
        }
        focused.focus();
        announce(
          result.selected
            ? `Selected ${result.selected} text units in ${accessibleName(focused)}.`
            : `Text cursor moved in ${accessibleName(focused)}. Nothing was submitted.`,
        );
        return;
      }
      if (command.kind === "choose") {
        const option =
          focused && root.contains(focused) ? resolveOption(focused, command.value) : undefined;
        if (!option || !(focused instanceof HTMLSelectElement)) {
          announce(
            "Focus an enabled selection control, then say Choose and the exact option label. Private fields and ambiguous options are not supported.",
          );
          return;
        }
        const name = accessibleName(focused);
        setPending({
          kind: "choose",
          element: focused,
          name,
          href: focused.getAttribute("href"),
          section: currentSection,
          expires: Date.now() + confirmationSeconds * 1000,
          option,
          previousValue: focused.value,
        });
        announce(
          `Choose ${option.label} in ${name}? This can change the page. Say Confirm or Cancel.`,
        );
        return;
      }
      if (command.kind === "insert") {
        if (!focused || !root.contains(focused) || !insertFieldText(focused, command.value)) {
          announce(
            "Focus an editable text field with a text cursor first. Private and unsupported fields are protected.",
          );
          return;
        }
        announce(`Text inserted in ${accessibleName(focused)}. Nothing was submitted.`);
        return;
      }
      if (command.kind === "type") {
        if (!focused || !root.contains(focused) || !setFieldText(focused, command.value)) {
          announce(
            "Focus a visible editable text field first. Passwords, tokens, payment details, files and private fields cannot be filled by voice.",
          );
          return;
        }
        announce(`Text entered in ${accessibleName(focused)}. Nothing was submitted.`);
        return;
      }
      if (command.kind === "focus" || command.kind === "click") {
        const result =
          ["current", "this", "यह"].includes(command.value.toLowerCase()) &&
          focused &&
          root.contains(focused)
            ? { target: focused }
            : resolveTarget(root, command.value);
        const target = result.target;
        if (!target || !isVisible(target) || !isEnabled(target)) {
          announce(result.error ?? "That control is no longer available.");
          return;
        }
        if (command.kind === "focus") {
          focusPageTarget(target);
          announce(`Focused ${accessibleName(target)}. Values are not read aloud.`);
          return;
        }
        if (!canActivate(target)) {
          announce(
            "This control cannot be activated by voice. Use its native keyboard controls. Private fields are protected.",
          );
          return;
        }
        const name = accessibleName(target);
        setPending({
          kind: "click",
          element: target,
          name,
          href: target.getAttribute("href"),
          section: currentSection,
          expires: Date.now() + confirmationSeconds * 1000,
        });
        announce(
          `Ready to activate ${name}. This may submit information or change the page. Say Confirm or use Confirm action within ${confirmationSeconds / 60} minutes. Say Cancel to discard.`,
        );
        return;
      }
      announce(
        "Command not recognised. Say Help or select Read command help. You can also type a command.",
      );
    },
    [
      announce,
      currentSection,
      language,
      onNavigate,
      pending,
      stopAll,
      focusPageTarget,
      confirmationSeconds,
      pageAccess,
    ],
  );
  runRef.current = run;
  const startRecognition = useCallback(() => {
    if (recognition.current || speakingRef.current || diagnosticStream.current) return;
    const Constructor =
      (window as SpeechWindow).SpeechRecognition ??
      (window as SpeechWindow).webkitSpeechRecognition;
    if (!Constructor) {
      endConversation();
      announceRef.current(
        "Microphone commands are unavailable in this browser. Use typed commands or keyboard navigation.",
      );
      return;
    }
    if (
      activeRef.current &&
      (listenCount.current >= MAX_LISTENS || Date.now() - sessionStarted.current >= CONVERSATION_MS)
    ) {
      endConversation();
      announceRef.current("Conversation limit reached. Press Listen to begin a new session.");
      return;
    }
    clearTimer(restartTimer);
    listenCount.current += 1;
    const epoch = stopEpoch.current;
    const session = new Constructor();
    session.lang = language;
    session.continuous = false;
    session.interimResults = false;
    recognition.current = session;
    session.onstart = () => {
      if (mounted.current && epoch === stopEpoch.current && recognition.current === session) {
        setListening(true);
        setStatus(
          activeRef.current
            ? "Listening. I will listen again after my response. Escape stops the conversation."
            : "Listening for one command. Speak now. Escape stops the microphone.",
        );
      }
    };
    session.onresult = (event) => {
      if (epoch !== stopEpoch.current || recognition.current !== session) return;
      const result = event.results[event.resultIndex];
      if (!result?.isFinal) return;
      const text = result[0].transcript.trim();
      noSpeechCount.current = 0;
      setTranscript(
        ["type", "insert"].includes(parseVoiceCommand(text).kind)
          ? "Text entry command (content hidden)"
          : text,
      );
      recognition.current = null;
      clearTimer(captureTimer);
      session.abort();
      setListening(false);
      commandTimer.current = window.setTimeout(() => {
        commandTimer.current = null;
        if (mounted.current && epoch === stopEpoch.current) runRef.current(text);
      }, 100);
    };
    const quiet = () => {
      noSpeechCount.current += 1;
      if (noSpeechCount.current >= 3) {
        endConversation();
        announceRef.current(
          "No speech was detected after three attempts. Listening stopped. Check your default microphone and press Listen when ready.",
        );
      } else
        announceRef.current(
          activeRef.current
            ? "I did not hear a command. I will listen once more after this message."
            : "No command heard. Press Listen when you are ready.",
        );
    };
    session.onerror = (event) => {
      if (!mounted.current || epoch !== stopEpoch.current || recognition.current !== session)
        return;
      recognition.current = null;
      clearTimer(captureTimer);
      setListening(false);
      if (event.error === "aborted") return;
      if (event.error === "no-speech") {
        quiet();
        return;
      }
      endConversation();
      const errors: Record<string, string> = {
        "not-allowed":
          "Microphone permission was denied. Allow microphone access in browser site settings, or use typed commands.",
        "service-not-allowed":
          "Your browser or device blocks speech recognition. Use typed commands or keyboard controls.",
        "audio-capture":
          "No default microphone is available. Check your system input device, then try Listen again.",
        network:
          "The browser speech service could not connect. Check your connection or use typed commands.",
        "language-not-supported":
          "This speech language is not supported on your device. Choose another language or use typed commands.",
      };
      announceRef.current(
        errors[event.error] ??
          "Speech recognition failed and listening stopped. You can retry Listen or type a command.",
      );
    };
    session.onend = () => {
      if (mounted.current && epoch === stopEpoch.current && recognition.current === session) {
        recognition.current = null;
        clearTimer(captureTimer);
        setListening(false);
        quiet();
      }
    };
    try {
      session.start();
      captureTimer.current = window.setTimeout(() => {
        captureTimer.current = null;
        if (epoch === stopEpoch.current && recognition.current === session) {
          recognition.current = null;
          session.abort();
          setListening(false);
          quiet();
        }
      }, 45000);
    } catch {
      recognition.current = null;
      setListening(false);
      endConversation();
      announceRef.current(
        "Could not start the microphone. Press Listen to retry or use typed commands.",
      );
    }
  }, [endConversation, language]);
  startRecognitionRef.current = startRecognition;
  const toggleMicrophone = useCallback(() => {
    if (recognition.current || activeRef.current) {
      endConversation();
      stopListening();
      stopSpeech();
      announceRef.current("Microphone stopped.");
      return;
    }
    stopSpeech();
    stopListening();
    stopDiagnostics();
    listenCount.current = 0;
    noSpeechCount.current = 0;
    sessionStarted.current = Date.now();
    activeRef.current = keepListeningRef.current;
    setConversationActive(activeRef.current);
    if (activeRef.current) {
      clearTimer(conversationTimer);
      const epoch = stopEpoch.current;
      conversationTimer.current = window.setTimeout(() => {
        if (epoch !== stopEpoch.current || !activeRef.current) return;
        endConversation();
        stopListening();
        announceRef.current("The five minute conversation ended. Press Listen to continue.");
      }, CONVERSATION_MS);
    }
    startRecognitionRef.current();
  }, [endConversation, stopDiagnostics, stopListening, stopSpeech]);
  toggleRef.current = toggleMicrophone;
  async function checkMicrophones(selected = false) {
    if (diagnosticBusy.current) return;
    stopAll();
    diagnosticBusy.current = true;
    setCheckingMic(true);
    const generation = ++diagnosticGeneration.current;
    try {
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error(
          "Capture testing needs microphone support and a secure HTTPS or localhost page.",
        );
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: selected && testDevice ? { deviceId: { exact: testDevice } } : true,
      });
      if (!mounted.current || generation !== diagnosticGeneration.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      diagnosticStream.current = stream;
      const inputs = (await navigator.mediaDevices.enumerateDevices()).filter(
        (device) => device.kind === "audioinput",
      );
      if (!mounted.current || generation !== diagnosticGeneration.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      setDevices(inputs);
      const track = stream.getAudioTracks()[0];
      const actual = track?.getSettings().deviceId;
      const message =
        selected && testDevice && actual && actual !== testDevice
          ? "The browser opened a different input than requested. Use the system input settings to choose your device."
          : `Microphone capture opened${track?.label ? `: ${track.label}` : ""}. This verifies device access, not sound quality or speech recognition. Recognition uses the browser or system default microphone.`;
      setMicReport(message);
      diagnosticTimer.current = window.setTimeout(() => {
        diagnosticTimer.current = null;
        stream.getTracks().forEach((item) => item.stop());
        if (generation === diagnosticGeneration.current) {
          diagnosticStream.current = null;
          diagnosticBusy.current = false;
          setCheckingMic(false);
          announceRef.current(message);
        }
      }, 1500);
    } catch (error) {
      if (!mounted.current || generation !== diagnosticGeneration.current) return;
      diagnosticStream.current?.getTracks().forEach((track) => track.stop());
      diagnosticStream.current = null;
      if (mounted.current && generation === diagnosticGeneration.current) {
        const message =
          error instanceof DOMException && error.name === "NotAllowedError"
            ? "Microphone test permission was denied. Use browser site settings to allow it, or keep using keyboard controls."
            : "Could not open this microphone. Check device permissions and the selected input. Recognition still uses your system or browser default input.";
        setMicReport(message);
        announceRef.current(message);
        setCheckingMic(false);
      }
      diagnosticBusy.current = false;
    }
  }
  useEffect(() => {
    mounted.current = true;
    setSupported({
      recognition: Boolean(
        (window as SpeechWindow).SpeechRecognition ??
        (window as SpeechWindow).webkitSpeechRecognition,
      ),
      synthesis: "speechSynthesis" in window,
      capture: Boolean(navigator.mediaDevices?.getUserMedia),
    });
    const load = () => setVoices(window.speechSynthesis?.getVoices() ?? []);
    load();
    window.speechSynthesis?.addEventListener("voiceschanged", load);
    const focus = (event: FocusEvent) => {
      if (!pageAccessRef.current?.checked) return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        !target.closest("[data-webguide-voice]") &&
        main()?.contains(target)
      ) {
        document
          .querySelectorAll("[data-webguide-focused]")
          .forEach((element) => element.removeAttribute("data-webguide-focused"));
        target.setAttribute("data-webguide-focused", "true");
        lastTarget.current = target;
      }
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        stopAll();
        return;
      }
      if (!event.altKey || !event.shiftKey || event.ctrlKey || event.metaKey || event.repeat)
        return;
      if (event.code === "KeyM") {
        event.preventDefault();
        toggleRef.current();
        return;
      }
      const shortcuts: Record<string, string> = {
        KeyN: "next",
        KeyP: "previous",
        KeyR: "read page",
        KeyH: "next heading",
        KeyL: "next link",
        KeyF: "next form",
        Home: "first",
        End: "last",
      };
      const command = shortcuts[event.code];
      if (command) {
        event.preventDefault();
        runRef.current(command);
      }
    };
    document.addEventListener("focusin", focus);
    document.addEventListener("keydown", key);
    return () => {
      mounted.current = false;
      activeRef.current = false;
      clearTimer(commandTimer);
      clearTimer(restartTimer);
      clearTimer(captureTimer);
      clearTimer(conversationTimer);
      clearTimer(diagnosticTimer);
      clearTimer(speechStartTimer);
      const session = recognition.current;
      recognition.current = null;
      session?.abort();
      diagnosticGeneration.current += 1;
      diagnosticStream.current?.getTracks().forEach((track) => track.stop());
      speechGeneration.current += 1;
      window.speechSynthesis?.cancel();
      window.speechSynthesis?.removeEventListener("voiceschanged", load);
      document.removeEventListener("focusin", focus);
      document.removeEventListener("keydown", key);
      document
        .querySelectorAll("[data-webguide-focused]")
        .forEach((element) => element.removeAttribute("data-webguide-focused"));
    };
  }, [stopAll]);
  const lastSection = useRef(currentSection);
  useEffect(() => {
    stopSpeech();
    stopListening();
    setPending(null);
    lastTarget.current = null;
    document
      .querySelectorAll("[data-webguide-focused]")
      .forEach((element) => element.removeAttribute("data-webguide-focused"));
    if (lastSection.current !== currentSection) {
      lastSection.current = currentSection;
      setPageAccess(false);
      announceRef.current(`${currentSection}. Allow page reading, then say Read page or Next.`);
    }
  }, [currentSection, stopListening, stopSpeech]);
  useEffect(() => {
    if (!pending) return;
    if (moreVoiceRef.current) moreVoiceRef.current.open = true;
    confirmationRef.current?.focus();
    const epoch = stopEpoch.current;
    const timeout = window.setTimeout(
      () => {
        if (epoch !== stopEpoch.current) return;
        if (
          confirmationRef.current
            ?.closest(".wg-voice-confirmation")
            ?.contains(document.activeElement) &&
          pending.element.isConnected
        )
          pending.element.focus();
        setPending(null);
        announceRef.current("The pending action expired. Ask to click or choose again.");
      },
      Math.max(0, pending.expires - Date.now()),
    );
    return () => window.clearTimeout(timeout);
  }, [pending]);
  const compactStatus =
    status.length > 260
      ? `${status.slice(0, 230)}… Full guidance is in the transcript below.`
      : status;
  const startGuide = () => {
    stopAll();
    if (!supported.synthesis) {
      announce(
        "Speech playback is unavailable. Keyboard and screen-reader guidance remain available.",
      );
      return;
    }
    spokenRef.current = true;
    setSpoken(true);
    announce(
      language.startsWith("hi")
        ? "नमस्ते। सुनने के लिए Listen दबाएँ। अगला, पिछला, पेज पढ़ो या मदद कहें। एस्केप से सब बंद होगा।"
        : "Welcome to WebGuide. Tab moves between buttons; Enter chooses. Allow page reading before I inspect this section. Press Listen, then say Allow page reading, Read page, or Help. Escape stops everything and revokes page access.",
      true,
    );
  };
  return (
    <section
      id="voice-assistant"
      tabIndex={-1}
      className={`gf-card wg-voice wg-voice-compact ${currentSection === "Overview" ? "wg-voice-home" : "wg-voice-workspace"}`}
      data-webguide-voice
      aria-labelledby="voice-heading"
    >
      <div className="gf-section-title">
        <div>
          <span className="gf-pill">VOICE CONTROLS</span>
          <h2 id="voice-heading">Explore with your voice</h2>
        </div>
        <span className="wg-voice-indicator">
          {checkingMic
            ? "Testing microphone"
            : listening
              ? "Listening"
              : talking
                ? "Speaking"
                : conversationActive
                  ? "Conversation active"
                  : "Microphone off"}
        </span>
      </div>

      <div className="gf-toolbar wg-voice-controls">
        <button type="button" id="start-voice-guide" className="gf-primary" onClick={startGuide}>
          Start voice guide
        </button>
        <button
          type="button"
          aria-label={
            listening
              ? "Listening… Stop microphone"
              : conversationActive
                ? "Pause listening"
                : "Listen: start microphone"
          }
          aria-pressed={listening || conversationActive}
          aria-describedby="voice-privacy"
          disabled={!supported.recognition}
          onClick={toggleMicrophone}
        >
          {listening ? "Listening…" : conversationActive ? "Pause listening" : "Listen"}
        </button>
        <button type="button" onClick={stopAll}>
          Stop
        </button>
        <button type="button" onClick={() => run("read page")}>
          Read page
        </button>
        <button type="button" onClick={() => run("next")}>
          Next
        </button>
        <button type="button" onClick={() => run("previous")}>
          Back
        </button>
      </div>
      <div
        className="wg-access-options gf-toolbar"
        role="group"
        aria-label="Choose guidance output"
      >
        <button
          type="button"
          aria-pressed={!spoken}
          onClick={() => {
            stopAll();
            announce(
              "Screen-reader mode. WebGuide audio is off. Use Tab to explore controls, or choose Listen for a voice command.",
            );
          }}
        >
          Use my screen reader
        </button>
        <button type="button" onClick={() => announce(quickHelp)}>
          Quick help
        </button>
      </div>
      <p className="wg-keyboard-hint">Tab to move · Enter to choose · Esc to stop</p>
      <label className="wg-page-permission">
        <input
          ref={pageAccessRef}
          type="checkbox"
          aria-label="Allow page reading and navigation in this section"
          checked={pageAccess}
          onChange={(event) => {
            if (event.target.checked) {
              setPageAccess(true);
              announce("Page reading allowed for this section.");
            } else stopAll();
          }}
        />{" "}
        <span aria-hidden="true">Allow page reading</span>
      </label>
      <div
        className="wg-voice-status"
        role="status"
        aria-live={spoken ? "off" : "polite"}
        aria-atomic="true"
      >
        {compactStatus}
      </div>
      <details ref={moreVoiceRef} className="wg-more-voice" open={pending !== null}>
        <summary>More voice and AI options</summary>
        <PageGuidance
          ref={guidanceRef}
          section={currentSection}
          pageAccessGranted={pageAccess}
          language={language}
          announce={announce}
          onConnect={() => onNavigate("Explorer")}
        />
        {!supported.recognition && <p>Voice input unavailable here. Use keyboard or buttons.</p>}
        {pending && (
          <div
            className="gf-notice wg-voice-confirmation"
            role="group"
            aria-label="Confirm voice action"
          >
            <p>
              {pending.kind === "choose" ? `Choose ${pending.option?.label} in` : "Activate"}{" "}
              <strong>{pending.name}</strong>? This may change the page or submit information.
            </p>
            <button ref={confirmationRef} type="button" onClick={() => run("confirm")}>
              Confirm action
            </button>
            <button type="button" onClick={() => run("cancel")}>
              Cancel action
            </button>
          </div>
        )}
        <div className="wg-advanced-options">
          <details className="wg-voice-options">
            <summary>Voice options and microphones</summary>
            <p id="voice-privacy" className="gf-muted">
              You choose when the microphone starts. Browser speech services may process audio
              online.
            </p>

            <label className="wg-voice-toggle">
              <input
                type="checkbox"
                checked={keepListening}
                onChange={(event) => {
                  const enabled = event.target.checked;
                  keepListeningRef.current = enabled;
                  setKeepListening(enabled);
                  if (!enabled) {
                    endConversation();
                    stopListening();
                  }
                  announce(
                    enabled
                      ? "Keep listening selected. Press Listen to start. The microphone pauses during WebGuide spoken responses and resumes afterwards, for up to five minutes or thirty listens. Escape stops it."
                      : "Keep listening off. Each Listen button press accepts one command.",
                  );
                }}
              />
              Keep listening after each response
            </label>
            <p>
              Optional conversation mode stops after five minutes, 30 listens, three silent
              attempts, an error, or Escape. It does not restart after reloading the page.
              Headphones help prevent background speech being recognised.
            </p>
            <div className="gf-toolbar">
              <label>
                Command language
                <select
                  value={language}
                  onChange={(event) => {
                    stopAll();
                    setLanguage(event.target.value);
                    setVoiceName("");
                  }}
                >
                  <option value="en-IN">English</option>
                  <option value="hi-IN">हिन्दी</option>
                </select>
              </label>
              <label>
                Time to confirm an action
                <select
                  value={confirmationSeconds}
                  onChange={(event) => {
                    stopAll();
                    setConfirmationSeconds(Number(event.target.value));
                  }}
                >
                  <option value={120}>2 minutes</option>
                  <option value={600}>10 minutes</option>
                </select>
              </label>
              <label>
                Speaking speed
                <select
                  value={rate}
                  onChange={(event) => {
                    stopSpeech();
                    setRate(Number(event.target.value));
                    scheduleRef.current();
                  }}
                >
                  <option value={0.75}>Slow</option>
                  <option value={1}>Normal</option>
                  <option value={1.25}>Fast</option>
                  <option value={1.5}>Faster</option>
                </select>
              </label>
              <label>
                Speaking voice
                <select
                  value={voiceName}
                  onChange={(event) => {
                    stopSpeech();
                    setVoiceName(event.target.value);
                    scheduleRef.current();
                  }}
                >
                  <option value="">Automatic language voice</option>
                  {voices
                    .filter((voice) => voice.lang.toLowerCase().startsWith(language.slice(0, 2)))
                    .map((voice) => (
                      <option key={`${voice.name}-${voice.lang}`} value={voice.name}>
                        {voice.name} ({voice.lang})
                      </option>
                    ))}
                </select>
              </label>
              <button
                type="button"
                disabled={!supported.synthesis}
                aria-pressed={spoken}
                onClick={() => {
                  const enabled = !spokenRef.current;
                  spokenRef.current = enabled;
                  setSpoken(enabled);
                  if (enabled) announce("Spoken guidance enabled.", true);
                  else {
                    stopSpeech();
                    setStatus("Spoken guidance off. Your screen reader can read the status.");
                    scheduleRef.current();
                  }
                }}
              >
                {spoken ? "Disable spoken guidance" : "Enable spoken guidance"}
              </button>
            </div>
            <h3>Microphone access</h3>
            <p>
              Recognition uses your browser or system default microphone. Change that input in your
              browser or device settings. The capture-test selector below does not route speech
              recognition to a different microphone.
            </p>
            <div className="gf-toolbar">
              <button
                type="button"
                disabled={!supported.capture || checkingMic}
                onClick={() => void checkMicrophones(false)}
              >
                Check available microphones
              </button>
              <label>
                Microphone for capture test
                <select
                  value={testDevice}
                  disabled={checkingMic}
                  onChange={(event) => setTestDevice(event.target.value)}
                >
                  <option value="">System default</option>
                  {devices
                    .filter((device) => device.deviceId && device.deviceId !== "default")
                    .map((device, index) => (
                      <option key={device.deviceId} value={device.deviceId}>
                        {device.label || `Microphone ${index + 1}`}
                      </option>
                    ))}
                </select>
              </label>
              <button
                type="button"
                disabled={!supported.capture || checkingMic}
                onClick={() => void checkMicrophones(true)}
              >
                Test selected microphone
              </button>
            </div>
            <p>
              {micReport ||
                "Device names appear after you allow a microphone check. Tests open capture briefly and stop all tracks. No recording is saved."}
            </p>
          </details>
          <details className="wg-voice-commands" open={!supported.recognition}>
            <summary>Type a command or read the transcript</summary>
            <form
              className="gf-toolbar"
              onSubmit={(event) => {
                event.preventDefault();
                stopListening();
                const command = typed;
                setTyped("");
                setTranscript(
                  ["type", "insert"].includes(parseVoiceCommand(command).kind)
                    ? "Text entry command (content hidden)"
                    : command,
                );
                run(command);
              }}
            >
              <label htmlFor="voice-command-input">Type a command</label>
              <input
                id="voice-command-input"
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
                maxLength={1000}
                autoComplete="off"
                placeholder="Try: next heading or cursor right"
                required
              />
              <button type="submit">Run command</button>
            </form>
            <p className="wg-voice-transcript">Last command: {transcript || "No command yet"}</p>
            <p className="wg-voice-full-transcript">{status}</p>
            <p>
              Transcripts stay in this page’s memory and are not saved. Never dictate passwords,
              tokens or payment details.
            </p>
          </details>
          <details>
            <summary>Commands and keyboard shortcuts</summary>
            <button
              type="button"
              onClick={() => announce(language.startsWith("hi") ? hindiHelp : help)}
            >
              Read command help
            </button>
            <p>{help}</p>
            <p lang="hi">{hindiHelp}</p>
            <p>
              Up and Down move the text caret between logical lines in text fields. This does not
              move the operating-system mouse pointer. Private fields remain available through their
              native keyboard controls but are never read, filled or edited by the voice controller.
              All clicks and selections require confirmation.
            </p>
          </details>
        </div>
      </details>
    </section>
  );
}

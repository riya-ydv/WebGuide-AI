import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import "../../shared/page-assistance.js";

import { getBackendSession, subscribeBackendSession } from "@/features/assistance/backend-session";

export type GuidanceActions = {
  ask: (mode: "guide" | "simplify" | "explain", goal?: string) => void;
  cancel: () => void;
  grantSharing: () => void;
};

export const PageGuidance = forwardRef<
  GuidanceActions,
  {
    section: string;
    pageAccessGranted?: boolean;
    language: string;
    announce: (text: string) => void;
    onConnect: () => void;
  }
>(function PageGuidance(
  { section, pageAccessGranted = false, language, announce, onConnect },
  ref,
) {
  const session = useSyncExternalStore(subscribeBackendSession, getBackendSession, () => null);

  const [shareConsent, setShareConsentState] = useState(false);
  const sharePermit = useRef(false);
  const setShareConsent = (value: boolean) => {
    sharePermit.current = value;
    setShareConsentState(value);
  };
  const [goal, setGoal] = useState("");

  const [result, setResult] = useState<PageGuidanceResult | null>(null);

  const [busy, setBusy] = useState(false);

  const [message, setMessage] = useState("");

  const request = useRef<AbortController | null>(null);

  const previous = useRef("");

  const root = () => document.getElementById("main-content") ?? document.body;

  function cancel() {
    setShareConsent(false);
    request.current?.abort();
    request.current = null;
    setBusy(false);
  }

  function changeGoal(value: string) {
    cancel();
    setGoal(value);
    setResult(null);
    previous.current = "";
    setMessage("");
  }

  useEffect(() => {
    request.current?.abort();
    request.current = null;
    setBusy(false);
    setResult(null);
    previous.current = "";
    setMessage("");
    setShareConsent(false);
    return () => request.current?.abort();
  }, [section, session, pageAccessGranted]);

  async function ask(mode: "guide" | "simplify" | "explain", supplied?: string) {
    const allowedSharing = sharePermit.current;
    cancel();

    const intent = (supplied ?? goal).trim();

    if (!session) {
      const text = "Connect your AI service in Explorer to get page guidance.";
      setMessage(text);
      announce(text);
      return;
    }

    if (!intent && mode !== "explain") {
      const text =
        "Tell me what you want to do in the goal box, or say Guide me to followed by your goal.";
      setMessage(text);
      announce(text);
      return;
    }

    if (!pageAccessGranted || !allowedSharing) {
      const text = !pageAccessGranted
        ? "Allow page reading first. No page has been scanned."
        : "Allow AI guidance to receive this page for this request, then ask again.";
      setMessage(text);
      announce(text);
      return;
    }
    const core = window.WebGuidePageAssistance;

    const context = core.capture(root());
    if (result && result.contextRevision !== context.revision) previous.current = "";
    setResult(null);

    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setMessage("Looking at this page…");
    announce("Looking at this page. You can cancel while I prepare guidance.");

    const timeout = window.setTimeout(() => controller.abort(), 45000);

    try {
      const answer = await core.requestGuidance({
        ...session,
        goal: (intent || "Explain the page fields and their requirements").slice(0, 500),
        mode,
        language: language.startsWith("hi") ? "hi" : "en",
        context,
        signal: controller.signal,
        ...(mode !== "guide" && previous.current
          ? { previousInstruction: previous.current.slice(0, 1000) }
          : {}),
      });

      if (controller.signal.aborted || request.current !== controller) return;

      if (core.capture(root()).revision !== context.revision) {
        setResult(null);
        const text = "This page changed. Ask again so I can use the current page.";
        setMessage(text);
        announce(text);
        return;
      }

      setResult(answer);
      setMessage("");
      previous.current = [answer.message, ...answer.steps.map((step) => step.instruction)]
        .join(" ")
        .slice(0, 6000);
      announce(previous.current);
    } catch (error) {
      if (request.current === controller) {
        const text = controller.signal.aborted
          ? "Guidance request ended. Try again when ready."
          : error instanceof Error
            ? error.message
            : "Guidance is unavailable.";
        setMessage(text);
        announce(text);
      }
    } finally {
      window.clearTimeout(timeout);
      if (request.current === controller) {
        request.current = null;
        setBusy(false);
      }
    }
  }

  useImperativeHandle(ref, () => ({
    ask: (mode, goal) => {
      if (goal) setGoal(goal);
      void ask(mode, goal);
    },
    cancel,
    grantSharing: () => {
      setShareConsent(true);
      announce("AI sharing allowed for one request. Now say your goal.");
    },
  }));

  return (
    <section
      className="wg-goal"
      data-webguide-guidance
      aria-labelledby="goal-heading"
      aria-busy={busy}
    >
      <div className="wg-goal-heading">
        <h3 id="goal-heading">What would you like to do?</h3>
        <span className="wg-connection">{session ? "AI connected" : "AI not connected"}</span>
      </div>

      <label>
        <input
          type="checkbox"
          checked={shareConsent}
          onChange={(event) => setShareConsent(event.target.checked)}
        />{" "}
        Allow AI guidance to receive this page for this request
      </label>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void ask("guide");
        }}
      >
        <label className="gf-sr-only" htmlFor="guidance-goal">
          Your website goal
        </label>
        <input
          id="guidance-goal"
          value={goal}
          maxLength={500}
          onChange={(event) => changeGoal(event.target.value)}
          placeholder="For example, help me create a task"
          autoComplete="off"
        />
        <button type="submit" disabled={busy}>
          Guide me
        </button>
      </form>

      {busy && (
        <button
          type="button"
          onClick={() => {
            cancel();
            setMessage("Guidance cancelled.");
            announce("Guidance cancelled.");
          }}
        >
          Cancel guidance request
        </button>
      )}

      {!session && (
        <button type="button" className="wg-text-button" onClick={onConnect}>
          Connect AI in Explorer
        </button>
      )}

      <details>
        <summary>How page guidance works</summary>
        <p>
          Your goal and visible page labels go to your connected AI service. Field values are
          excluded. Guidance describes steps; it never clicks or submits. A different website needs
          the website companion.
        </p>
      </details>

      {message && <p>{message}</p>}

      {result && (
        <div className="wg-guidance-result" role="region" aria-labelledby="guidance-result-heading">
          <h4 id="guidance-result-heading">Guidance for this page</h4>
          <p>{result.message}</p>
          <ol>
            {result.steps.map((step, index) => (
              <li key={index}>
                {step.instruction}
                {step.targetId && (
                  <button
                    type="button"
                    onClick={() => {
                      if (!pageAccessGranted) {
                        announce("Allow page reading first.");
                        return;
                      }
                      const core = window.WebGuidePageAssistance;
                      if (core.capture(root()).revision !== result.contextRevision) {
                        announce("The page changed. Ask for fresh guidance.");
                        return;
                      }
                      const target = core.findTarget(step.targetId!, root());
                      if (!target) {
                        announce("That control is no longer available.");
                        return;
                      }
                      if (
                        !target.hasAttribute("tabindex") &&
                        !target.matches("input,select,textarea,button,a[href]")
                      )
                        target.tabIndex = -1;
                      target.focus();
                      target.scrollIntoView({ block: "center" });
                      announce(`Focused step ${index + 1}.`);
                    }}
                  >
                    Focus step {index + 1}
                  </button>
                )}
              </li>
            ))}
          </ol>
          <div className="gf-toolbar">
            <button
              type="button"
              onClick={() => {
                if (!pageAccessGranted) {
                  announce("Allow page reading first.");
                  return;
                }
                if (
                  window.WebGuidePageAssistance.capture(root()).revision !== result.contextRevision
                ) {
                  setResult(null);
                  previous.current = "";
                  announce("The page changed. Ask for fresh guidance.");
                  return;
                }
                announce(previous.current);
              }}
            >
              Repeat guidance
            </button>
            <button type="button" disabled={busy} onClick={() => void ask("simplify")}>
              Simplify guidance
            </button>
            <button type="button" disabled={busy} onClick={() => void ask("explain")}>
              Explain fields
            </button>
          </div>
        </div>
      )}
    </section>
  );
});

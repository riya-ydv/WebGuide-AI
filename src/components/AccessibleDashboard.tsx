import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  Bookmark,
  Check,
  Compass,
  Flag,
  HelpCircle,
  ShieldCheck,
} from "lucide-react";
import type { StoredWebGuideData } from "@/features/webguide/types";
import type { Workspace } from "@/features/webguide/workspace";

export function dashboardProgress(data: StoredWebGuideData, workspace: Workspace) {
  const completed = data.tutorials.filter((guide) =>
    workspace.completedTutorialIds.includes(guide.id),
  ).length;
  const verified = data.runs.some((run) =>
    run.traces.some(
      (trace) => trace.result.status === "executed" && Boolean(trace.result.observedOutcome),
    ),
  );
  return [
    {
      title: "Keep a website close",
      detail: "Save a website to find it again quickly.",
      complete: workspace.savedSites.length > 0,
      evidence: "A website is saved in this browser.",
      destination: "Saved websites",
      action: "Save a website",
    },
    {
      title: "Follow a saved guide",
      detail: "Read a tutorial and mark it complete when you are ready.",
      complete: completed > 0,
      evidence: `${completed} saved ${completed === 1 ? "guide is" : "guides are"} marked complete by you.`,
      destination: "Tutorials",
      action: "Open tutorials",
    },
    {
      title: "Check an action result",
      detail: "Try the sandbox and review an observed result.",
      complete: verified,
      evidence: "A sandbox action has a recorded observed result.",
      destination: "Explorer",
      action: "Open sandbox",
    },
  ];
}

export function AccessibleDashboard({
  data,
  workspace,
  onNavigate,
  aiStatus,
}: {
  data: StoredWebGuideData;
  workspace: Workspace;
  onNavigate: (section: string) => void;
  aiStatus: string;
}) {
  const [showProgress, setShowProgress] = useState(false);
  useEffect(() => {
    try {
      setShowProgress(localStorage.getItem("webguide-show-progress-v1") === "true");
    } catch {
      /* Session-only preference remains available. */
    }
  }, []);
  const milestones = dashboardProgress(data, workspace);
  const achieved = milestones.filter((item) => item.complete).length;
  function toggleProgress() {
    const next = !showProgress;
    setShowProgress(next);
    try {
      localStorage.setItem("webguide-show-progress-v1", String(next));
    } catch {
      /* No storage is required to use this control. */
    }
  }
  return (
    <div className="wg-dashboard">
      <section className="wg-practice" aria-labelledby="practice-heading">
        <div className="wg-practice-symbol" aria-hidden="true">
          <Compass size={34} />
        </div>
        <div className="wg-practice-copy">
          <span className="wg-kicker">TRY IT SAFELY</span>
          <h2 id="practice-heading">Your first guided task</h2>
          <p>Find information and try a form on our practice website.</p>
          <a
            className="gf-primary wg-button-link"
            href="/demo-service.html"
            target="_blank"
            rel="noopener noreferrer"
          >
            Open practice website <ArrowUpRight size={18} aria-hidden="true" />
            <span className="wg-sr-only"> (opens a new tab)</span>
          </a>
        </div>
        <div className="wg-practice-note">
          <ShieldCheck size={21} aria-hidden="true" />
          <span>
            You choose each action.
            <br />
            Stop or Escape stops WebGuide.
          </span>
        </div>
      </section>
      <section className="wg-quick-links" aria-label="Continue or get help">
        <button onClick={() => onNavigate("Website companion")}>
          <Compass size={21} aria-hidden="true" />
          <span>
            <strong>Use another website</strong>
            <small>Open the companion setup</small>
          </span>
          <ArrowUpRight size={18} aria-hidden="true" />
        </button>
        <button onClick={() => onNavigate("Saved websites")}>
          <Bookmark size={21} aria-hidden="true" />
          <span>
            <strong>Your saved websites</strong>
            <small>
              {workspace.savedSites.length
                ? `${workspace.savedSites.length} saved in this browser`
                : "Keep useful pages together"}
            </small>
          </span>
          <ArrowUpRight size={18} aria-hidden="true" />
        </button>
        <button onClick={() => onNavigate("FAQs")}>
          <HelpCircle size={21} aria-hidden="true" />
          <span>
            <strong>Help and first steps</strong>
            <small>Voice, keyboard and setup help</small>
          </span>
          <ArrowUpRight size={18} aria-hidden="true" />
        </button>
      </section>
      <section className="wg-journey" aria-labelledby="journey-heading">
        <div className="wg-journey-heading">
          <div>
            <span className="wg-kicker">Your pace, no pressure</span>
            <h2 id="journey-heading">Your milestones</h2>
            <p>{achieved} of 3 workspace milestones reached. Progress is optional.</p>
          </div>
          <button
            aria-expanded={showProgress}
            aria-controls="workspace-milestones"
            onClick={toggleProgress}
          >
            {showProgress ? "Hide progress" : "Show progress"}
          </button>
        </div>
        <div id="workspace-milestones" hidden={!showProgress}>
          <label className="wg-sr-only" htmlFor="milestone-progress">
            Workspace milestones reached
          </label>
          <progress id="milestone-progress" value={achieved} max={3}>
            {achieved} of 3
          </progress>
          <ol className="wg-milestones">
            {milestones.map((item, index) => (
              <li key={item.title} data-complete={item.complete}>
                <span className="wg-milestone-symbol" aria-hidden="true">
                  {item.complete ? <Check size={23} /> : <Flag size={23} />}
                </span>
                <span className="wg-milestone-state">
                  {item.complete ? "Reached" : `Step ${index + 1}`}
                </span>
                <h3>{item.title}</h3>
                <p>{item.complete ? item.evidence : item.detail}</p>
                <button onClick={() => onNavigate(item.destination)}>{item.action}</button>
              </li>
            ))}
          </ol>
          <p className="wg-progress-note">
            Based on records in this browser. These milestones are not a score of your ability. You
            can use every feature without completing them.
          </p>
        </div>
      </section>
      <details className="wg-workspace-summary">
        <summary>Workspace details</summary>
        <dl>
          <div>
            <dt>Saved exploration runs</dt>
            <dd>{data.runs.length}</dd>
          </div>
          <div>
            <dt>Saved tutorials</dt>
            <dd>{data.tutorials.length}</dd>
          </div>
          <div>
            <dt>AI service</dt>
            <dd>{aiStatus}</dd>
          </div>
        </dl>
        <button onClick={() => onNavigate("Explorer")}>Check AI connection</button>
      </details>
    </div>
  );
}

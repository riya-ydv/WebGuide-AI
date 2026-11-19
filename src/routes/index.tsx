import { readCompatibleStorage } from "@/features/webguide/storage-compat";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  BookOpen,
  Compass,
  LayoutDashboard,
  Layers,
  MessageCircle,
  Play,
  Settings,
  Sparkles,
  Square,
  Workflow,
  CircleHelp,
} from "lucide-react";
import { AccessibleDashboard } from "@/components/AccessibleDashboard";
import { VoiceAssistant } from "@/components/VoiceAssistant";
import { WebsiteCompanion } from "@/components/WebsiteCompanion";
import { HelpCenter } from "@/components/HelpCenter";
import { TaskDesk } from "@/components/TaskDesk";
import {
  emptyWebGuideData,
  initialDemoState,
  parseStoredData,
  STORAGE_KEY,
  validateStoredData,
} from "@/features/webguide/storage";
import { runTaskDeskExploration } from "@/features/webguide/explorer";
import type { StoredWebGuideData, Tutorial } from "@/features/webguide/types";
import { WorkerPanel } from "@/components/WorkerPanel";
import { WorkspaceSettings } from "@/components/WorkspaceSettings";
import { GuideLibrary } from "@/components/GuideLibrary";
import { RunHistory } from "@/components/RunHistory";
import { SavedWebsites } from "@/components/SavedWebsites";
import {
  defaultWorkspace,
  parseWorkspace,
  validateWorkspace,
  WORKSPACE_KEY,
  avatarColors,
  type Workspace,
} from "@/features/webguide/workspace";
import "@/webguide.css";
import "@/components/workspace-refinement.css";

export const Route = createFileRoute("/")({ component: WebGuide });
const navigation = [
  ["Overview", LayoutDashboard],
  ["Website companion", Compass],
  ["Explorer", Compass],
  ["Features", Layers],
  ["Tutorials", BookOpen],
  ["Ask WebGuide", MessageCircle],
  ["Saved websites", Compass],
  ["Run history", Layers],
  ["Profile", Settings],
  ["Settings", Settings],
  ["FAQs", CircleHelp],
] as const;

function WebGuide() {
  const [tab, setTab] = useState<string>("Overview");
  const [data, setData] = useState<StoredWebGuideData>(emptyWebGuideData);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [workspace, setWorkspace] = useState(defaultWorkspace);
  const [selectedSite, setSelectedSite] = useState<{ url: string; key: number }>();
  const [runFilter, setRunFilter] = useState<string>();
  const [pendingImport, setPendingImport] = useState<{
    data: StoredWebGuideData;
    workspace: Workspace;
  }>();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [mode, setMode] = useState<"beginner" | "refresher">("beginner");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<Tutorial[]>([]);
  const [asked, setAsked] = useState(false);
  const [demoKey, setDemoKey] = useState(0);
  const [aiStatus, setAIStatus] = useState("Not checked");
  const root = useRef<HTMLDivElement>(null);
  const previousTab = useRef(tab);
  useEffect(() => {
    if (previousTab.current === tab) return;
    previousTab.current = tab;
    const frame = requestAnimationFrame(() =>
      document.querySelector<HTMLElement>("#main-content h1")?.focus(),
    );
    return () => cancelAnimationFrame(frame);
  }, [tab]);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    try {
      setData(parseStoredData(readCompatibleStorage(localStorage, STORAGE_KEY)));
      const savedWorkspace = parseWorkspace(readCompatibleStorage(localStorage, WORKSPACE_KEY));
      setWorkspace(savedWorkspace);
      setMode(savedWorkspace.preferences.defaultInstructionMode);
    } catch {
      setNotice("Browser storage is unavailable. Results will last only for this session.");
    }
    setReady(true);
    return () => controller.current?.abort();
  }, []);
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      setNotice(
        "Could not save results: browser storage is full or unavailable. Export your evidence.",
      );
    }
  }, [data, ready]);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(WORKSPACE_KEY, JSON.stringify(workspace));
    } catch {
      setNotice("Workspace could not be saved. Export a backup before closing.");
    }
  }, [workspace, ready]);
  function updateWorkspace(next: Workspace) {
    setWorkspace(next);
    setMode(next.preferences.defaultInstructionMode);
  }
  function toggleGuide(key: "bookmarkedTutorialIds" | "completedTutorialIds", id: string) {
    setWorkspace((previous) => ({
      ...previous,
      [key]: previous[key].includes(id)
        ? previous[key].filter((value) => value !== id)
        : [...previous[key], id],
    }));
  }
  async function importBackup(file?: File) {
    setPendingImport(undefined);
    if (!file) return;
    try {
      if (file.size > 10_000_000) throw new Error("Backup exceeds 10 MB");
      const raw = JSON.parse(await file.text());
      if (!["webguide-backup", "guideflow-backup"].includes(raw.format) || raw.version !== 1)
        throw new Error("Unsupported backup format");
      setPendingImport({
        data: validateStoredData(JSON.stringify(raw.data)),
        workspace: validateWorkspace(JSON.stringify(raw.workspace)),
      });
      setNotice("Backup validated. Review the counts in Settings before replacing local data.");
    } catch {
      setNotice("Invalid or oversized backup. Existing data has not changed.");
    }
  }
  async function runDemo() {
    if (busy || !root.current) return;
    setBusy(true);
    setNotice("Observing rendered TaskDesk controls…");
    setTab("Explorer");
    const abort = new AbortController();
    controller.current = abort;
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
    try {
      const run = await runTaskDeskExploration(root.current, {
        signal: abort.signal,
        onEvent(event) {
          if (event.type === "tutorial-generated")
            setData((previous) => ({
              ...previous,
              tutorials: [...previous.tutorials, event.tutorial].slice(-250),
            }));
          if (
            event.type === "run-started" ||
            event.type === "action-result" ||
            event.type === "run-completed"
          ) {
            setData((previous) => {
              const runs = [
                ...previous.runs.filter((item) => item.id !== event.run.id),
                event.run,
              ].slice(-30);
              const retained = new Set(runs.map((item) => item.id));
              return {
                ...previous,
                runs,
                tutorials: previous.tutorials.filter((item) => retained.has(item.sourceRunId)),
              };
            });
            setNotice(`${event.run.status} · ${event.run.traces.length} recorded actions`);
          }
        },
      });
      setNotice(
        `Exploration ${run.status}. ${run.traces.filter((trace) => trace.result.status === "executed").length} verified actions; ${run.blockedReasons.length} limitations.`,
      );
    } catch {
      setNotice(
        "Exploration failed. Recorded evidence is retained; reset the disposable demo before retrying.",
      );
    } finally {
      setBusy(false);
      controller.current = null;
    }
  }
  function resetDemo() {
    setDemoKey((previous) => previous + 1);
    setData((previous) => ({
      ...previous,
      demoState: structuredClone(initialDemoState),
      tutorials: previous.tutorials.map((item) => ({
        ...item,
        verificationStatus: "Needs re-verification",
      })),
    }));
    setNotice(
      "Disposable TaskDesk reset. Previous evidence retained and marked for re-verification.",
    );
  }
  function exportData() {
    const link = document.createElement("a");
    const url = URL.createObjectURL(
      new Blob(
        [JSON.stringify({ format: "webguide-backup", version: 1, data, workspace }, null, 2)],
        { type: "application/json" },
      ),
    );
    link.href = url;
    link.download = "webguide-backup.json";
    link.click();
    URL.revokeObjectURL(url);
  }
  const latest = data.runs.at(-1);
  return (
    <div
      className={`gf-app ${workspace.preferences.compactLayout ? "gf-compact" : ""}`}
      data-reduced-motion={workspace.preferences.reducedMotion}
    >
      <a className="wg-skip" href="#start-voice-guide">
        Skip to voice controls
      </a>
      <a className="wg-skip" href="#main-content">
        Skip to main content
      </a>
      <aside className="gf-sidebar" aria-label="Workspace sidebar">
        <a
          className="gf-brand"
          href="#"
          onClick={(event) => {
            event.preventDefault();
            setTab("Overview");
          }}
        >
          <span className="gf-logo">
            <Workflow size={24} aria-hidden="true" />
          </span>
          WebGuide<span className="gf-ai">AI</span>
        </a>
        <div className="gf-workspace">
          <span className="gf-avatar">
            {workspace.profile.workspaceName.slice(0, 1).toUpperCase()}
          </span>
          <div>
            {workspace.profile.workspaceName}
            <small>Your accessible workspace</small>
          </div>
          <span className="gf-dot" />
        </div>

        <nav aria-label="Main navigation">
          {[
            {
              title: "Explore",
              sections: ["Overview", "Website companion", "Explorer", "Ask WebGuide"],
            },
            {
              title: "Your library",
              sections: ["Tutorials", "Saved websites", "Run history", "Features"],
            },
            { title: "Preferences & help", sections: ["Profile", "Settings", "FAQs"] },
          ].map((group) => (
            <div className="wg-nav-group" key={group.title}>
              <p className="wg-nav-label">{group.title}</p>
              {navigation
                .filter(([name]) => group.sections.includes(name))
                .map(([name, Icon]) => (
                  <button
                    key={name}
                    className={tab === name ? "active" : ""}
                    aria-current={tab === name ? "page" : undefined}
                    onClick={() => {
                      setTab(name);
                      if (name === "Tutorials") setRunFilter(undefined);
                    }}
                  >
                    <Icon size={19} aria-hidden="true" />
                    {name}
                    {name === "Tutorials" && (
                      <span className="gf-count">{data.tutorials.length}</span>
                    )}
                  </button>
                ))}
            </div>
          ))}
        </nav>
        <div className="gf-sidebar-bottom">
          <div className="gf-tip">
            <Sparkles size={19} />
            <strong>Your pace. Your choice.</strong>
            <p>Speak, type or use your keyboard. You stay in control.</p>
          </div>
          <small>Stored on this browser</small>
          <button
            className="gf-profile"
            onClick={() => setTab("Profile")}
            aria-label="Edit profile"
          >
            <span
              className="gf-avatar"
              style={{ background: avatarColors[workspace.profile.avatarColor] }}
            >
              {workspace.profile.displayName.slice(0, 1).toUpperCase()}
            </span>
            {workspace.profile.displayName}
          </button>
        </div>
      </aside>
      <div className="gf-main">
        <header className="gf-topbar">
          <select
            className="gf-mobile-navigation"
            aria-label="Go to section"
            value={tab}
            onChange={(e) => {
              setTab(e.target.value);
              if (e.target.value === "Tutorials") setRunFilter(undefined);
            }}
          >
            {navigation.map(([name]) => (
              <option key={name}>{name}</option>
            ))}
          </select>
          <span>
            Workspace <span className="gf-muted">/</span> <strong>{tab}</strong>
          </span>
          <span className="gf-local">Voice or keyboard. Your choice.</span>
        </header>
        <main id="main-content" tabIndex={-1} aria-label={tab}>
          <div
            className={tab === "Overview" ? "gf-page-heading wg-home-heading" : "gf-page-heading"}
          >
            <div>
              <p className="gf-eyebrow">YOUR ACCESSIBLE WORKSPACE</p>
              <h1 id="section-heading" tabIndex={-1}>
                {tab === "Overview" ? "Start with WebGuide AI" : tab}
              </h1>
              <p className="gf-muted">
                {tab === "Overview"
                  ? "One step at a time. Speak, type or use your keyboard."
                  : tab === "FAQs"
                    ? "Find answers, solve setup issues and get more from your workspace."
                    : tab === "Profile"
                      ? "Your details and accessibility preferences."
                      : tab === "Tutorials"
                        ? "Instructions you can return to at your own pace."
                        : tab === "Explorer"
                          ? "Connect your AI service or try the practice space."
                          : ""}
              </p>
            </div>
            <button
              hidden={tab !== "Explorer"}
              className="gf-primary"
              disabled={!ready || busy}
              onClick={() => void runDemo()}
            >
              <Play size={16} />
              Run Autonomous Demo
            </button>
          </div>
          <VoiceAssistant currentSection={tab} onNavigate={setTab} />
          {notice && (
            <div className="gf-notice" role="status">
              {notice}
              {busy && (
                <button onClick={() => controller.current?.abort()}>
                  <Square size={14} />
                  Cancel exploration
                </button>
              )}
            </div>
          )}
          {tab === "Overview" && (
            <AccessibleDashboard
              data={data}
              workspace={workspace}
              onNavigate={setTab}
              aiStatus={aiStatus}
            />
          )}
          <div hidden={tab !== "Explorer"}>
            <WorkerPanel onAIStatus={setAIStatus} selectedSite={selectedSite} />
            <section className="gf-card gf-demo">
              <div className="gf-section-title">
                <div>
                  <span className="gf-pill">PRACTICE SPACE</span>
                  <h2>Practise a task</h2>
                </div>
                <button disabled={busy} onClick={resetDemo}>
                  Reset demo
                </button>
              </div>
              <p className="gf-muted">
                Try forms safely. Changes stay in this demo; automatic exploration here uses fixed
                rules.
              </p>
              <TaskDesk
                key={demoKey}
                ref={root}
                state={data.demoState}
                onChange={(demoState) => setData((previous) => ({ ...previous, demoState }))}
              />
            </section>
            <RunLog run={latest} />
          </div>
          {tab === "Features" && (
            <section className="gf-card">
              <h2>Discovered controls</h2>
              <p className="gf-muted">
                Live observations from the latest exploration. Discovery alone does not verify a
                workflow.
              </p>
              {!latest && <Empty text="Run an exploration to discover supported controls." />}
              {latest?.observations.map((observation) => (
                <div key={observation.id}>
                  <h3>{observation.pageName}</h3>
                  <div className="gf-controls">
                    {observation.controls.map((control) => (
                      <span key={control.id}>
                        {control.accessibleName || "(unnamed control)"}{" "}
                        <small>{control.role}</small>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </section>
          )}
          {tab === "Tutorials" && (
            <>
              {runFilter && (
                <div className="gf-notice">
                  Showing guides for one run{" "}
                  <button onClick={() => setRunFilter(undefined)}>Show all guides</button>
                </div>
              )}
              <GuideLibrary
                tutorials={data.tutorials.filter((t) => !runFilter || t.sourceRunId === runFilter)}
                mode={mode}
                onModeChange={setMode}
                bookmarkedIds={workspace.bookmarkedTutorialIds}
                completedIds={workspace.completedTutorialIds}
                onBookmark={(id) => toggleGuide("bookmarkedTutorialIds", id)}
                onComplete={(id) => toggleGuide("completedTutorialIds", id)}
                onDelete={(id) => {
                  setData((previous) => ({
                    ...previous,
                    tutorials: previous.tutorials.filter((t) => t.id !== id),
                  }));
                  setWorkspace((previous) => ({
                    ...previous,
                    bookmarkedTutorialIds: previous.bookmarkedTutorialIds.filter((v) => v !== id),
                    completedTutorialIds: previous.completedTutorialIds.filter((v) => v !== id),
                  }));
                  setAnswer([]);
                }}
              />
            </>
          )}
          {tab === "Run history" && (
            <RunHistory
              runs={data.runs}
              onOpenTutorials={(id) => {
                setRunFilter(id);
                setTab("Tutorials");
              }}
              onDelete={(id) =>
                setData((previous) => ({
                  ...previous,
                  runs: previous.runs.filter((r) => r.id !== id),
                  tutorials: previous.tutorials.filter((t) => t.sourceRunId !== id),
                }))
              }
            />
          )}
          {tab === "Saved websites" && (
            <SavedWebsites
              value={workspace}
              onChange={setWorkspace}
              onOpen={(url) => {
                setSelectedSite({ url, key: Date.now() });
                setTab("Explorer");
              }}
            />
          )}
          {tab === "Website companion" && <WebsiteCompanion />}
          {tab === "FAQs" && <HelpCenter onNavigate={setTab} />}
          {tab === "Profile" && <WorkspaceSettings value={workspace} onChange={updateWorkspace} />}
          {tab === "Ask WebGuide" && (
            <section className="gf-card">
              <span className="gf-icon">
                <MessageCircle />
              </span>
              <h2>Search your saved guides</h2>
              <p className="gf-muted">
                Find a saved tutorial by its name. For page-specific AI help, open More voice and AI
                options.
              </p>
              <form
                className="gf-toolbar"
                onSubmit={(e) => {
                  e.preventDefault();
                  const words =
                    question
                      .toLowerCase()
                      .match(/[a-z0-9]+/g)
                      ?.filter(
                        (word) =>
                          word.length > 3 &&
                          !["what", "does", "this", "that", "with", "have", "about"].includes(word),
                      ) ?? [];
                  setAnswer(
                    data.tutorials
                      .filter(
                        (t) =>
                          words.length > 0 &&
                          words.every((word) =>
                            `${t.title} ${t.goal} ${t.steps.map((step) => step.targetControl).join(" ")}`
                              .toLowerCase()
                              .includes(word),
                          ),
                      )
                      .slice(-5),
                  );
                  setAsked(true);
                }}
              >
                <input
                  aria-label="Ask a question"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Try a discovered label, such as Add project"
                  required
                  maxLength={500}
                />
                <button className="gf-primary">Find evidence</button>
              </form>
              {asked && !answer.length && (
                <Empty text="I do not have evidence for that feature. Explore it before relying on instructions." />
              )}
              {answer.map((t) => (
                <TutorialCard key={t.id} tutorial={t} mode="beginner" />
              ))}
            </section>
          )}
          {tab === "Settings" && (
            <>
              <WorkspaceSettings
                value={workspace}
                onChange={updateWorkspace}
                section="preferences"
              />
              <section className="gf-card">
                <h2>Workspace & privacy</h2>
                <p>
                  Demo records are stored on this browser. Exporting produces a local file, not a
                  public share link.
                </p>
                <p>
                  The external worker has separate readiness, credentials and retention. Provider
                  keys stay on the server. No personal browser profile is used.
                </p>
                <div className="gf-toolbar">
                  <button onClick={exportData}>Export local evidence</button>
                  <button disabled={busy} onClick={() => setConfirmDelete(true)}>
                    Delete local records
                  </button>
                  {confirmDelete && (
                    <div role="alert">
                      Delete all local demo evidence? Profile and saved websites are kept.
                      <button onClick={() => setConfirmDelete(false)}>Keep records</button>
                      <button
                        disabled={busy}
                        onClick={() => {
                          setConfirmDelete(false);
                          setAnswer([]);
                          setWorkspace((previous) => ({
                            ...previous,
                            bookmarkedTutorialIds: [],
                            completedTutorialIds: [],
                          }));
                          setDemoKey((previous) => previous + 1);
                          setData(emptyWebGuideData());
                          setNotice("Local demo records and tutorials deleted.");
                        }}
                      >
                        Confirm delete records
                      </button>
                    </div>
                  )}
                </div>
                <label className="gf-stack">
                  Restore WebGuide backup
                  <input
                    type="file"
                    accept="application/json,.json"
                    disabled={busy}
                    onChange={(e) => {
                      void importBackup(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                </label>
                {pendingImport && (
                  <div className="gf-notice">
                    Backup contains {pendingImport.data.runs.length} runs,{" "}
                    {pendingImport.data.tutorials.length} tutorials and{" "}
                    {pendingImport.workspace.savedSites.length} saved websites. Applying replaces
                    local data and profile.
                    <button
                      disabled={busy}
                      onClick={() => {
                        setData(pendingImport.data);
                        updateWorkspace(pendingImport.workspace);
                        setDemoKey((k) => k + 1);
                        setPendingImport(undefined);
                        setAnswer([]);
                        setRunFilter(undefined);
                        setNotice("Backup restored in this browser.");
                      }}
                    >
                      Replace with backup
                    </button>
                    <button onClick={() => setPendingImport(undefined)}>Cancel restore</button>
                  </div>
                )}
                <h3>Supported scope</h3>
                <p>
                  Browser applications only. Protected-site authentication and in-page overlays are
                  not implemented. External real-site exploration is read-only and may be partial.
                </p>
              </section>
            </>
          )}
          <footer>
            WebGuide AI <span>Evidence first. Always.</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <div className="gf-empty">
      <BookOpen size={30} />
      <p>{text}</p>
    </div>
  );
}
function RunLog({ run }: { run: StoredWebGuideData["runs"][number] | undefined }) {
  return (
    <section className="gf-card">
      <h2>Exploration evidence</h2>
      {!run ? (
        <Empty text="Your observations and action results will appear here." />
      ) : (
        <>
          <p>
            {run.id} · {run.status}
          </p>
          {run.traces.map((trace) => (
            <details key={trace.id}>
              <summary>
                {trace.result.status} — {trace.plan.observedLabel}
              </summary>
              <p>{trace.result.reason ?? "Observed outcome verified."}</p>
              <pre>{JSON.stringify(trace, null, 2)}</pre>
            </details>
          ))}
          {run.blockedReasons.map((reason, i) => (
            <p key={i}>{reason}</p>
          ))}
        </>
      )}
    </section>
  );
}
function TutorialCard({ tutorial, mode }: { tutorial: Tutorial; mode: "beginner" | "refresher" }) {
  return (
    <article className="gf-card gf-tutorial">
      <div className="gf-section-title">
        <h2>{tutorial.title}</h2>
        <span className="gf-pill">{tutorial.verificationStatus}</span>
      </div>
      <p>{tutorial.goal}</p>
      <p className="gf-muted">
        Start: {tutorial.startingPage} · {tutorial.prerequisites.join(" · ")}
      </p>
      <p>{mode === "beginner" ? tutorial.beginnerInstructions : tutorial.refresherInstructions}</p>
      <ol>
        {tutorial.steps.map((step, i) => (
          <li key={i}>
            <strong>{step.instruction}</strong>
            <p>Expected: {step.expectedResult}</p>
            <small>
              Evidence: {step.evidence.observationId} / {step.evidence.actionResultId} /{" "}
              {step.evidence.controlId}
            </small>
          </li>
        ))}
      </ol>
      <small>
        Source {tutorial.sourceRunId} · Last verified {tutorial.lastVerifiedAt} ·{" "}
        {tutorial.generator}
      </small>
    </article>
  );
}

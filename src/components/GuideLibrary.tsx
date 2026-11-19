import { useState } from "react";
import type { Tutorial } from "../features/webguide/types";

export interface GuideLibraryProps {
  tutorials: Tutorial[];
  mode: "beginner" | "refresher";
  onModeChange: (mode: "beginner" | "refresher") => void;
  bookmarkedIds: string[];
  completedIds: string[];
  onBookmark: (id: string) => void;
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
}

function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function downloadGuide(tutorial: Tutorial, mode: GuideLibraryProps["mode"]) {
  const escape = (value: string) => value.replace(/[\\`*_{}[\]<>#]/g, "\\$&");
  const markdown = [
    `# ${escape(tutorial.title)}`,
    "",
    escape(tutorial.goal),
    "",
    `Website: ${escape(tutorial.website)}`,
    `Starting page: ${escape(tutorial.startingPage)}`,
    `Verification: ${tutorial.verificationStatus}`,
    "",
    "## Prerequisites",
    ...(tutorial.prerequisites.length
      ? tutorial.prerequisites.map((item) => `- ${escape(item)}`)
      : ["None recorded."]),
    "",
    `## ${mode === "beginner" ? "Beginner" : "Refresher"} instructions`,
    escape(mode === "beginner" ? tutorial.beginnerInstructions : tutorial.refresherInstructions),
    "",
    ...tutorial.steps.flatMap((step, index) => [
      `${index + 1}. ${escape(step.instruction)}`,
      `   Target: ${escape(step.targetControl)}`,
      `   Expected: ${escape(step.expectedResult)}`,
      `   Evidence: ${escape(step.evidence.observationId)} / ${escape(step.evidence.actionResultId)} / ${escape(step.evidence.controlId)}`,
      "",
    ]),
    `Source run: ${escape(tutorial.sourceRunId)}`,
    `Last verified: ${escape(tutorial.lastVerifiedAt)}`,
    `Generator: ${tutorial.generator}`,
  ].join("\n");
  const url = URL.createObjectURL(new Blob([markdown], { type: "text/markdown;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${
    tutorial.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || "guide"
  }.md`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function GuideLibrary({
  tutorials,
  mode,
  onModeChange,
  bookmarkedIds,
  completedIds,
  onBookmark,
  onComplete,
  onDelete,
}: GuideLibraryProps) {
  const [search, setSearch] = useState("");
  const [collection, setCollection] = useState("all");
  const [verification, setVerification] = useState("all");
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const query = search.trim().toLowerCase();
  const visible = tutorials.filter(
    (tutorial) =>
      (!query ||
        [
          tutorial.title,
          tutorial.goal,
          tutorial.website,
          tutorial.startingPage,
          ...tutorial.steps.map((step) => step.instruction),
        ]
          .join(" ")
          .toLowerCase()
          .includes(query)) &&
      (collection === "all" ||
        (collection === "bookmarked"
          ? bookmarkedIds.includes(tutorial.id)
          : completedIds.includes(tutorial.id))) &&
      (verification === "all" || tutorial.verificationStatus === verification),
  );
  return (
    <section aria-label="Tutorial library" className="gf-stack">
      <div className="gf-card gf-toolbar">
        <label>
          Search tutorials
          <input
            aria-label="Search tutorials"
            type="search"
            placeholder="Search by task, website or instruction"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <label>
          Collection
          <select
            aria-label="Tutorial collection"
            value={collection}
            onChange={(event) => setCollection(event.target.value)}
          >
            <option value="all">All guides</option>
            <option value="bookmarked">Bookmarked</option>
            <option value="completed">Completed</option>
          </select>
        </label>
        <label>
          Verification
          <select
            aria-label="Tutorial verification"
            value={verification}
            onChange={(event) => setVerification(event.target.value)}
          >
            <option value="all">All statuses</option>
            {[
              "Verified in sandbox",
              "Partially explored",
              "Blocked by authentication",
              "Needs re-verification",
            ].map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
        </label>
        <label>
          Instruction mode
          <select
            aria-label="Instruction mode"
            value={mode}
            onChange={(event) =>
              onModeChange(event.target.value === "refresher" ? "refresher" : "beginner")
            }
          >
            <option value="beginner">Beginner</option>
            <option value="refresher">Refresher</option>
          </select>
        </label>
        <button type="button" disabled={!visible.length} onClick={() => window.print()}>
          Print guides
        </button>
      </div>
      <p className="gf-muted" role="status">
        Showing {visible.length} of {tutorials.length} guides ·{" "}
        {visible.filter((item) => bookmarkedIds.includes(item.id)).length} bookmarked ·{" "}
        {visible.filter((item) => completedIds.includes(item.id)).length} marked complete
      </p>
      {!visible.length && (
        <div className="gf-card gf-empty">
          <h2>{tutorials.length ? "No matching guides" : "Your guide library starts here"}</h2>
          <p>
            {tutorials.length
              ? "Try another search or clear your filters."
              : "Explore the sandbox or a website to create a guide from recorded evidence."}
          </p>
          {tutorials.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setCollection("all");
                setVerification("all");
              }}
            >
              Clear filters
            </button>
          )}
        </div>
      )}
      {visible.map((tutorial) => (
        <article key={tutorial.id} className="gf-card gf-tutorial">
          <div className="gf-section-title">
            <h2>{tutorial.title}</h2>
            <span className="gf-pill">{tutorial.verificationStatus}</span>
          </div>
          <p>{tutorial.goal}</p>
          <p className="gf-muted">
            Website: {tutorial.website} · Start: {tutorial.startingPage}
          </p>
          <h3>Prerequisites</h3>
          {tutorial.prerequisites.length ? (
            <ul>
              {tutorial.prerequisites.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          ) : (
            <p>No prerequisites recorded.</p>
          )}
          <p>
            {mode === "beginner" ? tutorial.beginnerInstructions : tutorial.refresherInstructions}
          </p>
          <ol>
            {tutorial.steps.map((step, index) => (
              <li key={index}>
                <strong>{step.instruction}</strong>
                <p>Target: {step.targetControl}</p>
                <p>Expected: {step.expectedResult}</p>
                <small>
                  Evidence: {step.evidence.observationId} / {step.evidence.actionResultId} /{" "}
                  {step.evidence.controlId}
                </small>
              </li>
            ))}
          </ol>
          <p className="gf-muted">
            Source {tutorial.sourceRunId} · Last verified {dateLabel(tutorial.lastVerifiedAt)} ·{" "}
            {tutorial.generator}
          </p>
          <div className="gf-controls gf-no-print">
            <button
              type="button"
              aria-pressed={bookmarkedIds.includes(tutorial.id)}
              onClick={() => onBookmark(tutorial.id)}
            >
              {bookmarkedIds.includes(tutorial.id) ? "Remove bookmark" : "Bookmark guide"}
            </button>
            <button
              type="button"
              aria-pressed={completedIds.includes(tutorial.id)}
              onClick={() => onComplete(tutorial.id)}
            >
              {completedIds.includes(tutorial.id) ? "Mark incomplete" : "Mark complete"}
            </button>
            <button type="button" onClick={() => downloadGuide(tutorial, mode)}>
              Download Markdown
            </button>
            <button type="button" onClick={() => setPendingDelete(tutorial.id)}>
              Delete guide
            </button>
          </div>
          {pendingDelete === tutorial.id && (
            <div
              className="gf-notice gf-no-print"
              role="group"
              aria-label={`Confirm deletion of ${tutorial.title}`}
            >
              <p>Delete “{tutorial.title}” from this browser? This cannot be undone.</p>
              <div className="gf-controls">
                <button
                  type="button"
                  onClick={() => {
                    onDelete(tutorial.id);
                    setPendingDelete(null);
                  }}
                >
                  Confirm delete guide
                </button>
                <button type="button" onClick={() => setPendingDelete(null)}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </article>
      ))}
    </section>
  );
}

import { useState } from "react";
import type { ExplorationRun } from "../features/webguide/types";

export interface RunHistoryProps {
  runs: ExplorationRun[];
  onDelete: (id: string) => void;
  onOpenTutorials: (runId: string) => void;
}

function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export function RunHistory({ runs, onDelete, onOpenTutorials }: RunHistoryProps) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const query = search.trim().toLowerCase();
  const visible = runs
    .filter(
      (run) =>
        (status === "all" || run.status === status) &&
        (!query ||
          [
            run.id,
            ...run.observations.map((item) => item.pageName),
            ...run.traces.map((trace) => trace.plan.goal),
          ]
            .join(" ")
            .toLowerCase()
            .includes(query)),
    )
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  return (
    <section aria-label="Run history" className="gf-stack">
      <div className="gf-card gf-toolbar">
        <label>
          Search runs
          <input
            type="search"
            aria-label="Search runs"
            placeholder="Search page, task or run ID"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <label>
          Status
          <select
            aria-label="Run status"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="all">All statuses</option>
            {["running", "completed", "partially completed", "cancelled", "failed"].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
      </div>
      <p className="gf-muted" role="status">
        Showing {visible.length} of {runs.length} retained runs ·{" "}
        {visible.reduce((total, run) => total + run.observations.length, 0)} recorded observations ·{" "}
        {visible.reduce((total, run) => total + run.traces.length, 0)} action records
      </p>
      <p className="gf-muted">
        History contains the runs retained in this browser. A completed run does not mean every task
        on the website was verified.
      </p>
      {!visible.length && (
        <div className="gf-card gf-empty">
          <h2>{runs.length ? "No matching runs" : "No exploration runs yet"}</h2>
          <p>
            {runs.length
              ? "Try another search or status filter."
              : "Start an exploration to record observations, decisions and results here."}
          </p>
          {runs.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setStatus("all");
              }}
            >
              Clear filters
            </button>
          )}
        </div>
      )}
      {visible.map((run) => (
        <article className="gf-card" key={run.id}>
          <div className="gf-section-title">
            <h2>{run.observations[0]?.pageName || "Exploration run"}</h2>
            <span className="gf-pill">{run.status}</span>
          </div>
          <p className="gf-muted">
            {run.id} · Started {dateLabel(run.startedAt)}
            {run.completedAt ? ` · Finished ${dateLabel(run.completedAt)}` : ""}
          </p>
          <p>
            {run.observations.length} observations ·{" "}
            {run.traces.filter((trace) => trace.result.status === "executed").length} executed
            actions · {run.traces.filter((trace) => trace.result.status === "blocked").length}{" "}
            blocked actions ·{" "}
            {run.traces.filter((trace) => trace.result.status === "failed").length} failed actions ·{" "}
            {run.traces.filter((trace) => trace.result.status === "cancelled").length} cancelled
            actions
          </p>
          {run.blockedReasons.length > 0 && (
            <div className="gf-notice">
              <h3>Exploration limits</h3>
              <ul>
                {run.blockedReasons.map((reason, index) => (
                  <li key={index}>{reason}</li>
                ))}
              </ul>
            </div>
          )}
          <details>
            <summary>Observations and controls ({run.observations.length})</summary>
            {!run.observations.length && <p>No observations recorded.</p>}
            {run.observations.map((observation) => (
              <section key={observation.id}>
                <h3>{observation.pageName}</h3>
                <p className="gf-muted">
                  {observation.id} · {dateLabel(observation.observedAt)}
                </p>
                {!observation.controls.length ? (
                  <p>No controls recorded.</p>
                ) : (
                  <ul>
                    {observation.controls.map((control) => (
                      <li key={control.id}>
                        <strong>{control.accessibleName || "Unnamed control"}</strong> ·{" "}
                        {control.role || control.tagName} · {control.state}
                        <br />
                        <small>Control: {control.id}</small>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </details>
          <details>
            <summary>Action trace and evidence ({run.traces.length})</summary>
            {!run.traces.length && <p>No actions were recorded in this run.</p>}
            {run.traces.map((trace) => (
              <section key={trace.id}>
                <h3>{trace.plan.goal}</h3>
                <p>
                  <span className="gf-pill">{trace.result.status}</span> {trace.plan.observedLabel}{" "}
                  · {trace.plan.actionType}
                </p>
                {trace.result.reason && <p>Reason: {trace.result.reason}</p>}
                {trace.result.observedOutcome && (
                  <p>Observed outcome: {trace.result.observedOutcome}</p>
                )}
                {trace.result.beforeState && <p>Before: {trace.result.beforeState}</p>}
                {trace.result.afterState && <p>After: {trace.result.afterState}</p>}
                {trace.result.inputs && trace.result.inputs.length > 0 && (
                  <ul>
                    {trace.result.inputs.map((input, index) => (
                      <li key={index}>
                        {input.label}: {input.value}
                      </li>
                    ))}
                  </ul>
                )}
                <small>
                  Observation: {trace.observationId} · Action: {trace.result.actionId} · Control:{" "}
                  {trace.result.targetId} · {dateLabel(trace.result.completedAt)}
                </small>
              </section>
            ))}
          </details>
          <div className="gf-controls">
            <button type="button" onClick={() => onOpenTutorials(run.id)}>
              View run guides
            </button>
            <button
              type="button"
              disabled={run.status === "running"}
              onClick={() => setPendingDelete(run.id)}
            >
              Delete run
            </button>
          </div>
          {pendingDelete === run.id && (
            <div className="gf-notice" role="group" aria-label="Confirm run deletion">
              <p>Delete this run, its evidence and its linked tutorials from this browser?</p>
              <div className="gf-toolbar">
                <button
                  type="button"
                  onClick={() => {
                    onDelete(run.id);
                    setPendingDelete(null);
                  }}
                >
                  Confirm delete run
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

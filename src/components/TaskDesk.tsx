import { forwardRef, useState } from "react";
import type { StoredWebGuideData, TaskStatus } from "@/features/webguide/types";

type DemoState = StoredWebGuideData["demoState"];
export interface TaskDeskProps {
  state: DemoState;
  onChange: (state: DemoState) => void;
}
const safe = { "data-explorer-safe": "true" } as const;
const statuses: TaskStatus[] = ["To do", "In progress", "Done"];

/** Explicitly disposable same-origin sandbox. No network or real-user actions. */
export const TaskDesk = forwardRef<HTMLDivElement, TaskDeskProps>(function TaskDesk(
  { state, onChange },
  ref,
) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const [notice, setNotice] = useState("Ready to explore this disposable workspace.");
  const [outcomeTarget, setOutcomeTarget] = useState("");
  function report(targetId: string, message: string) {
    setOutcomeTarget(targetId);
    setNotice(message);
  }
  const tasks = state.tasks.filter(
    (task) =>
      task.title.toLowerCase().includes(query.toLowerCase()) &&
      (filter === "All" || task.status === filter),
  );
  return (
    <div ref={ref} data-webguide-sandbox="true" data-page-name="TaskDesk" className="taskdesk">
      <div className="flex items-center justify-between gap-3 mb-5">
        <div>
          <h3 className="text-xl font-semibold">Projects and tasks</h3>
        </div>
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs text-emerald-700">
          Sandbox
        </span>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <form
          id="taskdesk-project"
          {...safe}
          onSubmit={(event) => {
            event.preventDefault();
            const name = String(new FormData(event.currentTarget).get("projectName") ?? "").trim();
            if (!name) return;
            onChange({
              ...state,
              projects: [...state.projects, { id: crypto.randomUUID(), name }],
            });
            report("create-project", `Project “${name}” was created.`);
            event.currentTarget.reset();
          }}
        >
          <label className="block text-sm mb-2" htmlFor="project-name">
            Project name
          </label>
          <div className="flex gap-2">
            <input
              id="project-name"
              name="projectName"
              required
              maxLength={100}
              placeholder="e.g. Product launch"
              className="min-w-0 flex-1 border rounded-lg px-3 py-2"
            />
            <button
              {...safe}
              data-explorer-id="create-project"
              type="submit"
              className="border rounded-lg px-3 py-2"
            >
              Create project
            </button>
          </div>
        </form>
        <form
          id="taskdesk-task"
          {...safe}
          onSubmit={(event) => {
            event.preventDefault();
            const fields = new FormData(event.currentTarget);
            const title = String(fields.get("taskTitle") ?? "").trim();
            const projectId = String(fields.get("projectId") ?? "");
            if (!title || !state.projects.some((project) => project.id === projectId)) return;
            onChange({
              ...state,
              tasks: [
                ...state.tasks,
                { id: crypto.randomUUID(), title, projectId, status: "To do" },
              ],
            });
            report("create-task", `Task “${title}” was created with status To do.`);
            event.currentTarget.reset();
          }}
        >
          <label className="block text-sm mb-2" htmlFor="task-title">
            Task title
          </label>
          <input
            id="task-title"
            name="taskTitle"
            required
            maxLength={100}
            placeholder="What needs to happen?"
            className="w-full border rounded-lg px-3 py-2 mb-2"
          />
          <div className="flex gap-2">
            <label className="sr-only" htmlFor="task-project">
              Project
            </label>
            <select
              id="task-project"
              name="projectId"
              className="min-w-0 flex-1 border rounded-lg px-3 py-2"
            >
              {state.projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
            <button
              {...safe}
              data-explorer-id="create-task"
              type="submit"
              className="border rounded-lg px-3 py-2"
            >
              Create task
            </button>
          </div>
        </form>
      </div>
      <div className="flex flex-wrap items-end gap-3 mt-6 mb-4">
        <form
          id="taskdesk-search"
          {...safe}
          className="flex gap-2 flex-1"
          onSubmit={(event) => {
            event.preventDefault();
            const value = String(new FormData(event.currentTarget).get("query") ?? "").trim();
            setQuery(value);
            report("search-tasks", `Search applied: “${value}”.`);
          }}
        >
          <label htmlFor="task-search" className="sr-only">
            Search tasks
          </label>
          <input
            id="task-search"
            name="query"
            type="search"
            placeholder="Search tasks"
            className="min-w-0 flex-1 border rounded-lg px-3 py-2"
          />
          <button {...safe} data-explorer-id="search-tasks" className="border rounded-lg px-3 py-2">
            Search
          </button>
        </form>
        {["All", ...statuses].map((status) => (
          <button
            key={status}
            {...safe}
            data-explorer-id={`filter-${status.replaceAll(" ", "-").toLowerCase()}`}
            aria-pressed={filter === status}
            onClick={() => {
              setFilter(status);
              setQuery("");
              report(
                `filter-${status.replaceAll(" ", "-").toLowerCase()}`,
                `Showing ${status === "All" ? "all tasks" : `${status} tasks`}.`,
              );
            }}
            className={`border rounded-lg px-3 py-2 text-sm ${filter === status ? "bg-slate-900 text-white" : ""}`}
          >
            {status}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="border-b text-slate-500">
              <th className="py-2">Task</th>
              <th>Project</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => (
              <tr key={task.id} className="border-b">
                <td className={state.preferences.compactView ? "py-1" : "py-3"}>{task.title}</td>
                <td>
                  {state.projects.find((project) => project.id === task.projectId)?.name ??
                    "Unknown project"}
                </td>
                <td>
                  <button
                    {...safe}
                    data-explorer-id={`status-${task.id}`}
                    aria-label={`Change status of ${task.title}`}
                    data-explorer-state={task.status}
                    onClick={() => {
                      const next =
                        statuses[(statuses.indexOf(task.status) + 1) % statuses.length] ?? "To do";
                      onChange({
                        ...state,
                        tasks: state.tasks.map((item) =>
                          item.id === task.id ? { ...item, status: next } : item,
                        ),
                      });
                      report(`status-${task.id}`, `Task “${task.title}” now has status ${next}.`);
                    }}
                    className="border rounded-lg px-2 py-1"
                  >
                    {task.status}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {tasks.length === 0 && (
          <p className="py-6 text-center text-slate-500">No tasks match these filters.</p>
        )}
      </div>
      <div className="flex flex-wrap gap-3 mt-4">
        <button
          {...safe}
          data-explorer-id="compact-view"
          aria-pressed={state.preferences.compactView}
          onClick={() => {
            const enabled = !state.preferences.compactView;
            onChange({ ...state, preferences: { ...state.preferences, compactView: enabled } });
            report("compact-view", `Compact view ${enabled ? "enabled" : "disabled"}.`);
          }}
          className="border rounded-lg px-3 py-2 text-sm"
        >
          Compact view
        </button>
        <button
          {...safe}
          data-explorer-id="weekly-digest"
          aria-pressed={state.preferences.weeklyDigest}
          onClick={() => {
            const enabled = !state.preferences.weeklyDigest;
            onChange({ ...state, preferences: { ...state.preferences, weeklyDigest: enabled } });
            report(
              "weekly-digest",
              `Weekly digest preference ${enabled ? "enabled" : "disabled"}; no email is sent in this sandbox.`,
            );
          }}
          className="border rounded-lg px-3 py-2 text-sm"
        >
          Weekly digest preference
        </button>
      </div>
      <p
        role="status"
        aria-live="polite"
        data-explorer-output="true"
        data-explorer-for={outcomeTarget}
        className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-600"
      >
        {notice}
      </p>
    </div>
  );
});

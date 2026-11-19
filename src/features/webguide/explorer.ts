import { executeDemoAction } from "./execution";
import { observeTaskDesk, snapshotTaskDesk } from "./observation";
import { planObservedActions } from "./planning";
import { decideDemoAction } from "./policy";
import { generateTutorial } from "./tutorial-generation";
import {
  SCHEMA_VERSION,
  type ActionResult,
  type ExplorationRun,
  type PageObservation,
  type Tutorial,
  type WorkflowTrace,
} from "./types";
import { verifyObservedResult } from "./verification";
export type ExplorationEvent =
  | { type: "run-started"; run: ExplorationRun }
  | { type: "observation"; observation: PageObservation }
  | { type: "action-result"; result: ActionResult; run: ExplorationRun }
  | { type: "tutorial-generated"; tutorial: Tutorial }
  | { type: "run-completed"; run: ExplorationRun };
export interface ExplorationOptions {
  signal?: AbortSignal;
  onEvent?: (event: ExplorationEvent) => void;
  runId?: string;
  now?: () => string;
  maxActions?: number;
  maxRuntimeMs?: number;
}
function idleForRender(signal?: AbortSignal) {
  return new Promise<void>((resolve) => {
    const done = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", done);
      resolve();
    };
    const timer = setTimeout(done, 110);
    signal?.addEventListener("abort", done, { once: true });
    if (signal?.aborted) done();
  });
}
function findObservedTarget(root: HTMLElement, id: string): HTMLElement | null {
  return (
    Array.from(root.querySelectorAll<HTMLElement>("[data-explorer-id]")).find(
      (element) => element.dataset["explorerId"] === id,
    ) ?? null
  );
}
export async function runTaskDeskExploration(
  root: HTMLElement,
  options: ExplorationOptions = {},
): Promise<ExplorationRun> {
  let observationCounter = 0;
  const now = options.now ?? (() => new Date().toISOString());
  const runId = options.runId ?? `run-${crypto.randomUUID()}`;
  const started = performance.now();
  const actionLimit = Math.min(60, Math.max(1, options.maxActions ?? 40));
  const timeLimit = Math.min(30_000, Math.max(100, options.maxRuntimeMs ?? 20_000));
  const run: ExplorationRun = {
    schemaVersion: SCHEMA_VERSION,
    id: runId,
    status: "running",
    startedAt: now(),
    observations: [],
    traces: [],
    blockedReasons: [],
  };
  const completedTargets = new Set<string>();
  const emit = (event: ExplorationEvent) => options.onEvent?.(event);
  emit({ type: "run-started", run: structuredClone(run) });
  try {
    if (!root.isConnected || root.dataset["webguideSandbox"] !== "true")
      throw new Error("A connected authorised TaskDesk sandbox is required.");
    while (true) {
      if (options.signal?.aborted) {
        run.status = "cancelled";
        break;
      }
      if (performance.now() - started >= timeLimit || run.traces.length >= actionLimit) {
        run.blockedReasons.push(
          "Exploration stopped at its action or runtime limit; remaining controls are not verified.",
        );
        break;
      }
      // Re-observe after every action: plans never silently reuse a previous page state.
      const observation = observeTaskDesk(
        root,
        `${runId}-observation-${++observationCounter}`,
        now(),
      );
      run.observations.push(observation);
      emit({ type: "observation", observation: structuredClone(observation) });
      const action = planObservedActions(observation).find(
        (candidate) => !completedTargets.has(candidate.targetId),
      );
      if (!action) {
        if (run.traces.length === 0)
          run.blockedReasons.push(
            "No supported visible controls were observed; no workflow was verified.",
          );
        break;
      }
      completedTargets.add(action.targetId);
      if (options.signal?.aborted) {
        run.status = "cancelled";
        break;
      }
      const target = findObservedTarget(root, action.targetId);
      const decision = decideDemoAction(action, target);
      let result: ActionResult;
      if (!decision.allowed || !target) {
        const reason = !decision.allowed ? decision.reason : "The observed control disappeared.";
        result = {
          schemaVersion: SCHEMA_VERSION,
          actionId: action.id,
          targetId: action.targetId,
          status: "blocked",
          reason,
          completedAt: now(),
        };
      } else {
        const beforeState = snapshotTaskDesk(root);
        const execution = executeDemoAction(target, action);
        await idleForRender(options.signal);
        if (execution.status === "failed")
          result = {
            schemaVersion: SCHEMA_VERSION,
            actionId: action.id,
            targetId: action.targetId,
            status: "failed",
            reason: execution.reason ?? "Execution failed.",
            beforeState,
            afterState: snapshotTaskDesk(root),
            completedAt: now(),
          };
        else
          result = {
            ...verifyObservedResult(root, action, beforeState, now()),
            inputs: execution.inputs ?? [],
          };
      }
      if (result.reason) run.blockedReasons.push(result.reason);
      const trace: WorkflowTrace = {
        schemaVersion: SCHEMA_VERSION,
        id: `trace-${action.id}`,
        plan: action,
        result,
        observationId: observation.id,
      };
      run.traces.push(trace);
      emit({ type: "action-result", result: structuredClone(result), run: structuredClone(run) });
      const tutorial = generateTutorial({ runId, observation, action, result, generatedAt: now() });
      if (tutorial) emit({ type: "tutorial-generated", tutorial: structuredClone(tutorial) });
      if (options.signal?.aborted) {
        run.status = "cancelled";
        break;
      }
    }
    if (run.status === "running")
      run.status = run.blockedReasons.length ? "partially completed" : "completed";
  } catch (error) {
    run.status = options.signal?.aborted ? "cancelled" : "failed";
    run.blockedReasons.push(
      error instanceof Error ? error.message.slice(0, 300) : "Exploration failed.",
    );
  }
  run.completedAt = now();
  emit({ type: "run-completed", run: structuredClone(run) });
  return run;
}

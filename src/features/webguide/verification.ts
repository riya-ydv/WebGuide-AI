import { z } from "zod";
import type { ActionResult, PlannedAction } from "./types";
import { snapshotTaskDesk } from "./observation";
const snapshotSchema = z.object({
  outputs: z.array(z.object({ targetId: z.string(), text: z.string() })),
  controls: z.array(z.object({ id: z.string(), state: z.string() })),
});
export function verifyObservedResult(
  root: HTMLElement,
  action: PlannedAction,
  beforeState: string,
  completedAt = new Date().toISOString(),
): ActionResult {
  const afterState = snapshotTaskDesk(root);
  let observedOutcome: string | undefined;
  try {
    const before = snapshotSchema.parse(JSON.parse(beforeState));
    const after = snapshotSchema.parse(JSON.parse(afterState));
    const output = after.outputs.find(
      (value) =>
        value.targetId === action.targetId &&
        value.text &&
        !before.outputs.some(
          (previous) => previous.targetId === value.targetId && previous.text === value.text,
        ),
    );
    const previous = before.controls.find((control) => control.id === action.targetId);
    const current = after.controls.find((control) => control.id === action.targetId);
    if (output) observedOutcome = output.text;
    else if (previous && current && previous.state !== current.state)
      observedOutcome = `“${action.observedLabel}” changed from ${previous.state || "unset"} to ${current.state || "unset"}.`;
  } catch {
    /* Invalid evidence cannot verify an action. */
  }
  return {
    schemaVersion: 1,
    actionId: action.id,
    targetId: action.targetId,
    status: observedOutcome ? "executed" : "failed",
    ...(observedOutcome
      ? { observedOutcome }
      : { reason: "No changed sandbox outcome or target state was observed after activation." }),
    beforeState,
    afterState,
    completedAt,
  };
}

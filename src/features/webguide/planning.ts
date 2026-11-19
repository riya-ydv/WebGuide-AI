import { SCHEMA_VERSION, type PageObservation, type PlannedAction } from "./types";

export function planObservedActions(observation: PageObservation): PlannedAction[] {
  return observation.controls.map((control) => ({
    schemaVersion: SCHEMA_VERSION,
    id: `action-${observation.id}-${control.id}`,
    targetId: control.id,
    observedLabel: control.accessibleName,
    goal: `Explore what happens when you use “${control.accessibleName}”.`,
    actionType: control.formId ? "submit-form" : "activate-control",
    ...(control.formId ? { formId: control.formId } : {}),
  }));
}

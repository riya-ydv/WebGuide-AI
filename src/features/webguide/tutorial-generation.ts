import type { ActionResult, PageObservation, PlannedAction, Tutorial } from "./types";
export interface TutorialGenerationInput {
  runId: string;
  observation: PageObservation;
  action: PlannedAction;
  result: ActionResult;
  generatedAt: string;
}
export function generateTutorial(input: TutorialGenerationInput): Tutorial | null {
  if (input.result.status !== "executed" || !input.result.observedOutcome) return null;
  const title = input.action.observedLabel;
  const evidence = {
    observationId: input.observation.id,
    actionResultId: input.result.actionId,
    controlId: input.action.targetId,
  };
  const fieldSteps = (input.result.inputs ?? []).map((field) => ({
    instruction:
      field.kind === "select"
        ? `In “${field.label}”, choose “${field.value}”.`
        : `Find the “${field.label}” field and enter “${field.value}” (or your own disposable test value).`,
    targetControl: field.label,
    expectedResult: `“${field.label}” contains “${field.value}”.`,
    evidence,
  }));
  const steps = [
    ...fieldSteps,
    {
      instruction: `In ${input.observation.pageName}, select the “${title}” button.`,
      targetControl: title,
      expectedResult: input.result.observedOutcome,
      evidence,
    },
  ];
  return {
    schemaVersion: 1,
    id: `tutorial-${input.runId}-${input.action.targetId}`,
    title: `Use ${title}`,
    goal: input.action.goal,
    website: "TaskDesk demo",
    startingPage: input.observation.pageName,
    prerequisites: [
      "Open the included TaskDesk disposable demo.",
      "These results were verified in the recorded sandbox state; filters, existing tasks and preferences may differ.",
    ],
    steps,
    beginnerInstructions: steps
      .map((step, index) => `${index + 1}. ${step.instruction} Expected: ${step.expectedResult}`)
      .join("\n"),
    refresherInstructions: [
      ...(input.result.inputs ?? []).map((field) => `${field.label}: ${field.value}`),
      `Select “${title}”.`,
    ].join(" → "),
    verificationStatus: "Verified in sandbox",
    lastVerifiedAt: input.generatedAt,
    sourceRunId: input.runId,
    generator: "Template-generated",
  };
}

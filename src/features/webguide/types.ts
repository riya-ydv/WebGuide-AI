export const SCHEMA_VERSION = 1 as const;

export type VerificationStatus =
  | "Verified in sandbox"
  | "Partially explored"
  | "Blocked by authentication"
  | "Needs re-verification";

export interface ElementObservation {
  id: string;
  tagName: string;
  accessibleName: string;
  role: string;
  pageName: string;
  state: string;
  formId?: string;
}

export interface PageObservation {
  schemaVersion: typeof SCHEMA_VERSION;
  id: string;
  pageName: string;
  observedAt: string;
  controls: ElementObservation[];
}

export interface PlannedAction {
  schemaVersion: typeof SCHEMA_VERSION;
  id: string;
  targetId: string;
  observedLabel: string;
  goal: string;
  actionType: "submit-form" | "activate-control";
  formId?: string;
}

export interface RecordedInput {
  label: string;
  value: string;
  kind: "text" | "select";
}

export interface ActionResult {
  schemaVersion: typeof SCHEMA_VERSION;
  actionId: string;
  targetId: string;
  status: "executed" | "blocked" | "failed" | "cancelled";
  reason?: string;
  inputs?: RecordedInput[];
  observedOutcome?: string;
  beforeState?: string;
  afterState?: string;
  completedAt: string;
}

export interface EvidenceReference {
  observationId: string;
  actionResultId: string;
  controlId: string;
}

export interface TutorialStep {
  instruction: string;
  targetControl: string;
  expectedResult: string;
  evidence: EvidenceReference;
}

export interface Tutorial {
  schemaVersion: typeof SCHEMA_VERSION;
  id: string;
  title: string;
  goal: string;
  website: string;
  startingPage: string;
  prerequisites: string[];
  steps: TutorialStep[];
  beginnerInstructions: string;
  refresherInstructions: string;
  verificationStatus: VerificationStatus;
  lastVerifiedAt: string;
  sourceRunId: string;
  generator: "Template-generated";
}

export interface WorkflowTrace {
  schemaVersion: typeof SCHEMA_VERSION;
  id: string;
  plan: PlannedAction;
  result: ActionResult;
  observationId: string;
}

export interface ExplorationRun {
  schemaVersion: typeof SCHEMA_VERSION;
  id: string;
  status: "running" | "completed" | "partially completed" | "cancelled" | "failed";
  startedAt: string;
  completedAt?: string;
  observations: PageObservation[];
  traces: WorkflowTrace[];
  blockedReasons: string[];
}

export interface StoredWebGuideData {
  schemaVersion: typeof SCHEMA_VERSION;
  tutorials: Tutorial[];
  runs: ExplorationRun[];
  demoState: {
    projects: DemoProject[];
    tasks: DemoTask[];
    preferences: DemoPreferences;
  };
}

export interface DemoProject {
  id: string;
  name: string;
}

export type TaskStatus = "To do" | "In progress" | "Done";

export interface DemoTask {
  id: string;
  title: string;
  projectId: string;
  status: TaskStatus;
}

export interface DemoPreferences {
  compactView: boolean;
  weeklyDigest: boolean;
}

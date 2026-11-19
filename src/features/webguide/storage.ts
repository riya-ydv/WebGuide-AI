import { z } from "zod";
import { SCHEMA_VERSION, type StoredWebGuideData } from "./types";
export const STORAGE_KEY = "webguide-demo-v1";
export const initialDemoState: StoredWebGuideData["demoState"] = {
  projects: [
    { id: "project-northstar", name: "Northstar redesign" },
    { id: "project-onboarding", name: "Customer onboarding" },
  ],
  tasks: [
    {
      id: "task-outline",
      title: "Outline the new dashboard",
      projectId: "project-northstar",
      status: "In progress",
    },
    {
      id: "task-review",
      title: "Review welcome email",
      projectId: "project-onboarding",
      status: "To do",
    },
    {
      id: "task-checklist",
      title: "Prepare launch checklist",
      projectId: "project-northstar",
      status: "Done",
    },
  ],
  preferences: { compactView: false, weeklyDigest: true },
};
const short = z.string().max(2000);
const id = z.string().min(1).max(1000);
const stamp = z.string().datetime();
const version = z.literal(SCHEMA_VERSION);
const evidence = z.object({ observationId: id, actionResultId: id, controlId: id });
const tutorialSchema = z.object({
  schemaVersion: version,
  id,
  title: short,
  goal: short,
  website: short,
  startingPage: short,
  prerequisites: z.array(short).max(20),
  steps: z
    .array(z.object({ instruction: short, targetControl: short, expectedResult: short, evidence }))
    .min(1)
    .max(100),
  beginnerInstructions: z.string().max(40_000),
  refresherInstructions: z.string().max(10_000),
  verificationStatus: z.enum([
    "Verified in sandbox",
    "Partially explored",
    "Blocked by authentication",
    "Needs re-verification",
  ]),
  lastVerifiedAt: stamp,
  sourceRunId: id,
  generator: z.literal("Template-generated"),
});
const action = z.object({
  schemaVersion: version,
  id,
  targetId: id,
  observedLabel: short,
  goal: short,
  actionType: z.enum(["submit-form", "activate-control"]),
  formId: id.optional(),
});
const result = z.object({
  schemaVersion: version,
  actionId: id,
  targetId: id,
  status: z.enum(["executed", "blocked", "failed", "cancelled"]),
  reason: short.optional(),
  beforeState: z.string().max(250_000).optional(),
  afterState: z.string().max(250_000).optional(),
  observedOutcome: short.optional(),
  inputs: z
    .array(z.object({ label: short, value: short, kind: z.enum(["text", "select"]) }))
    .max(30)
    .optional(),
  completedAt: stamp,
});
const observation = z.object({
  schemaVersion: version,
  id,
  pageName: short,
  observedAt: stamp,
  controls: z
    .array(
      z.object({
        id,
        tagName: short,
        accessibleName: short,
        role: short,
        pageName: short,
        state: short,
        formId: id.optional(),
      }),
    )
    .max(100),
});
const run = z.object({
  schemaVersion: version,
  id,
  status: z.enum(["running", "completed", "partially completed", "cancelled", "failed"]),
  startedAt: stamp,
  completedAt: stamp.optional(),
  observations: z.array(observation).max(100),
  traces: z
    .array(z.object({ schemaVersion: version, id, plan: action, result, observationId: id }))
    .max(100),
  blockedReasons: z.array(short).max(100),
});
export const storedDataSchema = z.object({
  schemaVersion: version,
  tutorials: z.array(tutorialSchema).max(2000),
  runs: z.array(run).max(100),
  demoState: z.object({
    projects: z.array(z.object({ id, name: short })).max(1000),
    tasks: z
      .array(
        z.object({
          id,
          title: short,
          projectId: id,
          status: z.enum(["To do", "In progress", "Done"]),
        }),
      )
      .max(3000),
    preferences: z.object({ compactView: z.boolean(), weeklyDigest: z.boolean() }),
  }),
});
export function emptyWebGuideData(): StoredWebGuideData {
  return {
    schemaVersion: SCHEMA_VERSION,
    tutorials: [],
    runs: [],
    demoState: structuredClone(initialDemoState),
  };
}
/** Use for explicit JSON import: invalid records are reported, never silently accepted. */
export function validateStoredData(raw: string): StoredWebGuideData {
  if (raw.length > 8_000_000) throw new Error("Import exceeds the 8 MB limit.");
  const parsed = storedDataSchema.parse(JSON.parse(raw));
  // JSON contains no undefined values; Zod optional properties are omitted when absent.
  return JSON.parse(JSON.stringify(parsed)) as StoredWebGuideData;
}
export function parseStoredData(raw: string | null): StoredWebGuideData {
  if (!raw) return emptyWebGuideData();
  try {
    return validateStoredData(raw);
  } catch {
    return emptyWebGuideData();
  }
}

import { z } from "zod";

export const JobRequest = z
  .object({
    url: z.string().url().max(2048),
    mode: z.enum(["read-only", "sandbox"]).default("read-only"),
    planner: z.enum(["ai", "deterministic"]).default("ai"),
  })
  .strict();
export const Proposal = z.discriminatedUnion("type", [
  z.object({ type: z.literal("inspect"), targetId: z.string().max(80) }).strict(),
  z.object({ type: z.literal("click"), targetId: z.string().max(80) }).strict(),
  z
    .object({
      type: z.literal("fill"),
      targetId: z.string().max(80),
      value: z.string().min(1).max(120),
    })
    .strict(),
  z.object({ type: z.literal("stop") }).strict(),
]);
export type Action = z.infer<typeof Proposal>;
export interface Control {
  id: string;
  label: string;
  tag: string;
  type: string;
  safe: boolean;
  expected: string;
}
export interface Observation {
  id: string;
  url: string;
  title: string;
  observedAt: string;
  controls: Control[];
  state: string;
}
export interface Trace {
  id: string;
  observationId: string;
  action: Action;
  label: string;
  status: "verified" | "failed" | "blocked";
  before: string;
  after: string;
  reason: string;
}
export interface Tutorial {
  schemaVersion: 1;
  id: string;
  title: string;
  goal: string;
  website: string;
  startingPage: string;
  prerequisites: string[];
  steps: {
    instruction: string;
    targetControl: string;
    expectedResult: string;
    evidence: { observationId: string; actionResultId: string; controlId: string };
  }[];
  beginnerInstructions: string;
  refresherInstructions: string;
  verificationStatus: "Verified read-only" | "Verified in sandbox";
  lastVerifiedAt: string;
  sourceRunId: string;
  generator: "Template-generated" | "AI evidence-grounded";
}
export interface Job {
  id: string;
  url: string;
  mode: "read-only" | "sandbox";
  planner: "ai" | "deterministic";
  status: "queued" | "running" | "completed" | "partial" | "failed" | "cancelled";
  startedAt: string;
  completedAt?: string;
  events: string[];
  observations: Observation[];
  traces: Trace[];
  tutorials: Tutorial[];
  error?: string;
}

import { z } from "zod";
import type { Job, Tutorial } from "./contracts.js";
import type { Provider } from "./planner.js";

export async function tutorials(job: Job, provider: Provider): Promise<Tutorial[]> {
  const verified = job.traces.filter((t) => t.status === "verified");
  if (!verified.length) return [];
  let title = `Explore ${new URL(job.url).hostname}`;
  let aiValidated = false;
  if (job.planner === "ai") {
    try {
      const synthesis = z
        .object({
          title: z.string().min(1).max(120),
          traceIds: z
            .array(z.enum(verified.map((trace) => trace.id) as [string, ...string[]]))
            .min(1)
            .max(12),
        })
        .strict();
      const result = synthesis.parse(
        await provider.json(
          "Summarize the verified evidence as a tutorial title. Return {title,traceIds}. Cite ONLY supplied verified trace IDs; do not introduce unobserved tasks.",
          verified.map((t) => ({
            id: t.id,
            label: t.label,
            type: t.action.type,
            result: t.reason,
          })),
          z.toJSONSchema(synthesis),
        ),
      );
      if (result.traceIds.some((id) => !verified.some((t) => t.id === id)))
        throw new Error("AI tutorial cited unknown evidence");
      job.events.push(
        `AI tutorial synthesis validated ${result.traceIds.length} evidence references`,
      );
      aiValidated = true;
      // AI title is untrusted prose: publish only a title grounded in observed labels.
      title = `Observed workflow: ${verified.map((trace) => trace.label).join(" → ")}`.slice(
        0,
        180,
      );
    } catch {
      job.events.push(
        "AI tutorial synthesis was unavailable or cited unsupported evidence. Showing a template made only from verified traces.",
      );
      title = `Observed controls: ${verified.map((trace) => trace.label).join(" / ")}`.slice(
        0,
        180,
      );
    }
  }
  const steps = verified.map((trace) => ({
    instruction:
      trace.action.type === "fill"
        ? `Enter “${trace.action.value}” in “${trace.label}”. Use this disposable sample only in the authorised sandbox.`
        : trace.action.type === "inspect"
          ? `Locate “${trace.label}” on the starting page. This control was observed only; its effect has not been tested.`
          : `Activate “${trace.label}”.`,
    targetControl: trace.label,
    expectedResult: trace.reason,
    evidence: {
      observationId: trace.observationId,
      actionResultId: trace.id,
      controlId: trace.action.type === "stop" ? "" : trace.action.targetId,
    },
  }));
  return [
    {
      schemaVersion: 1,
      id: `${job.id}-tutorial`,
      title,
      goal: title,
      website: job.url,
      startingPage: job.url,
      prerequisites: [
        job.mode === "sandbox"
          ? "Use the disposable controlled sandbox only."
          : "Public unauthenticated page. Control effects have not been tested.",
      ],
      steps,
      beginnerInstructions: steps
        .map((s, i) => `${i + 1}. ${s.instruction} Expected: ${s.expectedResult}`)
        .join("\n"),
      refresherInstructions: steps.map((s) => s.targetControl).join(" → "),
      verificationStatus:
        job.mode === "sandbox" && verified.some((trace) => trace.action.type !== "inspect")
          ? "Verified in sandbox"
          : "Verified read-only",
      lastVerifiedAt: new Date().toISOString(),
      sourceRunId: job.id,
      generator: aiValidated ? "AI evidence-grounded" : "Template-generated",
    },
  ];
}
export function answer(job: Job, question: string) {
  const words =
    question
      .toLowerCase()
      .match(/[a-z]{3,}/g)
      ?.filter(
        (w) =>
          !["how", "the", "can", "with", "this", "that", "does", "what", "from", "please"].includes(
            w,
          ),
      ) || [];
  const matches = job.tutorials
    .flatMap((t) =>
      t.steps.map((step, i) => ({
        tutorialId: t.id,
        step: i + 1,
        instruction: step.instruction,
        evidence: step.evidence,
        label: step.targetControl,
      })),
    )
    .filter((s) => words.length > 0 && words.every((w) => s.label.toLowerCase().includes(w)));
  return matches.length
    ? {
        answer: matches.map((m) => `${m.instruction} [${m.tutorialId}, step ${m.step}]`).join("\n"),
        citations: matches,
      }
    : {
        answer:
          "That feature has not been verified in this exploration. I cannot provide evidence-backed instructions for it.",
        citations: [],
      };
}

import { z } from "zod";
import type { Job } from "./contracts.js";
import type { Provider } from "./planner.js";
import { answer } from "./tutorials.js";

/** AI selects evidence, while the backend supplies exact verified instructions. */
export async function answerWithAI(job: Job, question: string, provider: Provider) {
  const grounded = answer(job, question);
  // A model may not turn a shared noun into permission to invent an unseen task.
  if (!grounded.citations.length) return { ...grounded, generator: "Evidence guard" };
  const schema = z
    .object({ supported: z.boolean(), stepIds: z.array(z.string()).max(20) })
    .strict();
  const evidence = grounded.citations.map((c) => ({
    id: `${c.tutorialId}:${c.step}`,
    label: c.label,
    instruction: c.instruction,
  }));
  const result = schema.parse(
    await provider.json(
      "Select only evidence steps which answer the question. Return {supported:boolean,stepIds:string[]}. Never add actions, labels or results. If unsupported return false and an empty list.",
      { question, evidence },
      z.toJSONSchema(schema),
    ),
  );
  if (!result.supported || !result.stepIds.length)
    return {
      answer: "That question is not supported by the available verified steps.",
      citations: [],
      generator: "AI evidence selection",
    };
  if (result.stepIds.some((id) => !evidence.some((e) => e.id === id)))
    throw new Error("AI cited unknown answer evidence");
  const citations = grounded.citations.filter((c) =>
    result.stepIds.includes(`${c.tutorialId}:${c.step}`),
  );
  return {
    answer: citations.map((c) => `${c.instruction} [${c.tutorialId}, step ${c.step}]`).join("\n"),
    citations,
    generator: "AI evidence selection",
  };
}

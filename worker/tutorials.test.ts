import { test } from "node:test";
import assert from "node:assert/strict";
import { tutorials } from "./tutorials.js";
import { Provider } from "./planner.js";
import type { Job } from "./contracts.js";
const fixture = (): Job => ({
  id: "job",
  url: "https://example.com",
  mode: "read-only",
  planner: "ai",
  status: "running",
  startedAt: new Date().toISOString(),
  observations: [],
  tutorials: [],
  events: [],
  traces: [
    {
      id: "verified-1",
      observationId: "observation-1",
      action: { type: "inspect", targetId: "contact" },
      label: "Contact",
      status: "verified",
      before: "",
      after: "",
      reason: "Control observed; not activated",
    },
  ],
});
test("untrusted model citations retain only verified template evidence", async () => {
  const job = fixture();
  const provider = new Provider(new AbortController().signal);
  provider.json = async () => ({ title: "Payment completed", traceIds: ["invented"] });
  const result = await tutorials(job, provider);
  assert.equal(result[0]?.generator, "Template-generated");
  assert.equal(result[0]?.steps[0]?.evidence.actionResultId, "verified-1");
  assert(!JSON.stringify(result).includes("Payment completed"));
  assert(job.events.some((e) => e.includes("unsupported evidence")));
});
test("model outage preserves verified observations without claiming AI synthesis", async () => {
  const provider = new Provider(new AbortController().signal);
  provider.json = async () => {
    throw Error("offline");
  };
  assert.equal((await tutorials(fixture(), provider))[0]?.generator, "Template-generated");
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { GuidanceRequest, pageGuidance, type GuidanceInput } from "./guidance.js";

const input: GuidanceInput = {
  goal: "Find the contact form",
  language: "en",
  mode: "guide",
  context: {
    url: "https://example.com/page?private=secret#token",
    title: "Contact",
    revision: "rev-1",
    text: "Contact our team. Your name is required.",
    controls: [
      { id: "name", name: "Your name", role: "textbox", required: true },
      { id: "submit", name: "Send", role: "button", disabled: true },
    ],
    headings: [{ id: "heading", text: "Contact", level: 1 }],
  },
};

test("spoken guidance uses visible names while preserving structured target identity", async () => {
  const request: GuidanceInput = {
    ...input,
    context: {
      ...input.context,
      controls: [{ id: "wg-target-1", name: "Your name", role: "textbox" }],
    },
  };
  const result = await pageGuidance(request, {
    json: async () => ({
      supported: true,
      message: "Your name (wg-target-1) is the field.",
      steps: [{ instruction: "Find wg-target-1", targetId: "wg-target-1" }],
    }),
  });
  assert.equal(result.status, "guidance");
  assert.equal(result.message, "Your name is the field.");
  assert.equal(result.steps[0]?.instruction, "Find Your name");
  assert.equal(result.steps[0]?.targetId, "wg-target-1");
});
test("generic field explanations reach the model while unrelated explanation subjects fail closed", async () => {
  const generic: GuidanceInput = {
    ...input,
    goal: "Explain the page fields and their requirements",
    mode: "explain",
    context: {
      ...input.context,
      title: "",
      text: "",
      headings: [],
      controls: [{ id: "name", name: "Your name", role: "textbox", required: true }],
    },
  };
  let calls = 0;
  const provider = {
    json: async () => {
      calls++;
      return {
        supported: true,
        message: "Your name is required.",
        steps: [{ instruction: "The Your name field is required.", targetId: "name" }],
      };
    },
  };
  assert.equal((await pageGuidance(generic, provider)).status, "guidance");
  assert.equal(calls, 1);
  assert.equal(
    (await pageGuidance({ ...generic, goal: "Explain cryptocurrency withdrawal" }, provider))
      .status,
    "insufficient-context",
  );
  assert.equal(calls, 1);
});
test("a save-profile goal cannot substitute a visible but unrelated demo action", async () => {
  const profile: GuidanceInput = {
    ...input,
    goal: "Explain Display name and how to save profile",
    context: {
      ...input.context,
      title: "Profile",
      text: "Profile settings",
      controls: [
        { id: "display", name: "Display name", role: "textbox", required: true },
        { id: "demo", name: "Run Autonomous Demo", role: "button" },
      ],
      headings: [],
    },
  };
  let called = false;
  assert.equal(
    (
      await pageGuidance(profile, {
        json: async () => {
          called = true;
          throw Error("Must not infer save action");
        },
      })
    ).status,
    "insufficient-context",
  );
  assert.equal(called, false);
  const complete = {
    ...profile,
    context: {
      ...profile.context,
      controls: [...profile.context.controls, { id: "save", name: "Save profile", role: "button" }],
    },
  };
  for (const wrong of [
    {
      supported: true,
      message: "Click Run Autonomous Demo to save profile.",
      steps: [{ instruction: "Click Run Autonomous Demo", targetId: "demo" }],
    },
    {
      supported: true,
      message: "Click Run Autonomous Demo to save profile.",
      steps: [{ instruction: "Click Save profile", targetId: "save" }],
    },
  ])
    assert.equal(
      (await pageGuidance(complete, { json: async () => wrong })).status,
      "insufficient-context",
    );
  const correct = await pageGuidance(complete, {
    json: async () => ({
      supported: true,
      message: "Review your profile fields, then use Save profile.",
      steps: [{ instruction: "Find Save profile.", targetId: "save" }],
    }),
  });
  assert.equal(correct.status, "guidance");
  assert.equal(correct.steps[0]?.targetId, "save");
  const informational = await pageGuidance(
    {
      ...profile,
      mode: "explain",
      goal: "Explain the save policy",
      context: { ...profile.context, text: "Save policy: drafts are kept only in this browser." },
    },
    {
      json: async () => ({
        supported: true,
        message: "The page says drafts are kept only in this browser.",
        steps: [],
      }),
    },
  );
  assert.equal(informational.status, "guidance");
});
test("current-page request rejects extra field values, duplicates, credential URLs and excess context", () => {
  assert.ok(GuidanceRequest.safeParse(input).success);
  assert.equal(
    GuidanceRequest.safeParse({
      ...input,
      context: { ...input.context, controls: [{ ...input.context.controls[0], value: "secret" }] },
    }).success,
    false,
  );
  assert.equal(
    GuidanceRequest.safeParse({
      ...input,
      context: { ...input.context, headings: [{ id: "name", text: "Duplicate", level: 1 }] },
    }).success,
    false,
  );
  assert.equal(
    GuidanceRequest.safeParse({
      ...input,
      context: { ...input.context, url: "https://user:secret@example.com" },
    }).success,
    false,
  );
  assert.equal(
    GuidanceRequest.safeParse({ ...input, context: { ...input.context, text: "x".repeat(12001) } })
      .success,
    false,
  );
});
test("guidance is bounded to supplied targets and strips URL secrets from model evidence", async () => {
  let evidence: unknown;
  const output = await pageGuidance(input, {
    json: async (_system, context) => {
      evidence = context;
      return {
        supported: true,
        message: "The name field is required.",
        steps: [{ instruction: "Move to Your name.", targetId: "name" }],
      };
    },
  });
  assert.equal(output.contextRevision, "rev-1");
  assert.equal(output.steps[0]?.targetId, "name");
  assert.equal(JSON.stringify(evidence).includes("private=secret"), false);
  assert.equal(JSON.stringify(evidence).includes("#token"), false);
  assert.equal(output.status, "guidance");
});
test("unknown or disabled target IDs, injected properties and invented completion claims fail closed", async () => {
  for (const result of [
    {
      supported: true,
      message: "Do it",
      steps: [{ instruction: "Open unseen control", targetId: "unknown" }],
    },
    {
      supported: true,
      message: "Do it",
      steps: [{ instruction: "Activate disabled button", targetId: "submit" }],
    },
    { supported: true, message: "I have submitted the form", steps: [] },
    { supported: true, message: "Do it", steps: [], execute: "fetch secrets" },
    { supported: false, message: "Missing evidence", steps: [] },
  ]) {
    const output = await pageGuidance(input, { json: async () => result });
    assert.equal(output.status, "insufficient-context");
    assert.deepEqual(output.steps, []);
  }
});
test("empty Hindi context returns clarification without model calls; explain and simplify preserve revision", async () => {
  const unsupported = await pageGuidance(
    { ...input, goal: "Where is cryptocurrency withdrawal?" },
    {
      json: async () => {
        throw Error("Unseen task must not call the model");
      },
    },
  );
  assert.equal(unsupported.status, "insufficient-context");
  const empty = await pageGuidance(
    {
      ...input,
      language: "hi",
      context: { ...input.context, text: "", controls: [], headings: [] },
    },
    {
      json: async () => {
        throw Error("must not call model");
      },
    },
  );
  assert.equal(empty.status, "insufficient-context");
  assert.match(empty.message, /जानकारी/);
  const wrongLanguage = await pageGuidance(
    { ...input, language: "hi" },
    {
      json: async () => ({ supported: true, message: "English only", steps: [] }),
    },
  );
  assert.equal(wrongLanguage.status, "insufficient-context");
  assert.match(wrongLanguage.message, /जानकारी/);
  for (const mode of ["explain", "simplify"] as const) {
    const result = await pageGuidance(
      { ...input, mode, previousInstruction: "Explain the required field" },
      {
        json: async () => ({
          supported: true,
          message: "Your name is required.",
          steps: [{ instruction: "This field needs a name.", targetId: null }],
        }),
      },
    );
    assert.equal(result.contextRevision, input.context.revision);
    assert.equal(result.steps[0]?.targetId, undefined);
  }
});

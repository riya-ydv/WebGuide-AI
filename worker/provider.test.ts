import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { Provider } from "./planner.js";
import { ModelProvider, providerConfiguration, providerReadiness } from "./provider.js";

// Contract tests use a local mock HTTP server, never evidence of real AI inference.
test("provider HTTP contracts (mock provider, not live model)", async (t) => {
  const keys = [
    "GUIDEFLOW_AI_PROVIDER",
    "GUIDEFLOW_AI_BASE_URL",
    "GUIDEFLOW_AI_MODEL",
    "GUIDEFLOW_AI_API_KEY",

  ];
  const previous = new Map(keys.map((key) => [key, process.env[key]]));
  let status = 200;
  let response: unknown = { choices: [{ message: { content: '{"type":"stop"}' } }] };
  let body: Record<string, unknown> = {};
  let hold = false;
  const server = http.createServer(async (request, reply) => {
    if (request.url === "/v1/models") {
      reply.end(JSON.stringify({ data: [{ id: "test-model" }] }));
      return;
    }
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    body = JSON.parse(Buffer.concat(chunks).toString());
    if (hold) return;
    reply.writeHead(status, {
      "Content-Type": "application/json",
      ...(status === 302 ? { Location: "http://127.0.0.1:1/secret" } : {}),
    });
    reply.end(JSON.stringify(response));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  process.env["GUIDEFLOW_AI_PROVIDER"] = "openai-compatible";
  process.env["GUIDEFLOW_AI_MODEL"] = "test-model";
  process.env["GUIDEFLOW_AI_BASE_URL"] = `http://127.0.0.1:${address.port}/v1`;
  delete process.env["GUIDEFLOW_AI_API_KEY"];
  try {
    await t.test(
      "local model does not require a cloud key and readiness is a model-list check",
      async () => {
        assert.deepEqual(providerConfiguration(), {
          provider: "openai-compatible",
          model: "test-model",
          configured: true,
        });
        assert.equal((await providerReadiness()).modelAvailable, true);
      },
    );
    await t.test("planner sends strict JSON schema and validates the actual proposal", async () => {
      const p = new Provider(new AbortController().signal);
      const action = await p.plan(
        {
          id: "o",
          url: "http://fixture",
          title: "Fixture",
          observedAt: "now",
          controls: [],
          state: "",
        },
        [],
        "read-only",
      );
      assert.deepEqual(action, { type: "stop" });
      assert.equal((body["response_format"] as { type: string }).type, "json_schema");
      assert.equal(body["model"], "test-model");
      response = { choices: [{ message: { content: '{"type":"javascript","code":"throw 1"}' } }] };
      await assert.rejects(
        p.plan(
          {
            id: "o",
            url: "http://fixture",
            title: "Fixture",
            observedAt: "now",
            controls: [],
            state: "",
          },
          [],
          "read-only",
        ),
      );
    });
    await t.test(
      "malformed responses, refusal and provider status return safe errors",
      async () => {
        response = { choices: [{ message: { content: "not JSON" } }] };
        await assert.rejects(
          new ModelProvider(new AbortController().signal).json("s", {}),
          /malformed structured/,
        );
        response = { choices: [{ message: { content: null, refusal: "private secret" } }] };
        await assert.rejects(
          new ModelProvider(new AbortController().signal).json("s", {}),
          /refused or returned an invalid/,
        );
        status = 429;
        response = { secret: "never expose this" };
        await assert.rejects(
          new ModelProvider(new AbortController().signal).json("s", {}),
          /^Error: AI provider request failed \(429\)$/,
        );
        status = 302;
        await assert.rejects(
          new ModelProvider(new AbortController().signal).json("s", {}),
          /unavailable or request timed out/,
        );
        status = 200;
      },
    );
    await t.test("response bytes, context and request budgets enforced", async () => {
      response = { data: "x".repeat(33000) };
      await assert.rejects(
        new ModelProvider(new AbortController().signal).json("s", {}),
        /output limit/,
      );
      await assert.rejects(
        new ModelProvider(new AbortController().signal).json("s", "x".repeat(24001)),
        /context budget/,
      );
      const p = new ModelProvider(new AbortController().signal);
      p.requests = 14;
      await assert.rejects(p.json("s", {}), /request budget/);
    });
    await t.test("cancellation aborts a pending model request", async () => {
      hold = true;
      const c = new AbortController();
      const pending = new ModelProvider(c.signal).json("s", {});
      setTimeout(() => c.abort(), 30);
      await assert.rejects(pending, /cancelled/);
      hold = false;
    });
    await t.test(
      "invalid operator endpoints fail closed without exposing configured secrets",
      () => {
        for (const url of [
          "http://10.0.0.1:1234/v1",
          "file:///secret",
          "https://name:password@example.com/v1",
          "https://example.com/v1?token=secret",
        ]) {
          process.env["GUIDEFLOW_AI_BASE_URL"] = url;
          assert.equal(providerConfiguration().configured, false);
        }
        process.env["GUIDEFLOW_AI_PROVIDER"] = "unsupported-provider";
        assert.equal(providerConfiguration().configured, false);
      },
    );
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

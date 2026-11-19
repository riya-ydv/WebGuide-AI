import { test } from "node:test";
import assert from "node:assert/strict";
import {
  localConfiguration,
  ensureService,
  redact,
  setupEnvironment,
  installerEnvironment,
  diagnosticTail,
  modelDownloadProgress,
} from "./launcher-core.mjs";
const token = "test-only-" + "a".repeat(50);
test("installer subprocess environment omits tokens and provider keys", () => {
  assert.deepEqual(
    setupEnvironment({
      PATH: "/usr/bin",
      OLLAMA_HOST: "http://127.0.0.1:11434",
      GUIDEFLOW_WORKER_TOKEN: token,
      GUIDEFLOW_AI_API_KEY: "private",
      EXAMPLE_API_KEY: "private",
    }),
    { PATH: "/usr/bin", OLLAMA_HOST: "http://127.0.0.1:11434" },
  );
});
test("fresh setup creates an Ollama configuration with a private generated token", () => {
  const result = localConfiguration("", () => token);
  assert.equal(result.env.WEBGUIDE_AI_PROVIDER, "ollama");
  assert.equal(result.env.WEBGUIDE_AI_MODEL, "qwen3:4b");
  assert.equal(result.env.WEBGUIDE_AI_BASE_URL, "http://127.0.0.1:11436");
  assert.equal(result.env.WEBGUIDE_MANAGED_OLLAMA, "1");
  assert.equal(result.env.WEBGUIDE_WORKER_TOKEN, token);
});
test("existing provider, token and configuration bytes are preserved", () => {
  const original = `# keep my custom settings\nGUIDEFLOW_WORKER_TOKEN=${token}\nGUIDEFLOW_AI_PROVIDER=openai-compatible\nGUIDEFLOW_AI_BASE_URL=http://127.0.0.1:11435/v1\nGUIDEFLOW_AI_MODEL=custom-model\nGUIDEFLOW_SANDBOX_ORIGIN=http://127.0.0.1:4319\n`;
  const result = localConfiguration(original, () => {
    throw Error("must not rotate");
  });
  assert.equal(result.content, original);
  assert.equal(result.changed, false);
});
test("inherited supported configuration is respected and unsafe preexisting config fails closed", () => {
  const inherited = {
    GUIDEFLOW_WORKER_TOKEN: token,
    GUIDEFLOW_AI_PROVIDER: "openai-compatible",
    GUIDEFLOW_AI_MODEL: "existing",
    GUIDEFLOW_AI_BASE_URL: "https://model.example/v1",
  };
  const result = localConfiguration(
    "",
    () => {
      throw Error("must not rotate");
    },
    inherited,
  );
  assert.equal(result.env.WEBGUIDE_AI_PROVIDER, "openai-compatible");
  assert.equal(result.env.WEBGUIDE_WORKER_TOKEN, token);
  assert.throws(() => localConfiguration("GUIDEFLOW_WORKER_TOKEN=replace-placeholder\n"));
  assert.throws(() =>
    localConfiguration(`GUIDEFLOW_WORKER_TOKEN=${token}\nWEBGUIDE_WORKER_MODE=hosted\n`),
  );
});
test("verified existing services are reused without spawning or claiming ownership", async () => {
  let spawned = 0,
    checkedPort = 0;
  const result = await ensureService("worker", {
    probe: async () => true,
    occupied: async () => {
      checkedPort++;
      return true;
    },
    start: async () => {
      spawned++;
    },
    wait: async () => {},
    log: () => {},
  });
  assert.equal(result, "reused");
  assert.equal(spawned, 0);
  assert.equal(checkedPort, 0);
});
test("incompatible occupied ports are never killed or replaced", async () => {
  let spawned = 0;
  await assert.rejects(
    () =>
      ensureService("worker", {
        probe: async () => false,
        occupied: async () => true,
        start: async () => {
          spawned++;
        },
        wait: async () => {},
        log: () => {},
      }),
    /occupied/,
  );
  assert.equal(spawned, 0);
});
test("new services must pass identity probes; exit and readiness timeout are bounded", async () => {
  let checks = 0,
    waits = 0;
  const deps = {
    probe: async () => ++checks === 3,
    occupied: async () => false,
    start: async () => ({ exitCode: null }),
    wait: async () => {
      waits++;
    },
    log: () => {},
    attempts: 4,
  };
  assert.equal(await ensureService("app", deps), "started");
  assert.equal(waits, 1);
  await assert.rejects(
    () =>
      ensureService("app", {
        ...deps,
        probe: async () => false,
        start: async () => ({ exitCode: 1 }),
      }),
    /exited/,
  );
  await assert.rejects(
    () => ensureService("app", { ...deps, probe: async () => false, attempts: 2 }),
    /in time/,
  );
});
test("logs redact configured secrets and bearer strings", () => {
  const result = redact(`failure ${token} Bearer any-sensitive-value`, [token]);
  assert.equal(result.includes(token), false);
  assert.equal(result.includes("any-sensitive-value"), false);
});

test("installer prepends portable Node and isolates npm cache without conflicting Windows Path keys", () => {
  const result = installerEnvironment(
    {
      Path: "C:\\Windows\\System32;C:\\global-node",
      NPM_CONFIG_CACHE: "C:\\global-cache",
      HTTPS_PROXY: "https://proxy.example",
    },
    "C:\\project\\.webguide-local",
    "C:\\project\\.webguide-local\\node\\node.exe",
    "win32",
  );
  assert.equal(
    result.PATH,
    "C:\\project\\.webguide-local\\node;C:\\Windows\\System32;C:\\global-node",
  );
  assert.equal(result.npm_config_cache, "C:\\project\\.webguide-local\\npm-cache");
  assert.equal(result.Path, undefined);
  assert.equal(result.NPM_CONFIG_CACHE, undefined);
  assert.equal(result.HTTPS_PROXY, "https://proxy.example");
});

test("diagnostic tails bound output and redact split credentials and terminal controls", () => {
  const secret = "a-private-credential-12345";
  const tail = diagnosticTail(() => [secret]);
  tail.add("\x1b[31mfailed: a-private-");
  tail.add("credential-12345\x1b[0m\nhttps://user:password@example.test failed");
  assert.ok(!tail.read().includes(secret));
  assert.ok(!tail.read().includes("password"));
  assert.ok(!tail.read().includes("\x1b"));
  tail.add("x".repeat(30000));
  assert.ok(tail.read().length <= 3005);
  tail.add("\nlast useful error");
  assert.match(tail.read(), /last useful error/);
});

test("model heartbeat selects bounded sanitized CLI progress, not arbitrary output", () => {
  const tail = diagnosticTail(() => ["private-value"]);
  tail.add("\x1b[?25lpulling layer: 12% 300 MB / 2.5 GB  8.1 MB/s\r");
  tail.add("pulling layer: 13% 325 MB / 2.5 GB  8.2 MB/s private-value\x1b[?25h");
  const progress = modelDownloadProgress(tail);
  assert.match(progress, /13%/);
  assert.ok(!progress.includes("private-value"));
  assert.ok(!progress.includes("\x1b"));
  assert.ok(progress.length <= 500);
  const arbitrary = diagnosticTail(() => []);
  arbitrary.add("some unrecognized child output");
  assert.equal(modelDownloadProgress(arbitrary), "");
});

test("canonical WebGuide configuration wins without modifying legacy file bytes", () => {
  const legacy = `GUIDEFLOW_WORKER_TOKEN=${token}\nGUIDEFLOW_AI_PROVIDER=ollama\nGUIDEFLOW_AI_MODEL=old-model\nGUIDEFLOW_AI_BASE_URL=http://127.0.0.1:11434\nWEBGUIDE_AI_MODEL=new-model\nGUIDEFLOW_SANDBOX_ORIGIN=http://127.0.0.1:4319\n`;
  const result = localConfiguration(legacy);
  assert.equal(result.content, legacy);
  assert.equal(result.env.WEBGUIDE_AI_MODEL, "new-model");
  const fresh = localConfiguration("", () => token);
  assert(!fresh.content.includes("GUIDEFLOW_"));
  assert(fresh.content.includes("WEBGUIDE_WORKER_TOKEN="));
});

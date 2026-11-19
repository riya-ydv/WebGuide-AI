import { useEffect, useRef, useState } from "react";
import { Globe, RefreshCw } from "lucide-react";
import { z } from "zod";
import { consumeLauncherConnection } from "@/features/assistance/launcher-connection";
import { setBackendSession } from "@/features/assistance/backend-session";

const configuredEndpoint = import.meta.env["VITE_WEBGUIDE_WORKER_URL"] as string | undefined;
const Health = z.object({
  workerConnected: z.literal(true),
  aiConfigured: z.boolean(),
  browserReady: z.boolean(),
  aiProvider: z.string().optional(),
  aiModel: z.string().optional(),
  aiReachable: z.boolean().optional(),
  aiModelAvailable: z.boolean().optional(),
  aiVerifiedAt: z.string().nullable().optional(),
  aiDetail: z.string().optional(),
});
const VerifiedAI = z.object({ provider: z.string(), model: z.string(), verifiedAt: z.string() });
const Evidence = z.object({
  observationId: z.string(),
  actionResultId: z.string(),
  controlId: z.string(),
});
const Tutorial = z.object({
  id: z.string(),
  title: z.string(),
  goal: z.string(),
  startingPage: z.string(),
  prerequisites: z.array(z.string()),
  beginnerInstructions: z.string(),
  refresherInstructions: z.string(),
  verificationStatus: z.string(),
  lastVerifiedAt: z.string(),
  sourceRunId: z.string(),
  generator: z.string(),
  steps: z.array(
    z.object({
      instruction: z.string(),
      targetControl: z.string(),
      expectedResult: z.string(),
      evidence: Evidence,
    }),
  ),
});
const Job = z.object({
  id: z.string(),
  url: z.string(),
  mode: z.string(),
  planner: z.string(),
  status: z.string(),
  startedAt: z.string(),
  events: z.array(z.string()),
  observations: z.array(z.unknown()),
  traces: z.array(z.unknown()),
  tutorials: z.array(Tutorial),
  error: z.string().optional(),
});
const Answer = z.object({
  answer: z.string(),
  citations: z.array(
    z
      .object({
        tutorialId: z.string(),
        step: z.number(),
        instruction: z.string(),
        label: z.string(),
      })
      .passthrough(),
  ),
});

export function workerEndpoint(value: string): string {
  const url = new URL(value.trim());
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/" ||
    !(url.protocol === "https:" || (url.protocol === "http:" && loopback))
  ) {
    throw new Error(
      "Use an HTTPS backend origin, or HTTP on localhost. Paths, credentials and query strings are not allowed.",
    );
  }
  return url.origin;
}

export function WorkerPanel({
  onAIStatus,
  selectedSite,
}: {
  onAIStatus?: (status: string) => void;
  selectedSite?: { url: string; key: number } | undefined;
}) {
  const [endpoint, setEndpoint] = useState("");
  useEffect(() => {
    if (configuredEndpoint) setEndpoint(configuredEndpoint);
    else if (["127.0.0.1", "localhost"].includes(window.location.hostname))
      setEndpoint("http://127.0.0.1:4318");
  }, []);
  const [health, setHealth] = useState<z.infer<typeof Health> | null>(null);
  const [token, setToken] = useState("");
  const [url, setUrl] = useState("");
  const [sandbox, setSandbox] = useState(false);
  useEffect(() => {
    if (selectedSite) {
      setUrl(selectedSite.url);
      setSandbox(false);
    }
  }, [selectedSite]);
  const [planner, setPlanner] = useState<"ai" | "deterministic">("ai");
  const [jobs, setJobs] = useState<z.infer<typeof Job>[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [verifyingAI, setVerifyingAI] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<z.infer<typeof Answer> | null>(null);
  const [instructionMode, setInstructionMode] = useState<"beginner" | "refresher">("beginner");
  const request = useRef<AbortController | null>(null);
  useEffect(() => {
    let active = true;
    if (window.location.hash.startsWith("#webguide-connect=")) setBusy(true);
    const connection = consumeLauncherConnection();
    if (window.location.origin === "http://127.0.0.1:4320") {
      void connection
        .then((value) => {
          if (!active || !value) return;
          const nextHealth = Health.parse(value.health);
          const nextJobs = z.array(Job).parse(value.jobs);
          setEndpoint(value.endpoint);
          setToken(value.token);
          setHealth(nextHealth);
          setJobs(nextJobs);
          setError("");
          setBackendSession({ endpoint: value.endpoint, token: value.token });
        })
        .catch(() => {
          if (active) {
            setHealth(null);
            setBackendSession(null);
            setError(
              "Local launcher connection could not be verified. Reopen Start WebGuide or connect manually.",
            );
          }
        });
    } else void connection.catch(() => {});
    void connection.then(
      () => {
        if (active) setBusy(false);
      },
      () => {
        if (active) setBusy(false);
      },
    );
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    onAIStatus?.(
      !health
        ? "Not checked"
        : !health.aiConfigured
          ? "Not configured"
          : !health.aiModelAvailable
            ? "Unavailable"
            : health.aiVerifiedAt
              ? "Inference verified"
              : "Model available",
    );
  }, [health, onAIStatus]);
  async function api(
    path: string,
    method = "GET",
    body?: unknown,
    timeoutMs = 12000,
  ): Promise<unknown> {
    const response = await fetch(`${workerEndpoint(endpoint)}${path}`, {
      redirect: "error",
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const payload: unknown = await response.json();
    if (!response.ok) {
      const parsed = z.object({ error: z.string() }).safeParse(payload);
      throw new Error(parsed.success ? parsed.data.error : "Worker request failed.");
    }
    return payload;
  }
  async function checkConnection() {
    setHealth(null);
    setBackendSession(null);
    setJobs([]);
    setAnswer(null);
    request.current?.abort();
    setError("");
    setBusy(true);
    try {
      if (!token.trim()) throw new Error("Enter the worker access token before connecting.");
      const response = await fetch(`${workerEndpoint(endpoint)}/health`, {
        redirect: "error",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error("Worker health check failed.");
      setHealth(Health.parse(await response.json()));
      if (token) setJobs(z.array(Job).parse(await api("/jobs")));
      setBackendSession({ endpoint: workerEndpoint(endpoint), token });
    } catch (cause) {
      setHealth(null);
      setBackendSession(null);
      setError(cause instanceof Error ? cause.message : "Worker disconnected.");
    } finally {
      setBusy(false);
    }
  }
  async function verifyAI() {
    setError("");
    setBusy(true);
    setVerifyingAI(true);
    try {
      const verified = VerifiedAI.parse(await api("/ai/verify", "POST", {}, 65000));
      const response = await fetch(`${workerEndpoint(endpoint)}/health`, {
        redirect: "error",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok)
        throw new Error("AI inference completed, but worker readiness could not be refreshed.");
      const next = Health.parse(await response.json());
      setHealth({ ...next, aiVerifiedAt: verified.verifiedAt });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "AI inference could not be verified.");
    } finally {
      setBusy(false);
      setVerifyingAI(false);
    }
  }
  useEffect(() => {
    if (!health || !token) return;
    let stopped = false;
    const poll = async () => {
      const abort = new AbortController();
      request.current = abort;
      try {
        const response = await fetch(`${workerEndpoint(endpoint)}/jobs`, {
          redirect: "error",
          headers: { Authorization: `Bearer ${token}` },
          signal: AbortSignal.any([abort.signal, AbortSignal.timeout(5000)]),
        });
        if (!response.ok) throw new Error("Worker access rejected. Check the session token.");
        const next = z.array(Job).parse(await response.json());
        if (!stopped) setJobs(next);
      } catch (cause) {
        if (!stopped) {
          setError(cause instanceof Error ? cause.message : "Worker disconnected.");
          setHealth(null);
          setBackendSession(null);
        }
      }
    };
    void poll();
    const timer = setInterval(() => void poll(), 2000);
    return () => {
      stopped = true;
      clearInterval(timer);
      request.current?.abort();
    };
  }, [health, token, endpoint]);
  async function createJob() {
    setError("");
    setBusy(true);
    try {
      const job = Job.parse(
        await api("/jobs", "POST", {
          url: sandbox ? "http://127.0.0.1:4319" : url,
          mode: sandbox ? "sandbox" : "read-only",
          planner,
        }),
      );
      setJobs((previous) => [job, ...previous.filter((item) => item.id !== job.id)]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Job could not be created.");
    } finally {
      setBusy(false);
    }
  }
  async function control(id: string, remove: boolean) {
    setBusy(true);
    setError("");
    try {
      await api(
        `/jobs/${encodeURIComponent(id)}${remove ? "" : "/cancel"}`,
        remove ? "DELETE" : "POST",
      );
      setJobs(z.array(Job).parse(await api("/jobs")));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Job control failed.");
    } finally {
      setBusy(false);
    }
  }
  async function ask(id: string) {
    if (busy || jobs.some((job) => ["running", "queued"].includes(job.status))) return;
    setBusy(true);
    setError("");
    setAnswer(null);
    try {
      setAnswer(
        Answer.parse(await api(`/jobs/${encodeURIComponent(id)}/ask`, "POST", { question }, 65000)),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No answer available.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="gf-card">
      <div className="gf-section-title">
        <div>
          <span className="gf-icon">
            <Globe />
          </span>
          <h2>Explore an external application</h2>
        </div>
        <button disabled={busy} onClick={() => void checkConnection()}>
          <RefreshCw size={14} />
          Check worker connection
        </button>
      </div>
      <p className="wg-connection-summary" role="status">
        {health
          ? "Service connected. Choose a website to explore."
          : "Service not connected. Start the WebGuide launcher, then check the connection."}
      </p>
      <details className="wg-connection-details">
        <summary>Connection settings and AI check</summary>
        <label className="gf-worker-label">
          Backend URL
          <input
            type="url"
            aria-label="Backend URL"
            value={endpoint}
            disabled={busy}
            autoComplete="off"
            placeholder="https://api.your-domain.example"
            onChange={(event) => {
              request.current?.abort();
              setEndpoint(event.target.value);
              setToken("");
              setHealth(null);
              setBackendSession(null);
              setJobs([]);
              setAnswer(null);
              setError("");
            }}
          />
        </label>
        <p>
          Enter your trusted backend address and access token, then choose Check worker connection.
          Changing the address clears the token and disconnects this session.
        </p>
        <div className="gf-worker-status">
          <span>Worker: {health ? "connected" : "not connected"}</span>
          <span>Browser: {health?.browserReady ? "ready" : "not verified"}</span>
          <span>
            AI: {health ? (health.aiConfigured ? "configured" : "not configured") : "not checked"}
          </span>
          {health?.aiProvider && <span>Provider: {health.aiProvider}</span>}
          {health?.aiModel && <span>Model: {health.aiModel}</span>}
          {health?.aiConfigured && (
            <>
              <span>Model server: {health.aiReachable ? "reachable" : "not reachable"}</span>
              <span>Model: {health.aiModelAvailable ? "available" : "not available"}</span>
              <span>
                Inference:{" "}
                {health.aiVerifiedAt ? `verified ${health.aiVerifiedAt}` : "not yet verified"}
              </span>
            </>
          )}
        </div>
        {health?.aiDetail && (
          <p>
            {health.aiVerifiedAt && health.aiModelAvailable
              ? "Model available; a successful inference has been recorded below."
              : health.aiDetail}
          </p>
        )}
        <div className="gf-toolbar">
          <button
            disabled={busy || !token || !health?.aiConfigured || !health.aiModelAvailable}
            onClick={() => void verifyAI()}
          >
            {verifyingAI ? "Running model inference…" : "Verify AI connection"}
          </button>
          <small>
            Runs a real model inference. A successful connection check alone does not verify an
            exploration.
          </small>
        </div>
        <p>
          Worker at {endpoint || "not configured"}. External sites are read-only. Only the
          separately hosted disposable fixture permits mutation testing.
        </p>
        <div className="gf-toolbar">
          <label className="gf-worker-label">
            Worker access token
            <input
              type="password"
              aria-label="Worker access token"
              autoComplete="off"
              value={token}
              disabled={busy}
              onChange={(e) => {
                request.current?.abort();
                setHealth(null);
                setBackendSession(null);
                setError("");
                setToken(e.target.value);
                setJobs([]);
                setAnswer(null);
              }}
              placeholder="Server-configured token · memory only"
            />
          </label>
        </div>
      </details>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void createJob();
        }}
      >
        <div className="gf-toolbar">
          <label className="gf-worker-label">
            Authorised website URL
            <input
              type="url"
              aria-label="Authorised website URL"
              placeholder="https://your-authorised-application.example"
              value={sandbox ? "http://127.0.0.1:4319" : url}
              disabled={sandbox}
              onChange={(e) => setUrl(e.target.value)}
              required={!sandbox}
              maxLength={2048}
            />
          </label>
          <button
            className="gf-primary"
            disabled={
              busy ||
              !health?.browserReady ||
              !token ||
              (planner === "ai" && (!health.aiConfigured || !health.aiModelAvailable)) ||
              (planner === "deterministic" && !sandbox)
            }
          >
            Start external exploration
          </button>
        </div>
        <details className="wg-test-options">
          <summary>Advanced test options</summary>
          <label>
            <input
              type="checkbox"
              checked={sandbox}
              onChange={(e) => {
                setSandbox(e.target.checked);
                if (!e.target.checked) setPlanner("ai");
              }}
            />{" "}
            Controlled fixture test (disposable application)
          </label>
          <div className="gf-toolbar">
            <label className="gf-worker-label">
              Exploration planner
              <select
                aria-label="Exploration planner"
                value={planner}
                onChange={(e) =>
                  setPlanner(e.target.value === "deterministic" ? "deterministic" : "ai")
                }
              >
                <option value="ai">AI — configured model</option>
                <option value="deterministic" disabled={!sandbox}>
                  Deterministic fixture test
                </option>
              </select>
            </label>
            <small>
              {planner === "ai"
                ? "The server-side model proposes actions; execution policy still decides what is permitted."
                : "Generic deterministic discovery for the fixture only. This is not a real AI run."}
            </small>
          </div>
        </details>
      </form>
      {error && (
        <p role="alert" className="gf-error">
          {error}
        </p>
      )}
      <details>
        <summary>Data and privacy</summary>
        <small>
          Model configuration and any provider key stay on the server. Your worker access token is
          retained in this page’s memory, never saved to browser storage. External evidence follows
          the worker’s retention policy.
        </small>
      </details>
      {jobs.length > 0 && (
        <div className="gf-toolbar">
          <label>
            External tutorial mode{" "}
            <select
              value={instructionMode}
              onChange={(e) =>
                setInstructionMode(e.target.value === "beginner" ? "beginner" : "refresher")
              }
            >
              <option value="beginner">Beginner</option>
              <option value="refresher">Refresher</option>
            </select>
          </label>
          <button onClick={() => window.print()}>Print external guides</button>
        </div>
      )}
      {jobs.map((job) => (
        <article className="gf-job" key={job.id}>
          <div className="gf-section-title">
            <h3>{job.url}</h3>
            <span className="gf-pill">{job.status}</span>
          </div>
          <small>
            {job.id} · {job.planner} planner · {job.mode} · {job.startedAt}
          </small>
          <div className="gf-toolbar">
            {["running", "queued"].includes(job.status) && (
              <button onClick={() => void control(job.id, false)}>Cancel job</button>
            )}
            <button
              disabled={["running", "queued"].includes(job.status)}
              onClick={() => void control(job.id, true)}
            >
              Delete job evidence
            </button>
          </div>
          {job.error && <p className="gf-error">{job.error}</p>}
          <details>
            <summary>Event log ({job.events.length})</summary>
            <ol>
              {job.events.map((event, i) => (
                <li key={i}>{event}</li>
              ))}
            </ol>
          </details>
          <details>
            <summary>
              Observations ({job.observations.length}) and action traces ({job.traces.length})
            </summary>
            <pre>
              {JSON.stringify({ observations: job.observations, traces: job.traces }, null, 2)}
            </pre>
          </details>
          {job.tutorials.map((tutorial) => (
            <section className="gf-tutorial" key={tutorial.id}>
              <h3>{tutorial.title}</h3>
              <span className="gf-pill">{tutorial.verificationStatus}</span>
              <p>{tutorial.goal}</p>
              <small>
                Start: {tutorial.startingPage} · Prerequisites: {tutorial.prerequisites.join(", ")}
              </small>
              <p>
                {instructionMode === "beginner"
                  ? tutorial.beginnerInstructions
                  : tutorial.refresherInstructions}
              </p>
              <ol>
                {tutorial.steps.map((step, i) => (
                  <li key={i}>
                    <strong>{step.instruction}</strong>
                    <p>Expected: {step.expectedResult}</p>
                    <small>
                      Evidence: {step.evidence.observationId} / {step.evidence.actionResultId} /{" "}
                      {step.evidence.controlId}
                    </small>
                  </li>
                ))}
              </ol>
              <small>
                Source {tutorial.sourceRunId} · {tutorial.lastVerifiedAt} · {tutorial.generator}
              </small>
            </section>
          ))}
          {job.tutorials.length > 0 && (
            <form
              className="gf-toolbar"
              onSubmit={(e) => {
                e.preventDefault();
                void ask(job.id);
              }}
            >
              <input
                aria-label={`Question for ${job.id}`}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                required
                maxLength={500}
                placeholder="Ask about this exploration’s evidence"
              />
              <button
                disabled={busy || jobs.some((item) => ["running", "queued"].includes(item.status))}
              >
                Ask this job
              </button>
            </form>
          )}
        </article>
      ))}
      {answer && (
        <div className="gf-notice">
          <div>
            <p>{answer.answer}</p>
            {answer.citations.map((citation, i) => (
              <p key={i}>
                <small>
                  {citation.tutorialId}, step {citation.step}: {citation.instruction}
                </small>
              </p>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

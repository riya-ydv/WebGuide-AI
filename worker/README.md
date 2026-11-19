# WebGuide AI browser worker

Run `npm run worker` after installing Chromium (`npx playwright install chromium`). The worker reads `WEBGUIDE_WORKER_TOKEN` (random 32+ characters), `WEBGUIDE_AI_PROVIDER` (`openai-compatible` or `ollama`), `WEBGUIDE_AI_BASE_URL`, `WEBGUIDE_AI_MODEL`, optional server-only `WEBGUIDE_AI_API_KEY`, optional `WEBGUIDE_SANDBOX_ORIGIN=http://127.0.0.1:4319`, and `WEBGUIDE_RETENTION_MS` (default one hour, max one day) from the server environment. No provider key goes into frontend variables. For local `.env`, invoke Node with `--env-file=.env` before `--import tsx worker/server.ts`.

The process binds only `127.0.0.1:4318`. `/health` reports worker, Chromium installation and AI configuration independently. All other routes require `Authorization: Bearer <worker token>`. This is explicitly a **single-user local application**, not a multi-user service. The token represents the sole owner; no cross-user sharing exists. The dashboard may retain the worker token in component memory only. CORS accepts exactly `http://127.0.0.1:4320 and http://localhost:4320`; Host checks, request-size limits and bearer authentication prevent ambient-cookie CSRF and DNS-rebinding API access.

## Contracts

- `GET /health`: worker/browser/configuration plus `aiProvider`, `aiModel`, `aiReachable`, `aiModelAvailable`, `aiVerifiedAt`, `aiDetail`. Readiness is cached five seconds and rate-limited; model-list availability is distinct from actual inference. Browser readiness checks installation only.
- `POST /ai/verify`: authenticated real schema-validated inference; returns provider/model/verification timestamp.
- `POST /jobs`: `{url,mode:"read-only"|"sandbox",planner:"ai"|"deterministic"}`. Defaults read-only/ai. Returns 202 Job. Missing AI returns 503, never fake completion.
- `GET /jobs`, `GET /jobs/:id`: jobs with events, observations, traces and tutorials.
- `POST /jobs/:id/cancel`: abort provider/network requests and close browser context. `DELETE /jobs/:id` aborts and deletes evidence.
- `POST /jobs/:id/ask`: `{question}` returns evidence-only extractive answer and step citations, or explicit unsupported answer. AI jobs use a real model call to select cited evidence; backend renders exact verified instructions. Unknown tasks are refused before a model can invent actions. Deterministic jobs retain extractive-only answers.

Strict Zod contracts live in `contracts.ts`. Job states: queued, running, completed, partial, failed, cancelled. Evidence lives only in process memory, expires automatically and is lost on restart; browser local tutorial storage is independent.

## Verification fixture

`npm run worker:fixture` hosts a separately served synthetic task application at `http://127.0.0.1:4319`. Set the exact sandbox origin environment variable, then submit `{url:"http://127.0.0.1:4319",mode:"sandbox",planner:"deterministic"}`. This bounded generic planner discovers visible controls; it is **not a real-AI test**. Sandbox actions require per-control `data-webguide-safe="true"`; only this fixed loopback fixture origin can enable mutation. Real AI testing requires a reachable configured local/server model and `planner:"ai"`. Variants `/renamed`, `/broken` and `/prompt-injection` exercise label changes, unsuccessful actions and hostile page text. The explicitly allowed fixture origin can also be tested in read-only mode without granting mutation permission.

## Security boundaries and limitations

Observation, planner, policy, runner, network and tutorial modules are separate. Each job creates a fresh Chromium context; personal profiles, authentication cookies, screenshots and storage-state imports are unsupported. External pages have JavaScript disabled and permit **inspection only**. This deliberately limits dynamic application coverage and does not verify form submissions or protected workflows. Public-page initial GETs are performed only with user-authorised destinations; arbitrary websites can still have server-side side effects on GET, so use authorised sites only.

The browser has no provider environment variables. HTTP(S) requests are intercepted, constrained to the authorised origin, all DNS answers are checked for public addresses, and a Node request pins the selected IP. Redirects return to the same policy; no auto-follow, browser cookies, credentials, or authorization headers are forwarded. Service workers, WebSockets, popups, downloads, non-GET methods and off-origin traffic are blocked. External-page JavaScript is disabled. Sandbox scripts are trusted controlled-fixture code, not arbitrary sites.

Limits: one active job, 50 retained jobs, 180 seconds by default (`WEBGUIDE_JOB_TIMEOUT_MS`, bounded 30–300 seconds), ten actions, 100 requests, 2 MB per response, 10 MB aggregate accepted response bodies, 60 controls per observation, 14 AI calls, 24K-character request contexts, 700 output tokens per AI call, no retries. Provider pricing is not inferred; these request/token bounds limit exposure but are not an exact currency cap. Chromium OS-level CPU/memory quotas and network firewall isolation are **not implemented in the local Windows launcher**. Browser sandboxing is enabled; this is not equivalent to a hardened disposable VM. Do not publicly expose or use this local worker to execute untrusted active scripts. A production deployment needs a separate nonprivileged container/VM with memory/CPU quotas and deny-by-default egress firewall.

Only visible labels and explicit status/result regions are retained and sent to the planner. No full-page text, HTML, screenshots, input values, hidden fields or passwords are collected. Labels/status regions can still contain personal data: scan synthetic/public data with consent. Query parameters/fragments are removed from stored URLs. No raw provider errors or stack traces are returned. AI is subordinate to schema and action policy; website instructions cannot enable extra actions. The AI tutorial response must cite existing verified traces, and published title/actions/results are constrained to observed labels and verified evidence. Label changes propagate into step text. Click verification additionally requires the controlled fixture's target-specific `data-webguide-expect` text to appear in changed result state. Missing expected-result contracts remain partial. Evidence Q&A is conservative: every meaningful query term must match a verified target, then AI selects only known step IDs. Answers are rendered from those existing instructions. Deleting/cancelling a job aborts its pending AI answer; client disconnect/shutdown also aborts provider requests.

Browser teardown allows three seconds for graceful context cleanup, then kills only the job-owned browser server/process tree. This prevents a stalled Windows Chromium shutdown from permanently holding the single-job slot.

Official API references: [Playwright networking](https://playwright.dev/docs/network), [Browser context isolation and routing](https://playwright.dev/docs/api/class-browsercontext).

## Verified local provider

Official Qwen3-4B Q4_K_M + llama.cpp b12375 was run on NVIDIA Vulkan1 at 127.0.0.1:11435, with API-key-file authentication and restricted CORS. Both runtime and model checksums were checked. See [real AI acceptance](../docs/REAL_AI_ACCEPTANCE.md) and [exact server configuration](../docs/SERVER_SETUP.md). No cloud API key is needed for this provider. The provider endpoint is operator configuration only, never taken from webpage evidence or model proposals. Nonloopback endpoints require HTTPS; redirects are rejected.

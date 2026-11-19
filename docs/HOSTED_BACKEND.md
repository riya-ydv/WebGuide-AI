# Hosted WebGuide AI backend

This repository includes an authenticated, **single-owner, single-process** browser worker with persistent evidence. It has been tested locally using hosted configuration and real Chromium. No cloud backend, public URL, model server or cloud account has been deployed. Docker runtime validation remains outstanding because the development machine's Docker daemon was unavailable.

The frontend container and this backend are separate services. Deploying only the frontend does not deploy AI. The model is a third service: an operator-managed OpenAI-compatible HTTPS endpoint or a loopback Ollama service on the same host as a natively running worker. No cloud API key is needed for those self-hosted providers.

## Before hosting

- Use a dedicated Linux host with Docker Compose, Chromium user namespaces and the supplied seccomp profile supported. Start with 2 CPU and 2 GB RAM for the browser worker; model memory is additional and depends on the model.
- Use one worker replica and one private persistent volume. Do not autoscale or run multiple processes against the evidence directory. This worker runs jobs in-process; scale-to-zero and request-only CPU allocation can interrupt jobs.
- Put an HTTPS reverse proxy in front of the loopback backend port. Preserve the original `Host` header and configure that exact hostname in the worker allowlist. Do not trust forwarded-host headers or add wildcards.
- Restrict network egress at the hosting layer as well as using the worker's destination checks. The browser handles untrusted public pages; container configuration is not a security certification. Public-page JavaScript and non-GET requests remain disabled. Authenticated website sessions are not supported.
- The bearer token grants access to every retained job. This is an operator tool, not a public multi-user service. Do not put the token in frontend build variables, a public ZIP, logs or shared website code. A public multi-user product requires individual accounts and per-user authorization first.

## Container setup

From the project root, on the eventual Linux server:

```sh
cp deploy/backend/.env.example deploy/backend/.env
chmod 600 deploy/backend/.env
openssl rand -hex 32
```

Put the generated random value into `WEBGUIDE_WORKER_TOKEN` in the private `.env` file. Set your real backend hostname, frontend origin and model connection there. Placeholder values intentionally do not produce a usable deployment. Never send the filled file to anyone.

```sh
docker compose -f deploy/backend/compose.yml config --quiet
docker compose -f deploy/backend/compose.yml up --build -d
docker compose -f deploy/backend/compose.yml ps
docker compose -f deploy/backend/compose.yml logs --tail 60 backend
curl --fail http://127.0.0.1:4318/health
```

The published port is restricted to the host's loopback interface. Configure the HTTPS reverse proxy to forward to `127.0.0.1:4318`. Do not expose an unauthenticated model endpoint. Enter the HTTPS backend URL and bearer token in the app's backend connector; the frontend needs the bearer token to inspect actual AI readiness. An anonymous health response proves only worker liveness, not working AI.

The image pins Playwright 1.65.1 and its matching browser image digest, runs as `pwuser`, enables the Chromium sandbox, drops capabilities and uses the version-matched official Playwright seccomp profile. Do not work around sandbox startup errors using root or `--no-sandbox`; fix host support or select a compatible host. Google Cloud Run and Railway frontend deployment templates do not establish compatibility with this browser worker's sandbox, volume and background-job requirements. Verify these requirements before choosing the backend host; a dedicated VM is the simplest target for this Compose setup.

## Configuration

The packaged Chrome extension has the stable public ID `nnodbcjnbbdbbdakdhppclfbblcmjejl`. Its background POST requests send `Origin: chrome-extension://nnodbcjnbbdbbdakdhppclfbblcmjejl`. Local worker defaults allow this exact origin alongside the local app. If `WEBGUIDE_ALLOWED_ORIGINS` is set explicitly, it replaces those defaults: append this exact extension origin to the comma-separated list. For hosted deployments, configure it explicitly in the backend's private environment, along with the frontend HTTPS origin, then restart the backend. Find the installed extension's ID in `chrome://extensions`; development copies without the packaged public manifest key may have a different ID and require their own exact allowlist entry. Wildcards, `null` origins and malformed extension IDs are rejected. Origin permission never replaces the bearer token.

| Variable                                            | Purpose                                                                                                                                                                               |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `WEBGUIDE_WORKER_MODE=hosted`                       | Requires trusted origins, hosts and persistent storage; hides readiness details from anonymous health checks.                                                                         |
| `WEBGUIDE_WORKER_HOST=0.0.0.0`                      | Container bind address. Local mode remains loopback-only.                                                                                                                             |
| `PORT=8080`                                         | Container listen port; `WEBGUIDE_WORKER_PORT` is the alternative for native startup.                                                                                                  |
| `WEBGUIDE_WORKER_TOKEN` or `WEBGUIDE_WORKER_TOKEN` | Random bearer secret, 32–512 non-whitespace characters.                                                                                                                               |
| `WEBGUIDE_ALLOWED_HOSTS`                            | Exact comma-separated incoming hostnames, including ports where present. Include `127.0.0.1:8080` for container health and `127.0.0.1:4318` for host-local checks.                    |
| `WEBGUIDE_ALLOWED_ORIGINS`                          | Exact frontend HTTPS origins, without trailing slashes. Loopback HTTP is allowed for local testing only.                                                                              |
| `WEBGUIDE_DATA_DIR=/data`                           | Private persistent evidence directory. Container template mounts a named volume here.                                                                                                 |
| `WEBGUIDE_AI_PROVIDER`                             | `openai-compatible` for the remote endpoint example; `ollama` for a loopback native setup.                                                                                            |
| `WEBGUIDE_AI_BASE_URL`                             | HTTPS endpoint ending in `/v1` for OpenAI-compatible models. Native Ollama normally uses `http://127.0.0.1:11434`, without `/v1`. Container localhost refers to the container itself. |
| `WEBGUIDE_AI_MODEL`                                | Exact model alias actually served by the endpoint.                                                                                                                                    |
| `WEBGUIDE_AI_API_KEY`                              | Model service secret, only in backend environment.                                                                                                                                    |
| `WEBGUIDE_RETENTION_MS`                            | Completed evidence retention, default one hour; bounded to one minute–24 hours.                                                                                                       |
| `WEBGUIDE_JOB_TIMEOUT_MS`                          | Browser run timeout; default 180 seconds, bounded by the worker.                                                                                                                      |

Leave `WEBGUIDE_SANDBOX_ORIGIN` unset in real hosting. It exists only for the controlled local test fixture and cannot enable actions on arbitrary websites.

## Evidence, restart and updates

The worker stores schema-validated evidence in `webguide.sqlite` using prepared statements and transactions. Tables hold sessions, traces, run events and a one-time legacy-import marker. An existing validated `jobs.json` can be imported once; the original remains a recovery copy. It retains at most 50 jobs and limits snapshot size to 16 MB. Completed results survive process restart. Jobs interrupted by a restart are marked cancelled; they do not silently resume browser actions. Terminal results are checkpointed before the API can expose completion. Deletion is persisted before reporting success. A storage error disables new jobs and reports unhealthy persistence; repair storage before proceeding.

Keep the volume private: it contains website observations and generated guides. Encrypt the host disk or volume and backups using the hosting provider's facilities. Back up only while the service is stopped for a consistent operator-managed snapshot. Evidence is intentionally short-lived, not a durable audit archive. Expiration runs every 30 seconds. `docker compose down` keeps the named volume; `down -v` permanently deletes it and should not be used for routine updates.

Update using `docker compose -f deploy/backend/compose.yml up --build -d`, then verify authenticated health and run a fresh guide. Rotation means changing the private bearer secret, recreating the backend container and reconnecting the authorized app session. Do not share a single owner's token across unrelated users.

## Troubleshooting and acceptance

| Symptom                          | Check                                                                                                                                                                                        |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Startup rejects configuration    | Replace the placeholder token; supply exact allowed hosts/origins and a writable persistent directory.                                                                                       |
| HTTP 401                         | Bearer token is missing or differs from the backend secret. Re-enter the token in the connector.                                                                                             |
| HTTP 403                         | Match the actual frontend origin and incoming backend Host exactly, including non-default port. Check reverse-proxy Host preservation.                                                       |
| Worker connected, AI unavailable | Check authenticated health, endpoint URL/model alias/key and model logs. Anonymous health does not test the model.                                                                           |
| Chromium sandbox error           | Check supported Linux user namespaces and supplied seccomp profile. Keep non-root and sandbox protection enabled.                                                                            |
| HTTP 429                         | Wait for the one-minute request window. Avoid aggressive polling. Limits are service-wide for this single-owner deployment.                                                                  |
| Evidence storage unhealthy       | Check volume mount, disk space, ownership and permissions. Corrupt snapshots fail closed at startup; restore a known-good backup or deliberately archive the damaged file before restarting. |
| Job cancelled after restart      | Expected: interrupted browser sessions cannot resume safely. Start a new run.                                                                                                                |

Local verification commands from the project root:

```sh
npx tsc --noEmit -p tsconfig.worker.json
node --import tsx --test worker/hosted.test.ts worker/hosted-http.acceptance.ts
```

The acceptance test uses isolated backend port 4398 and a controlled fixture on 4319. It verifies bearer denial, exact Host/origin policy, pagination, private-address rejection, rate limiting, a real Chromium exploration, saved tutorials after restart and persisted deletion. It uses deterministic exploration; it does **not** prove remote model inference, TLS proxy configuration, Linux container runtime or a live cloud deployment. Those final environment checks must run on the selected host before announcing the service as live.

An additional `node scripts/hosted-ui-live-ai.mjs` check was run successfully against the actual local Qwen model and hosted-mode backend. It exercises the runtime URL/token connector, real model inference, a completed controlled-fixture exploration, and a partial read-only exploration of `evisionindia.com`, with generated guides visible in the UI. It also checks that changing the backend address clears credentials and connection state. This script requires the frontend on 4320, fixture on 4319, valid private model settings in `.env`, and free backend port 4398. It starts and stops only its isolated backend and browser; the model and fixture must already be running. Results go to `artifacts/hosted-ui-live-ai-report.json`. This remains local hosted-configuration evidence, not evidence of a deployed cloud service.

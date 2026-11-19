# Put the local model on your server

WebGuide AI can use a self-hosted model without a cloud API key. The application and browser worker can remain on your Windows computer while inference runs on your Linux server through an SSH tunnel. The browser never receives the model API key.

**Deployment status:** this is a prepared model-server deployment template, not a verified remote deployment. No server address or SSH access was supplied, and the local Docker daemon was unavailable. `docker compose -f deploy/compose.model.yml config --quiet` passed locally. The container's runtime behavior, resource limits, networking and permissions must be checked on the target host. This does not implement OS isolation for the Windows browser worker.

## Option A: authenticated llama.cpp model server

Use `deploy/compose.model.yml` with Docker Engine and Docker Compose v2 on a Linux host. It uses an official CPU server image pinned to the immutable multi-platform manifest digest `sha256:e3032ea0712da96dec820c770626385de4322dd06619fb5829256a504bbc9375`, resolved from GHCR on 14 November 2026. It supports Linux AMD64/ARM64/S390X according to that manifest. GPU acceleration is not enabled by this template; review the appropriate official CUDA image and driver requirements separately if needed.

Prepare this directory layout on the server (copy the existing downloaded model; do not commit it):

```text
webguide-ai/
  deploy/
    compose.model.yml
    secrets/llm-api-key
  local-runtime/models/Qwen3-4B-Q4_K_M.gguf
```

From the server's `webguide-ai/` directory, create the secret locally:

```bash
install -d -m 0700 deploy/secrets
umask 077
openssl rand -hex 32 > deploy/secrets/llm-api-key
# The parent directory is private; the container's non-root UID needs to read the mounted file.
chmod 0444 deploy/secrets/llm-api-key
chmod 0644 local-runtime/models/Qwen3-4B-Q4_K_M.gguf
docker compose -f deploy/compose.model.yml config --quiet
docker compose -f deploy/compose.model.yml up -d
docker compose -f deploy/compose.model.yml ps
```

Copy the key into your local worker `.env` using your secure administration channel. Never paste it into chat, commit it, or use a `VITE_` variable. The model key is distinct from `WEBGUIDE_WORKER_TOKEN`.

The container uses UID/GID 65532, a read-only root filesystem, a read-only model mount, a secret-file mount, temporary memory storage, dropped capabilities, no-new-privileges, one model slot, four CPUs, an 8 GiB memory limit and 128 processes. Its Docker network is marked internal and its published port binds **server loopback only**. There is no host `.env`, browser profile, Docker socket or host filesystem mount. Validate these controls on the target Docker installation; an internal network is not a substitute for auditing host firewall behavior.

Check that the unauthenticated inference API is rejected on the server:

```bash
curl --silent --output /dev/null --write-out '%{http_code}\n' http://127.0.0.1:11435/v1/models
# Expected: 401. /health is intentionally a public readiness endpoint on loopback.
docker compose -f deploy/compose.model.yml logs --tail 30
```

On your Windows computer, open an SSH tunnel and keep that terminal open:

```powershell
ssh -N -L 127.0.0.1:11435:127.0.0.1:11435 USER@YOUR_SERVER
```

Stop the local model process first if port 11435 is already occupied, or use a different **local** tunnel port and update the base URL. Do not stop unrelated processes. The model API port never needs public firewall exposure; only your normal protected SSH access is needed.

Configure the project-root `.env` on the computer running `npm run worker`:

```dotenv
WEBGUIDE_AI_PROVIDER=openai-compatible
WEBGUIDE_AI_BASE_URL=http://127.0.0.1:11435/v1
WEBGUIDE_AI_MODEL=webguide-qwen
WEBGUIDE_AI_API_KEY=replace-locally-with-the-server-model-key
```

Restart the worker. In Explorer, enter your existing worker access token, click **Check worker connection**, then **Verify AI connection**. Model-list availability and an actual inference are separate checks. Finally run an AI-planned controlled-fixture exploration and inspect its traces, tutorial and answer citations. A successful model ping alone is not product acceptance.

For a direct remote model connection instead of SSH, place the service behind an authenticated HTTPS reverse proxy and configure its `/v1` URL. The provider adapter rejects plain HTTP for non-loopback endpoints. Do not publish a bare unauthenticated model listener.

## Option B: existing Ollama server

If you already run Ollama on the worker host or reach it over a protected SSH tunnel, use its native API:

```dotenv
WEBGUIDE_AI_PROVIDER=ollama
WEBGUIDE_AI_BASE_URL=http://127.0.0.1:11434
WEBGUIDE_AI_MODEL=qwen3:4b
WEBGUIDE_AI_API_KEY=
```

Start Ollama bound to loopback and install that model with `ollama pull qwen3:4b`. Keep it off public interfaces. For a remote Ollama process, tunnel port 11434 exactly as above. Native Ollama requests use JSON-schema output constraints, disabled thinking, a bounded context and output length; the worker still validates every response and enforces its own action policy. This alternative was not the runtime used for the current llama.cpp verification.

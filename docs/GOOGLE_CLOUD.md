# WebGuide AI deployment preparation

Deployment is intentionally on hold until the owner chooses the hosting account, project and audience. No login, cloud provisioning or deployment was performed for this preparation. The container is portable; its path under `google-cloud` does not make it Cloud Run-specific.

## What this deploys

The container serves the React/TanStack application using the Nitro Node server. Browser voice controls use the visitor's browser speech APIs; they do not require the development Qwen server. Speech recognition availability, microphone permission and provider behavior vary by browser. A successful web deployment is not proof of actual microphone, audio-device or screen-reader acceptance.

The separate Playwright exploration worker is **not** bundled into this frontend container. A remote web page cannot use the developer's `127.0.0.1:4318` worker or local model. Do not expose the current single-owner worker token to all public visitors. The authenticated single-owner backend and model setup is described in [HOSTED_BACKEND.md](HOSTED_BACKEND.md). Once that service is hosted, the authorized operator enters its HTTPS origin and bearer token in Explorer's Backend URL and Worker access token fields, then chooses Check worker connection. No frontend rebuild is required. Changing the address clears the token; credentials remain in page memory only. Browser companion access to external pages is separate, user-activated, and subject to browser/site restrictions.

## Portable Node or Docker hosting

The installed Nitro integration honours `NITRO_PRESET=node-server`; no framework rewrite or generated-file edit is required.

PowerShell, from the repository root:

```powershell
$env:NITRO_PRESET = 'node-server'
npm ci
npm run build
$env:HOST = '0.0.0.0'
$env:PORT = '8080'
node .output/server/index.mjs
```

On Linux/macOS:

```sh
npm ci
NITRO_PRESET=node-server npm run build
HOST=0.0.0.0 PORT=8080 node .output/server/index.mjs
```

`deploy/google-cloud/Dockerfile` uses Node 24, installs locked dependencies in a build stage, builds the Node preset, and copies only `.output` to a non-root runtime. The runtime binds `0.0.0.0` and uses the platform-provided `PORT` (8080 by default). It contains no model or browser-worker credential. Use HTTPS on the hosting platform so microphone permissions can function.

```sh
docker build -f deploy/google-cloud/Dockerfile -t webguide-ai .
docker run --rm -p 8080:8080 -e PORT=8080 webguide-ai
```

The Dockerfile has selective COPY directives, but a normal local Docker build still sends its build context to the daemon. Use a sanitized checkout or the preparation helper below when the checkout contains private runtime files.

## Google Cloud Run option

Before any deployment, select the exact project ID and region; verify its billing and permissions. The preparatory inspection found a locally configured Google Cloud account/project, but access-token refresh required interactive reauthentication. This is not proof of usable deployment access. Cloud login is deliberately deferred.

When deployment is explicitly resumed, the owner can authenticate with `gcloud auth login` and inspect `gcloud projects describe PROJECT_ID`. Never paste access tokens, service account keys or application secrets into chat or source files.

The PowerShell deployment helper requires an explicit `-ProjectId`. It uses a fresh source staging directory, copies only frontend build inputs and scans them for local configured credential values. It omits `.env`, Git history, model downloads, screenshots, old packages and runtime data.

```powershell
# Preparation only; no network upload or cloud changes:
./deploy/google-cloud/prepare-source.ps1

# Only after choosing and authorising the cloud target and cost:
./deploy/google-cloud/deploy.ps1 -ProjectId YOUR_PROJECT_ID -Region asia-south1 -Initialize
```

The first deployment is private unless `-PublicAccess` is explicitly supplied. `-Initialize` enables Cloud Run, Cloud Build and Artifact Registry APIs, creates a Docker repository if absent, and creates a dedicated runtime service account with no application API/data roles. These operations can incur billing. Subsequent deployments can omit `-Initialize`. The caller/build identity still needs the corresponding service usage, Artifact Registry, Cloud Build, Cloud Run deployment and service-account actAs permissions; organisation policy can restrict public access. The script deliberately does not grant itself broad roles.

The Cloud Run service uses one vCPU, 512 MiB RAM, min instances 0, max instances 2, concurrency 40 and a 60-second request timeout. These are starting bounds for the frontend, not performance guarantees or a spending cap. Model inference/browser jobs need a separate capacity and security design.

The script builds in Cloud Build, tags an image in Artifact Registry, deploys it to Cloud Run, and prints the service URL and ready revision. It does not create a custom domain, public model endpoint or user authentication system.

## Railway or another container platform

Use the same Dockerfile and repository-root build context. Configure the Dockerfile path as `deploy/google-cloud/Dockerfile`, set the service's healthcheck path to `/`, and let the runtime receive the platform's `PORT`. Keep `HOST=0.0.0.0`. The Docker image already has its start command; no development server or `npm run dev` is needed in production.

For a Railway service, use dashboard Docker build settings or the currently supported Infrastructure as Code workflow after the project is chosen. Do not blindly add the old `railway.json`/`railway.toml` format: Railway's current documentation says new services cannot opt into that deprecated format. No Railway project, config apply, login or deployment was performed.

For any other platform, choose a persistent Node/container web service with HTTPS, environment variables and logs. Static-only hosting cannot run the produced Node SSR entry. The application can be adapted to a separate static architecture, but that is not what this Dockerfile builds.

## Acceptance after the owner resumes deployment

1. Confirm the deployed URL returns HTTP 200 over HTTPS and the title is WebGuide AI.
2. Test keyboard-only startup, skip links, focus order, visible focus and typed fallback.
3. With permission, test real microphone recognition and audible output on the intended browser/device. Browser-mocked tests are not hardware acceptance.
4. Test VoiceOver on the recipient's Mac and at least one Windows screen reader where available. Confirm app speech can be disabled to avoid double announcements.
5. Test browser companion permission/install behavior on the intended desktop browser. It is not a store-published extension or a Safari extension.
6. Confirm no localhost exploration backend is represented as connected on the public host. No keys should appear in bundled JS, HTML, storage or download artifacts.
7. Inspect Cloud Run/Railway logs without uploading microphone content or credentials. Keep the previous working image/revision for rollback.

## Verification performed

- Installed package declarations explicitly support `NITRO_PRESET` auto-detection.
- An isolated source snapshot built with `NITRO_PRESET=node-server` on 15 November 2026.
- Its production entry served HTTP 200 with the application title using `HOST=0.0.0.0` and a test `PORT`; the owned test process was stopped.
- Both PowerShell scripts parsed; the source staging helper ran and passed its private-data checks.
- Docker CLI was available, but the Docker Linux daemon was not running, so container startup was not verified.
- No cloud service, invoice, public URL or hosted AI inference is claimed.

References: [Cloud Run container contract](https://docs.cloud.google.com/run/docs/container-contract), [Cloud Run deployment](https://docs.cloud.google.com/run/docs/deploying), [gcloud run deploy flags](https://docs.cloud.google.com/sdk/gcloud/reference/run/deploy), [Railway configuration guidance](https://docs.railway.com/config-as-code).

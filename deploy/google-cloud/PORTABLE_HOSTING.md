# Portable hosting settings

Use the repository root as the build context and `deploy/google-cloud/Dockerfile` as the Dockerfile. The same Node container can run on Cloud Run, Railway or another HTTPS container web host.

- Production start command: inherited Docker CMD (`node .output/server/index.mjs`).
- Listen host: `0.0.0.0`.
- Port: platform `PORT`, default `8080`.
- Healthcheck path: `/` (frontend availability only, not AI verification).
- No runtime API/model secret needed for browser-native voice controls.
- The optional exploration worker and model service are not in this container.

If using Node hosting without Docker: install with `npm ci`, build with `NITRO_PRESET=node-server npm run build`, start `node .output/server/index.mjs`, and supply `HOST=0.0.0.0` and `PORT`.

For Railway, select the Dockerfile through service build settings after choosing the project. The old `railway.json`/`railway.toml` format is intentionally not generated because current official documentation deprecates it for new services. See `docs/GOOGLE_CLOUD.md` for current verification boundaries and deployment preparation.

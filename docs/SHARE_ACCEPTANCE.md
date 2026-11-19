# Share bundle acceptance — 14 November 2026

- TypeScript and production build passed after workspace integration.
- 25 unit/component tests passed, including 13 new workspace validation/form cases.
- Existing deterministic browser suite: 8 checks passed (exploration, persistence, navigation, evidence search, reset/repeat, cancellation, mobile).
- New real-browser acceptance passed: profile save/reload; no third-party builder branding text or builder links; saved website to Explorer; guide bookmarks/completion/filtering; preferences; downloaded backup; invalid backup rejection without mutation; confirmed restore; run search/filtering; mobile layout; no uncaught page errors.
- Desktop and 390px mobile profile screenshots inspected locally. Private test screenshots/backups excluded from distribution.
- Lint: no errors; six inherited Fast Refresh warnings in shared UI components.
- Prior real Qwen end-to-end checks and evisionindia.com read-only evidence are in REAL_AI_ACCEPTANCE.md and EVISION_READONLY_TUTORIAL.md. This feature pass did not expand external-site action permissions.

The ZIP is source code with setup instructions. Credentials, model/runtime downloads, node_modules, browser evidence and Git history are excluded. Local profile is not a cloud account. Remote deployment, authenticated external workflows and production isolation remain outside the implemented scope.

- Extracted source ZIP verification: fresh `npm ci --ignore-scripts`, TypeScript, all 25 tests and production build passed. Installation audit still reports 7 moderate dependency advisories; no forced dependency changes applied.
- Final real-Qwen browser verification passed again: actual inference, AI fixture exploration/tutorial generation, grounded Q&A and unknown-feature refusal. Fixed Ask button availability so Q&A waits for active exploration/inference to finish instead of racing the worker concurrency gate.

## FAQ and usability update

- Added 16 searchable FAQs covering setup, AI troubleshooting, website limitations, tutorials, profile and data, with topic filters and relevant-screen shortcuts.
- Added a direct mobile section selector and fixed stale run filtering when reopening Tutorials.
- FAQ browser checks passed: search, topic filtering, no-results recovery, section links, keyboard expansion, 390px overflow and zero page exceptions. Existing workspace and autonomous-demo browser suites passed again; 25 unit/component tests passed.
- The recreated archive includes a verified SHA256 file manifest and START_HERE.md. Secrets and private runtime/test data remain excluded.

## Distribution naming check

- Distribution filename and root folder are both lowercase `webguide-ai`.
- npm package and lockfile metadata use `webguide-ai`; deployment configuration fixes the worker name to `webguide-ai` instead of deriving it from the checkout or remote repository.
- Every packaged filename and file content is scanned for legacy personal branding, and source files are checked against locally configured credential values. The archive includes verified per-file SHA256 hashes.
- TypeScript, 25 unit/component tests and production build passed for this naming update.

# WebGuide AI 1.1.0 acceptance record

Updated 15 November 2026. This record supersedes older readiness summaries for changed features. Full app/backend cloud deployment remains held. The public site is a download distribution, not hosted inference.

| Check | Result | Scope and evidence |
| --- | --- | --- |
| React/component regressions | 78 passed | Includes explicit no-capture before consent, speech cancellation/fallback, keyboard focus and storage migration |
| Worker suite | 28 passed | Real isolated Chromium fixture, real SQLite HTTP restarts, provider contracts and security policy; mocked provider cases are labelled |
| Launcher/extension background/runtime suites | 26 passed | Connection handoff, reuse, locks, runtime checksum/resume and background lifecycle |
| Typecheck and production build | Passed | Current source; build is not a deployment |
| ESLint | 0 errors, 8 warnings | Existing React refresh component/export warnings; generated bundles and extracted copies excluded |
| Dependency audit | 0 known vulnerabilities | Full dependency audit at recorded time; not a penetration-test certificate |
| Dashboard accessibility and keyboard | Passed bounded checks | Eleven sections axe clean, direct Start skip link, heading focus, saved-site create/reload/remove, 320/390px reflow and reduced motion |
| Actual model in app | Passed supported request | Latest source UI and isolated SQLite worker with real local Qwen; profile target grounded and private draft excluded |
| Actual extension relay | Passed | Real extension service worker and real inference; temporary test manifest grants loopback origin, so native permission prompt is not proven |
| Native Chrome toolbar | Passed | Loaded version 1.1.0 in desktop Chrome, clicked real toolbar icon, opened popup and used its button to open page companion; native-toolbar.json |
| External Evision India exploration | Partial as expected | Ten read-only inspect traces, budget reached; no external mutation or universal workflow claim |
| AI sandbox exploration | Bounded success | Live model verified one fill then stopped; does not prove task creation. Deterministic integration separately verifies fixture creation |
| AI tutorial robustness | Fixed and tested | Unknown model citations are rejected; verified traces remain available through explicitly Template-generated fallback |
| Archive security | Passed regression | Private databases/sidecars, jobs.json and secrets excluded; selected submission PDFs included |
| Fresh extracted Windows launcher | Passed with cached downloads | Actual BAT installed new dependencies/config/database, real Qwen warm-up and 8 browser checks; second BAT reused its owner. Verified downloadable runtime caches reused; not a clean download or Mac test. See launcher-smoke.json |
| Physical Mac and VoiceOver | NOT VERIFIED | No recipient Mac was available |
| Revised-flow blind-user acceptance | NOT VERIFIED | User's negative feedback prompted this revision; no successful independent re-test invented |
| Real microphone and audible screen reader on this revision | NOT VERIFIED | Synthetic lifecycle/AX tests do not prove actual speech recognition or heard output |

## What changed after the reported accessibility failure

- Page reading/navigation needs explicit permission. App, extension and widget default to no page-reading grant.
- AI context sharing is a separate single-request consent. Stop/Escape and section or URL changes revoke applicable grants.
- Start voice is first and directly reachable from the skip link. Advanced controls are collapsed. Screen-reader mode prevents duplicate output channels.
- A stalled speech start is cancelled after four seconds with an accessible fallback. A device that cannot speak does not count as a successful audio test.
- Optional dashboard milestones use actual records and remain hidden by default. No mandatory game or fabricated scores.
- Real SQLite stores worker runs/traces/events. Browser profile and bookmarks remain in browser storage.
- New setup uses WEBGUIDE configuration and source names. Legacy import compatibility preserves existing user data.

## Evidence interpretation

Sanitized evidence is bundled under submission/evidence. Stage 4 retains four actual local-model responses, including two fixture-contract failures, alongside Codex-session answers. The comparison is small and nonblind; it cannot establish general accuracy or relative speed.

The latest live integration uses current source and a fresh SQLite store, with the already downloaded managed Qwen runtime. It is not described as a clean-install test. Earlier Windows fresh-folder bootstrap evidence is historical and does not establish a Mac result. Native toolbar opening is independently recorded from the automated extension relay test.

The source archive manifest verifies file bytes. It does not prove universal accessibility, every website's compatibility, future security or production readiness. Retest the recipient's actual keyboard, microphone, screen reader and task before claiming independent usability.

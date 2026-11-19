# Acceptance evidence — 14 November 2026

| Requirement                           | Actual result                                                                                                       |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Baseline reproduction                 | Original typecheck/build passed; reported guideflow error not reproduced. Home page was blank.                      |
| Final typecheck / production build    | PASS                                                                                                                |
| Focused frontend tests                | 12 passed (11 foundation plus routing)                                                                              |
| Worker security tests                 | 5 passed                                                                                                            |
| Real Chromium worker integration      | PASS: separately hosted 4319 fixture, task outcome, tutorial, authentication, absent AI, cancel, repeat job, delete |
| Browser UI acceptance                 | PASS 9 checks; 10 traces / 10 tutorials; completed                                                                  |
| Dashboard-to-worker UI                | PASS: readiness, token authentication, actual fixture guide, unsupported question, no token persisted               |
| Label changes / missing target        | Unit tests PASS; actual observed labels populate guide steps; missing target reported partial                       |
| Failed-action verification            | PASS; unchanged outcome and unrelated status ticker do not verify action                                            |
| Cancellation                          | Unit + real browser PASS; no subsequent action after cancel                                                         |
| Reset, repeat, refresh                | Browser PASS; saved records match before/after reload; reset marks guides stale                                     |
| Disconnected worker                   | Start disabled; API errors cannot create fake success                                                               |
| Real AI provider                      | PASS: actual Qwen3-4B via llama.cpp; 7 live-AI scenarios and real dashboard-to-AI flow                              |
| Missing AI                            | API 503 and UI AI not configured verified                                                                           |
| Grounded Q&A                          | Unknown/delete/publish requests cannot reuse Create task evidence                                                   |
| Unsafe actions / prompt injection     | Schema and backend policy tests PASS; webpage instructions cannot grant mutation privileges                         |
| SSRF                                  | Private/reserved/mapped IPv6/metadata, different origins, credential/scheme rejection; real redirect guard tested   |
| Cross-user resources                  | Not applicable: single-user token-protected loopback service; wrong/no token denied                                 |
| Visual / runtime                      | Desktop 1440px and mobile 390px screenshots inspected; no horizontal page overflow or uncaught browser errors       |
| Lint                                  | Zero errors; 6 inherited fast-refresh warnings                                                                      |
| Dependency audit                      | 7 moderate development-chain findings; 0 high/critical after targeted fixes                                         |
| Host isolation                        | Partial: Chromium sandbox + fresh context + minimal environment + pinned network; no OS quotas/firewall             |
| Authenticated sites / arbitrary sites | Unsupported protected sessions; external public read-only inspection only                                           |
| Public deployment                     | Not performed                                                                                                       |

Browser check code: `scripts/e2e.mjs`, `scripts/worker-ui.mjs`.
Generated synthetic local artifacts: `artifacts/e2e-report.json`, `artifacts/overview.png`, `artifacts/mobile.png`, `artifacts/worker-exploration.png` (git-ignored).
No mocked AI test or deterministic planner is evidence of real AI success. The worker's tutorial title is constrained to observed labels even when AI synthesis is configured.

## Local AI follow-up

- Local Qwen3-4B Q4_K_M inference, schema-validated planning, sandbox actions, result verification, tutorial synthesis and cited Q&A passed. No cloud API key was used.
- Seven live-AI scenarios passed, including renamed labels, broken action, hostile page instructions, read-only policy and the authorised evisionindia.com homepage.
- evisionindia.com: 21 visible controls, 10 verified inspection steps, 1 tutorial; source run PARTIAL because of the 10-action budget. No forms/messages/subscriptions were submitted.
- 13 focused worker/provider/observation/security test results passed; one separate real worker integration also passed (14 total when combined). Mock HTTP provider tests are explicitly separate from live Qwen tests.
- Navy/blue/white desktop and mobile UI verified.
- [Full real AI evidence](REAL_AI_ACCEPTANCE.md) and [actual generated site guide](EVISION_READONLY_TUTORIAL.md).
- Server model Compose syntax validated. Remote container runtime and browser-worker OS isolation remain unverified.

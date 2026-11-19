# Fresh-package acceptance — 15–16 November 2026

## Test provenance

Downloaded the published `webguide-ai.zip` into a new acceptance directory and extracted it. Original download SHA-256: `972fc2860c6636ca261aad68f8639e58ebe78fa3bcb0b8f828b0045731a4d2f4`.

The Windows BAT launcher downloaded its own portable Node runtime and installed locked dependencies. No old `.env`, database, node_modules, browser or model cache was copied into this directory. Defects found during testing were patched in both source and the extracted candidate; this is a patched-candidate test, not a claim that the original download already contained these fixes.

## Fixes found during acceptance

- Basic workspace now opens after dependency installation; AI setup continues with explicit progress in the launcher. The connected tab opens only after model verification. Slow first-run AI downloads no longer hide all local voice/keyboard controls.
- Browser dependency installation shows elapsed time and available download progress, with a longer bounded installation timeout.
- App startup probing allows a bounded 15 seconds for the initial rendered response under memory pressure; other service probes keep their shorter timeout.
- Guidance status remains visible on every workspace section when advanced options are collapsed.
- Page-reading permission has one complete accessible label instead of duplicate screen-reader text.
- The microphone's accessible name now includes the visible “Listen” label, matching spoken instructions.
- Worker cancellation now also terminates its job-owned browser server during startup/connect, and checks cancellation before launch and after asynchronous setup boundaries.
- Fresh Windows installation exposed a persistent `EPERM` when renaming the extracted runtime directory. The installer now extracts the checksum-verified archive into its versioned destination and writes readiness only after successful extraction and executable validation; an interrupted install is re-extracted before execution. Cached-archive verification has explicit feedback and uses bounded 1 MiB read buffers.

- Spoken/displayed AI guidance uses visible labels instead of internal control IDs; structured target identities remain intact.
- Windows browser cleanup verifies that the job-owned process has exited before releasing a terminal status; delayed RPC cleanup no longer leaves completed jobs running. Sandbox action policy remains restricted to the original controlled fixture.

## Verified in this acceptance run

| Check | Result |
|---|---|
| Fresh package unit regressions | 78 passed |
| Worker/SQLite/security regressions after cancellation fix | 30 passed |
| Launcher/runtime/extension helper tests | 27 passed |
| TypeScript checks | Passed |
| Production build | Passed |
| Automated accessibility, 11 workspace sections | No axe violations in the tested rules |
| Narrow layouts, four key sections at 320 and 390 pixels | No horizontal overflow |
| Keyboard skip link | Focus reaches Start voice guide |
| Typed `open profile` | Profile opens |
| Page reading before consent | Blocked with explanatory status |
| Escape | Revokes consent, microphone off, stable stopped feedback |
| Screen-reader mode semantics | Pressed state and polite live status verified |
| ZIP privacy filter | Eight private artifact cases rejected; three public source cases preserved |
| Simulated speech lifecycle | Hindi commands, confirmation/cancel, sensitive fields, speech failure and denied microphone fallbacks passed |
| Lint of changed implementation and scripts | Passed |
| Fresh companion synthetic-page regression | Consent, privacy, confirmed actions, stale targets, stop and mobile dock passed |
| Fresh extension action popup | Programmatically opened; width/zoom checks and safe missing-activeTab error passed. Physical toolbar grant not retested. |

Initial worker run had a cancellation assertion failure and an observation timeout. The subsequent run used the independently downloaded browser, the cancellation fix and serial test-file execution; all 30 tests passed. Later reruns exposed a delayed Windows RPC cleanup and a rejected alternate test-port attempt. The alternate port was reverted, OS process exit is now verified, and the final full worker run passed 30/30 with the app stopped. The initial failures are not hidden by the later results.

## Human/device evidence and limits

- Windows Narrator was started; the user confirmed audible output and that they stopped it. This proves Narrator startup audio, not the entire WebGuide flow with Narrator.
- Native Chrome displayed WebGuide's Speaking state. The user confirmed that the introduction was immediately clear and audible.
- Native Chrome displayed Listening and later Microphone off after Escape. No audio file was saved. The user chose typed testing instead of speaking the requested task command, so successful recognition of `open profile` through a real microphone remains unverified.
- Typed-command and ARIA tests are not substitutes for a blind user's task-completion study. Full Narrator task acceptance and physical Mac/VoiceOver/microphone acceptance remain unverified.
- No claim of universal website compatibility, zero security risk or 100% blind usability is made.

## Full AI first-run acceptance

The fresh BAT launcher completed its independent Node, browser, Ollama and Qwen3 4B setup. It verified a real model warm-up response, started the loopback worker/fixture/app and opened the one-use connected workspace.

Eight application checks passed: automatic launcher-module connection, nonce removal/no token persistence/no automatic microphone, profile save, FAQ search, saved-site create/edit/cancel/remove, explicit practice-widget activation, actual Qwen guidance naming the visible Save profile control, and profile persistence after reload. See `submission/evidence/fresh-ai-workflow.json`.

The fresh extension also returned real model guidance for the practice page and preserved its session connection through service-worker stop/restart. The disposable fixture manifest explicitly granted loopback host permission; this does not certify a physical toolbar click or permission-prompt acceptance. See `submission/evidence/fresh-extension-ai.json`.

A second launcher invocation verified existing services without starting another server or model. Sending `q` to the owning launcher closed ports 4318, 4319, 4320 and 11436. A normal BAT restart reused this installation's own downloaded cache without another download, verified a new real model response and reopened the connected app. The test machine had about 1 GB free RAM during part of the run, so startup timing is not a performance guarantee.

Raw local logs and screenshots are in `artifacts/fresh-acceptance-20261115/`. They are excluded from the distributable by default. Sanitized evidence is in `submission/evidence/fresh-keyboard.json`, `fresh-accessibility.json`, `fresh-simulated-speech.json` and `fresh-profile-stopped.png`.

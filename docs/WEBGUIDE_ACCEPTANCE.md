# WebGuide AI acceptance record

15 November 2026. The app and AI backend are not deployed. The separately published download page distributes the extension and source package only. This is a bounded verification record, not accessibility or production certification.

## Delivered

- Compact voice panel and three home choices; settings, transcript, command help and setup detail expand on demand.
- English/Hindi commands; optional bounded conversation with microphone paused during speech; typed and keyboard fallbacks.
- Next/previous/first/last navigation for controls, headings, links, forms, fields and landmarks. Ordinary-input caret movement, selection and insertion. Confirmed clicks and dropdown selection; private fields protected.
- Stop/Escape persistently disable WebGuide spoken guidance, abort microphone capture, clear pending actions/timers and invalidate stale callbacks. Explicit Start voice guide or Enable is needed to resume speech. Independently running screen readers have their own stop commands.
- Chrome/Edge browser companion with active-tab permission, matching navigation and Stop behavior. No universal-site compatibility claim.
- Authenticated single-owner backend: exact Host/CORS, bounded persisted evidence, restart recovery, retention, pagination, sandboxed browser, self-hosted model configuration and portable container assets.
- Explicit runtime backend connector. HTTPS remote or HTTP loopback only; session-memory token, no automatic requests; endpoint changes clear credentials and old results.
- Profile, saved websites, tutorial bookmarks/progress, FAQs, history and backup workflows retained.

## Results

| Check                     | Observed result                                                                                                                                                                                                                                                                          |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript and UI lint    | Passed                                                                                                                                                                                                                                                                                   |
| Unit/component tests      | 60 passed, including voice, backend connector and current-page guidance tests                                                                                                                                                                                                            |
| Worker regression         | 22 passed with isolated browser integration, guidance and provider-contract tests                                                                                                                                                                                                        |
| Hosted backend acceptance | 3 passed: real Chromium, authorization/CORS/Host, persistence and deletion after restart, limits and SSRF checks                                                                                                                                                                         |
| Local real Qwen           | All 7 checks passed: inference, observed workflow/tutorial/answer, renamed controls, no-op outcome, injection policy, read-only policy and Evision read-only exploration                                                                                                                 |
| Hosted-mode real-model UI | 5 passed: explicit connector/auth, actual Qwen inference, completed practice guide, partial Evision read-only guide and clearing credentials after URL change                                                                                                                            |
| Voice UI                  | Real DOM pipeline and synthetic speech callbacks passed, including Stop during multi-chunk speech and stale callbacks after Stop                                                                                                                                                         |
| Native Chrome speech Stop | Real speech engine started; Stop cancelled playback and queued speech; remained silent through repeated checks; Read after Stop did not re-enable speech. No mocked synthesis                                                                                                            |
| Real microphone           | Actual default Intel Smart Sound microphone array captured live 48 kHz audio with non-zero RMS. The instrumented native recognition attempt returned no-speech. User reported performing the spoken test, but a successful recognized phrase was not independently captured              |
| Actual NVDA               | Signed portable NVDA 2026.3.1 ran against Chrome. Speech log confirmed app headings/levels, main landmark, button names and form labels. Test NVDA was stopped after its independent speech caused confusion with the app Stop button. This does not establish full blind-user usability |
| Automated accessibility   | No selected axe WCAG A/AA violations on all 11 sections in the audited empty-state fixture                                                                                                                                                                                               |
| Existing workflows        | Browser demo, persistence/reset/cancel, profile, saved websites, guides/progress, backups and FAQ regressions passed                                                                                                                                                                     |
| Companion                 | Controlled content-script tests, native MV3 registration, stale-callback Stop regression and Evision read-only test passed                                                                                                                                                               |
| Production                | Portable Node build and production smoke checked separately. No container runtime or cloud deployment implied                                                                                                                                                                            |

The real-model Evision result is partial because discovery is intentionally bounded. No external forms, messages or transactions were submitted. Test evidence is stored locally under artifacts and omitted from the source ZIP. Raw screen-reader logs are excluded because they can contain other visible desktop text.

## Remaining environment and usability boundaries

- Instrumented recognition of human English/Hindi speech, pronunciation and noise/headset behavior need a successful target-device session. A working audio stream is not speech-recognition accuracy.
- Mac VoiceOver, the recipient's Mac hardware, and acceptance by blind users remain unverified. Automated axe and NVDA announcement checks do not replace these.
- Browser speech recognition uses its system/browser default microphone. The device selector tests other microphones but cannot promise arbitrary-device speech routing. Browser speech processing may use an online service even though Qwen is self-hosted.
- A web page cannot move the global operating-system mouse pointer. The implemented navigation moves document focus, scroll position and ordinary-field caret. Restricted pages, inaccessible canvas/custom controls, cross-origin frames and CAPTCHA can prevent access.
- Hosted mode was exercised locally against actual Qwen. Docker engine was unavailable; Linux container sandbox/TLS/proxy/volume behavior still needs validation on the eventual host. Nothing is deployed.
- Backend tokens are single-owner; do not expose it as a multi-user product without individual accounts and per-user authorization. Model service hosting is separate.

See START_HERE.md and docs/HOSTED_BACKEND.md for operation and troubleshooting.

## G01-G12 release verification

- Shared current-page context service is used by app, embedded widget and extension; authenticated guidance uses the existing self-hosted Qwen provider. Real app and widget requests passed, including private draft exclusion and stale-goal clearing. An origin URL double-slash defect found in the app test was corrected.
- Controlled widget workflow verified explicit activation, page-sharing consent, repeat, action confirmation, observed service-details and synthetic request receipts, stale-context rejection and Stop consent clearing. Only the clearly marked local demo form was submitted.
- Home and companion were redesigned with compact controls and expandable detail. Direct website links and the embedded practice launch passed. Selected axe checks reported no violations on 11 sections and expanded mobile controls; this is not a usability certification.
- Native MV3 registration and programmatic action popup were observed. Popup correctly reports missing active-tab activation. Actual OS toolbar activation could not be completed because the desktop helper rejected the Chrome window identifier after two attempts; toolbar-click-to-injection remains NOT VERIFIED. Controlled content-script and external Evision read-only checks are separate evidence.
- Backend review checked consent binding, private/hidden descriptions, response bounds, stale requests, unrelated goals and unsupported context. Guidance never authorizes model-driven clicks or declares task completion.
- Goal relevance matching is conservative and can reject valid synonyms or cross-language goals. Unsupported structures and inaccessible controls remain bounded by the documented limits.

Reproducible checks: `node scripts/app-guidance-live.mjs`, `node scripts/widget-ui.mjs --live`, `node scripts/guidance-live-ai.mjs`, and companion tests documented in browser-extension/README.md. Live checks require the configured local worker/model. Do not replace these results with sample-report evidence.

A semantic answer review found form-button labels were missing from page context, allowing an unrelated demo button suggestion. Accessible-name extraction was corrected, the demo shortcut was limited to Explorer, and a real-model regression now requires the actual Save profile target and rejects the unrelated recommendation. The final observed answer named Display name and Save profile correctly. This bounded check does not guarantee all generated advice is correct.

The final backend also rejects an explicit workflow when its required named action is missing, and rejects unrelated button targets or recommendations. Informational explanations remain supported. The guarded real-profile browser test passed after worker restart.

## Final extension verification — 15 November 2026

- A manually installed extension was pinned in native desktop Chrome; clicking its actual toolbar icon and Open companion displayed the dock on evisionindia.com. This supersedes the earlier unverified toolbar result above.
- Fixed native popup clipping; real action-popup layout passed collapsed, expanded and 125% CSS zoom checks.
- Fixed first-connection loss when a permission prompt closes the popup using a background pending record; fixed POST Origin rejection using an exact stable extension-origin allowlist.
- Real Chromium extension relay passed 7 checks: pending permission-state survives popup closure, authenticated connection, actual Qwen service-hours answer, private field omission, Stop, actual MV3 worker stop/recovery, and single dock after reinjection. Loopback host permission was granted in the temporary test manifest. This is not a native permission-prompt test.
- Connections now use protected extension session storage and survive MV3 suspension. Tokens clear after browser session end, tab closure, disconnect or permission removal.
- The final physical permission-prompt retest could not finish because the desktop UI tool could not identify the current browser URL. No claim is made that the recipient's Mac or all sites have passed.

Final Node-preset production rebuild and smoke passed: HTTP 200, application hydration, shared guidance core, no automatic localhost/backend requests, and current extension ZIP download. The default build targets Cloudflare; use NITRO_PRESET=node-server for Node hosting.

Background protocol regression also passed: permission-arrival continuation after popup/worker loss, trusted session access, no status-token disclosure, sender and context-origin rejection, and revoked-permission cleanup.

Latest serialized regression: 63 app unit/component tests and 23 worker tests passed; full app/worker typecheck passed. Voice/workspace/FAQ browser regressions and axe scans across all 11 sections passed.

## Fresh-download verification — release 1.0.3

See [the fresh-install record](LOCAL_RELEASE_1_0_3.md). A separately extracted Windows package downloaded private runtimes, dependencies, Chromium and Qwen with old services stopped. Its actual launcher verified inference and opened an automatically connected app. Fresh typecheck/build, 68 app tests, 23 backend tests, eight browser workflows and seven real-model extension relay checks passed. Second-launch reconnect, owned-service shutdown and cached restart passed. Native browser follow-up was limited by a Windows Firewall dialog; physical Mac and microphone are not implied.

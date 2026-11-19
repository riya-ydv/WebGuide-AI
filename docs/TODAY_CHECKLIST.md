# WebGuide AI — final cross-check

15 November 2026. Checked the current workspace after the extension fixes. This checklist distinguishes rerun checks from earlier evidence. It is not a universal accessibility, deployment or blind-user acceptance certificate.

## Latest regression results

| Check                          | Result                                                                                                                                                                                                           |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| App and worker TypeScript      | PASS — `npm run typecheck`                                                                                                                                                                                       |
| Unit/component suite           | PASS — 63 tests across 7 files, `npm test -- --maxWorkers=1`                                                                                                                                                     |
| Voice and keyboard UI          | PASS — real page controls, simulated speech APIs, confirmation, private-field exclusions, Hindi commands, 320px reflow; `scripts/voice-ui.mjs`                                                                   |
| Profile and existing workflows | PASS — save/reload, saved website navigation, tutorial bookmarks/completion, preferences, download, invalid import protection, confirmed restore, run-history filters, mobile layout; `scripts/workspace-ui.mjs` |
| FAQs                           | PASS — search, topics, empty state, navigation, keyboard expansion, mobile overflow; `scripts/faq-ui.mjs`                                                                                                        |
| Automated accessibility        | PASS — zero selected axe violations across all 11 sections; `scripts/accessibility-audit.mjs`, `artifacts/webguide-axe.json`                                                                                     |
| Native speech Stop             | Earlier same-day native Chrome evidence confirms real synthesis cancelled and remained silent, including Read after Stop; `artifacts/native-voice-stop.json`. Not rerun during this final sweep.                 |
| Worker regression              | Final owner rerun: 23 tests passed, including isolated real Chromium; `npm run test:worker`.                                                                                                                     |
| Extension background protocol  | Final owner rerun passed mocked pending permission continuation, trusted storage, status-token privacy and revocation cleanup; `scripts/extension-background.test.mjs`.                                          |
| Extension and production       | Separate final owner checks: actual toolbar opened Evision dock; extension relay 7 checks and Node production smoke passed. See `WEBGUIDE_ACCEPTANCE.md` for exact scope and permission-prompt limitation.       |

The first unrestricted parallel unit run failed before assertions because Windows could not allocate worker processes. The complete single-worker rerun passed; this was not counted as a successful first run. Browser suites then ran sequentially. No Qwen inference or physical microphone recognition was claimed by this regression sweep.

## Supplied G01–G12 mapping

Numbering follows the supplied Stage 2 gaps, not a newly invented feature list. Full mapping: `GAP_TO_FEATURE_MAPPING.md`.

| ID and supplied gap                           | Implemented response and evidence                                                                                                                                                        | Remaining boundary                                                                                                       |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| G01: Separate access methods                  | App, widget and extension share page-assistance capture/client and authenticated guidance service. Final extension relay and earlier live app/widget results are recorded in acceptance. | Single-owner backend; separate supported launch methods remain.                                                          |
| G02: Lack of current-page context             | Bounded visible labels, headings, text and revision accompany the actual goal. Guidance regressions passed in current unit suite.                                                        | Supported DOM only; no access to every frame or canvas.                                                                  |
| G03: Unsafe or uncontrolled actions           | Model output is guidance, never an executable action. App click/select require confirmation; voice-policy and browser confirmation checks passed.                                        | Ordinary safe-field typing is an explicit user command, not model automation; external actions still need user judgment. |
| G04: Unexpected page changes                  | Changed page/goal/session invalidates pending guidance and targets. Stop ignores late callbacks; current unit regressions passed.                                                        | Request fresh guidance after relevant changes.                                                                           |
| G05: Difficulty understanding controls        | Explain-field guidance uses current accessible label, role, requirements and supplied errors. Current guidance tests plus prior real-model evidence.                                     | Missing descriptions cannot be reconstructed reliably.                                                                   |
| G06: Need for adjustable instructions         | Repeat/simplify, speech rate, language and text fallback implemented; current voice/guidance tests passed.                                                                               | Browser voice availability varies; simplification requires connected AI.                                                 |
| G07: Description not connected to next action | Ordered steps reference validated context IDs and offer focus; final guidance tests passed.                                                                                              | Focus does not mean click, submission or success.                                                                        |
| G08: Language preferences                     | English/Hindi commands and guidance selection, typed fallback; current Hindi parser/UI checks passed.                                                                                    | Successful human speech recognition and pronunciation are not verified on recipient hardware.                            |
| G09: Unverified completion                    | Attempt and visible outcome remain separate. Prior controlled receipt/no-op evidence recorded in acceptance.                                                                             | A generic click or model answer never proves completion.                                                                 |
| G10: Differences between websites             | Native headings, links and form controls supported. Current app workflows passed; root observed actual Evision toolbar/dock activation.                                                  | Selected-page evidence only, not all-site compatibility.                                                                 |
| G11: Form-field-level difficulties            | Label-based focus, safe text entry, caret/selection, confirmed dropdown choice; private fields excluded. Current unit/voice UI tests passed.                                             | Custom controls, secrets and unsupported input types require native/manual assistance.                                   |
| G12: Limited accessibility information        | Invalid/stale/insufficient context is rejected; no invented target execution. Guidance and privacy tests passed.                                                                         | Cannot repair inaccessible websites or guarantee every model explanation is correct.                                     |

## Today’s requested product checks

- **Name and branding:** WebGuide AI visible branding retained. Workspace browser suite checks absence of “third-party builder branding”. Legacy project identifiers in internal files are not presented as product branding.
- **Less text-heavy design:** compact navy/teal voice home, decorative assistant illustration, explicit Start/Listen/Stop and goal input; advanced options expand on demand. Earlier same-day 320px closed/expanded audit had no horizontal overflow or selected axe violations; current voice/workspace mobile regressions also pass.
- **Profile, saved websites, guides, history, FAQs and backup:** rerun successfully as listed above.
- **Stop repetition:** persistent mute and late-callback cancellation are covered by current automated tests and earlier native synthesis evidence. An independently running screen reader has its own stop command.
- **Privacy:** no autoplay; explicit microphone activation, private-field filtering, memory-only app connector, bounded page-sharing context. Browser speech services may process audio online. Extension session credentials use the separately reviewed session-storage design.
- **Packaging:** source/extension ZIP creation, archive contents and public download are the release owner's final gate. This checklist reports workspace behavior and does not assert that an uninspected archive is identical.

## Still not verified or intentionally limited

- Recipient’s Mac, VoiceOver, physical headset/default-mic routing, successful English/Hindi recognition in real noise, and acceptance testing by blind users remain unverified.
- Native browser speech recognition uses the browser/system microphone; the input selector only tests capture devices. No operating-system mouse-pointer control is implemented.
- The final physical extension permission-prompt retest was incomplete; programmatic relay/persistence tests and actual toolbar activation are separate evidence.
- App/model cloud deployment is not established by a working download page or local production smoke. Container runtime, production TLS/volumes and multi-user authorization require their own acceptance.
- Current implementation uses self-hosted Qwen, Node HTTP and bounded JSON evidence storage, not the proposal’s Gemini/Express/SQLite stack.

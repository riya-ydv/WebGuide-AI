# 6.7 Gap-to-Feature Mapping

The project features are compared with the potential gaps identified in Stage 2. The gaps below come from the supplied project proposal; they are not new comparative claims about NVDA, Be My Eyes or ChatGPT Voice. Implementation and testing determine how far each proposed response is supported.

| Gap identified in Stage 2                     | Corresponding planned feature                  |
| --------------------------------------------- | ---------------------------------------------- |
| G01: Separate access methods                  | Shared service for widget and extension        |
| G02: Lack of current-page context             | Context-based guidance                         |
| G03: Unsafe or uncontrolled actions           | Permission-controlled assistance               |
| G04: Unexpected page changes                  | Context refresh and error handling             |
| G05: Difficulty understanding controls        | Plain-language explanations                    |
| G06: Need for adjustable instructions         | Repeat and simplify options                    |
| G07: Description not connected to next action | Step-by-step guidance                          |
| G08: Language preferences                     | Supported language selection                   |
| G09: Unverified completion                    | Evidence-based task status                     |
| G10: Differences between websites             | Support for selected website structures        |
| G11: Form-field-level difficulties            | Guidance for supported form controls           |
| G12: Limited accessibility information        | Detect insufficient context and avoid guessing |

## Implementation and evidence

The current build implements these responses within a controlled prototype scope. A supported result means the named behavior was demonstrated; it does not mean that every website, language, assistive technology or user task is supported.

| Gap | Implemented response                                                                                                         | Evidence to check                                                          | Limit                                                                                    |
| --- | ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| G01 | Shared page-assistance core, embedded widget and extension call the same authenticated guidance service.                     | shared/page-assistance.js; worker/guidance.ts; widget and extension tests. | Single-owner backend; not a public multi-user deployment.                                |
| G02 | Bounded visible page text, headings, labelled controls and a snapshot revision accompany the goal.                           | Capture tests and real-model current-page guidance test.                   | Only information exposed by supported DOM structures is available.                       |
| G03 | Read/focus actions remain separate from confirmed click/fill/select actions. Model guidance cannot directly execute actions. | Existing policy tests and confirmation/cancel browser tests.               | Confirmation is not proof that an external website is trustworthy.                       |
| G04 | Refresh page context and reject stale guidance/targets after navigation or relevant changes.                                 | Page-mutation and stale-response tests.                                    | A changed page can require another request.                                              |
| G05 | Explain labelled controls using their role, required state, instructions and visible error.                                  | Explain-field tests on the practice website.                               | Missing names or descriptions are reported, not invented.                                |
| G06 | Repeat the prior instruction; request a shorter explanation.                                                                 | Repeat/simplify tests, including real model output.                        | Language and speech availability depend on model and browser.                            |
| G07 | Short ordered guidance steps reference current control IDs; focus the indicated control before acting.                       | Step-target validation and supported practice tasks.                       | No unrestricted autonomous browsing or guaranteed completion.                            |
| G08 | English/Hindi guidance and browser speech settings; unavailable speech falls back to text.                                   | Hindi output validation and voice failure tests.                           | No claim of every language, accent or offline recognition.                               |
| G09 | Distinguish an attempted action from a visible result signal; unsupported outcomes remain unverified.                        | Controlled receipt check; no-op and stale-result tests.                    | A generic click or model statement is never sufficient evidence.                         |
| G10 | Test standard headings, links and native form controls on selected pages.                                                    | Controlled service site and authorised Evision read-only regression.       | Restricted browser pages, inaccessible canvas and cross-origin frames are outside scope. |
| G11 | Read label, type, required state, supporting description and validation feedback; protect private fields.                    | Native input/select/textarea and private-field tests.                      | Unsupported custom controls require the user's screen reader or manual input.            |
| G12 | Return insufficient-context when evidence is empty, invalid, stale or lacks usable targets.                                  | Empty-context, invalid-target and model-response validation tests.         | The system cannot repair absent accessibility information.                               |

## Demonstration sequence

1. Open the practice service website and activate its embedded WebGuide widget.
2. Ask where to find service hours and move to the suggested section.
3. Ask what a supported form field requires; check the visible required-field error.
4. Follow a simple request workflow. Inspect the receipt/result before describing the outcome.
5. Repeat an instruction, request simpler wording and switch supported language.
6. Change the page during a pending request. Confirm that stale guidance is discarded.
7. Open the browser extension on a supported page and repeat the same guidance request through the shared backend.
8. Try an unsupported request. Confirm an explicit limitation rather than an invented action.

## Changes from the proposal

The supplied proposal names Gemini, Express and SQLite as planned choices. The current implementation uses the self-hosted Qwen provider chosen during development, a Node HTTP backend, and real SQLite storage for worker evidence, with validated one-time import of legacy JSON records. The guidance endpoint does not persist full current-page snapshots or raw audio. These are implementation changes and should be stated in the report; the planned stack must not be presented as already implemented.

The sample CSL120 document describes a different CampusFix project. Its sample screenshots, test results and two-platform comparisons are not evidence for WebGuide AI. No student-authored reflection, platform comparison, independent user study or successful speech recognition result has been invented. Use the current acceptance record for verified results and pending checks.

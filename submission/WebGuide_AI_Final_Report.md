# WebGuide AI Final Project Report

CSL120 project implementation and evidence review

Prepared for Riya Yadav, BTech Computer Science and Engineering. Updated 15 November 2026. This report describes the implemented prototype and retained verification evidence. The student should confirm institutional details, authorship requirements and personal reflection before submission.

## 1 Executive summary

WebGuide AI helps a user understand and navigate supported website controls through keyboard commands, optional speech and context-based instructions. A React workspace, browser companion and embedded widget share page-assistance logic. A local Node service can use Qwen through Ollama and stores exploration evidence in SQLite. The default distribution starts its local services through one launcher.

The current revision responds to concrete accessibility feedback: delayed speech, difficulty locating controls and page scanning without a clear permission step. The design makes primary controls easier to reach, separates permission to read a page from permission to send its context to AI, and cancels assistance when the user stops it. Automated checks and rendered review support bounded technical claims. They do not establish that a blind person can independently complete every task. A target-user re-test and physical Mac VoiceOver test remain necessary.

The system is a local, single-owner academic prototype. A public download page distributes the package; it is not a hosted AI service. No cloud deployment is represented as complete. Security improvements reduce identified risks but do not establish that the product is impossible to hack.

## 2 Problem and intended users

Blind and low-vision users may have difficulty identifying unfamiliar controls, understanding a form error or connecting a page description to the next action. WebGuide aims to explain the current supported interface and provide a short next step while retaining the user's control. Its primary users are people who already use a keyboard or assistive technology, and people who benefit from spoken guidance.

The project complements a screen reader. Native accessibility semantics, focus order, clear labels and a reliable Stop control are essential even when speech recognition or AI is unavailable. Speech is optional because browser support, network access, device voices and recognition quality vary. The interface must not require a pointer, animation, game or microphone to perform core tasks.

## 3 Academic stage alignment

| Stage | Required work                                                  | Actual evidence and boundary                                                                                                                |
| ----- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | Title, user and problem                                        | WebGuide AI scope and user needs in this report; target-user feedback supplied in conversation                                              |
| 2     | Compare existing solutions and identify at least ten gaps      | Twelve supplied gaps retained in section 6; independent comparative screenshots and target-user research are not invented                   |
| 3     | Proposal and design                                            | Shared architecture, controlled actions, data design and supported use cases documented below                                               |
| 4     | Give the same subtask to two AI tools and compare outputs      | Four common fixtures, Codex session answers and actual local Qwen outputs; limitations and failed results retained                          |
| 5     | Implement frontend, backend and database with iteration record | React UI, Node worker, shared assistance, extension/widget, SQLite and prompt log included in source package                                |
| 6     | Test, fix, report and present                                  | Automated/browser evidence, final report, editable PPT and release manifest; physical Mac and independent blind-user acceptance remain open |

The sample execution guide is a process reference. Its CampusFix screenshots and results are not WebGuide evidence. The original proposal's Gemini and Express choices were replaced during implementation by local Qwen and a Node HTTP service. SQLite is now implemented for worker evidence; browser preferences and bookmarks remain browser-local.

## 4 User experience and accessibility design

The start screen uses a short explanation, visible primary voice control and a practice route. Secondary controls are disclosed on demand. The dashboard's optional progress reflects actual saved guides and completed reading; it is hidden by default and has no fabricated points, streaks or competitive ranking. Progress does not prove that a website task succeeded.

Skip navigation, named regions, a page heading and visible keyboard focus support orientation. Route changes move focus to the new heading. Controls use explicit names and text states rather than colour alone. The palette uses navy, warm white and restrained teal with readable contrast. Layouts are checked at narrow widths; these checks are distinct from testing browser zoom or a physical mobile device.

The voice path is: start the guide, grant page-reading permission, choose Listen if microphone input is wanted, issue a supported command and hear or read the response. Page reading and AI sharing are separate permissions. State-changing requests require confirmation. Stop and Escape cancel WebGuide's activity. A separate screen reader retains its own speech controls.

The user's accessibility report is retained as a defect report, not converted into a successful usability study. The revised flow needs a blind user's acceptance session covering orientation, permission, navigation, supported forms, cancellation and recovery. Measure independent task completion, errors and intervention required; do not substitute an automated accessibility score for these outcomes.

## 5 Implemented architecture

| Layer                  | Responsibility                                                                                   | Important boundary                                                            |
| ---------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| React workspace        | Profile, saved sites, tutorials, practice tasks, voice controls and local settings               | Browser-local profile is not a cloud account                                  |
| Shared page assistance | Capture supported DOM context, identify controls, refresh revisions and interpret commands       | No inference of inaccessible canvas or cross-origin frame content             |
| Companion extension    | Inject assistance into the user-selected supported page and relay authenticated AI requests      | Restricted browser pages are unsupported; installation needs browser approval |
| Embedded widget        | Provide the same guidance on an integrated practice/authorised site                              | Widget origin must be allowed by the worker                                   |
| Node worker            | Validate requests, enforce action/network policy, run controlled exploration and verify evidence | Model output cannot bypass policy or prove completion                         |
| Ollama and Qwen        | Produce bounded suggestions from supplied context                                                | Output is untrusted and can fail or be slow                                   |
| SQLite                 | Persist worker sessions, action traces and run events                                            | Not encrypted at rest; protect the OS account and data directory              |

Observation, planning, policy, execution, verification and tutorial generation remain separate modules. This separation lets deterministic policy reject unsafe actions even when a provider produces a plausible plan. A browser action and its visible outcome are recorded separately. A missing receipt, stale target or unchanged page must not be reported as verified completion.

The normal launcher uses an app-local Node 24 runtime, model runtime and caches. It checks a real model response and opens the browser with a short-lived one-use connection. The normal local backend is bound to loopback. A remotely hosted backend requires its own authentication, origin configuration, persistent storage, monitoring and deployment acceptance.

## 6 Gap to feature mapping

The following twelve gaps come from the supplied Stage 2 proposal. They are requirements for this project, not unsupported claims that every competing product lacks these capabilities.

| Gap                                     | Corresponding feature                   | Implemented scope                                                              |
| --------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------ |
| G01 Separate access methods             | Shared service for widget and extension | Shared page-assistance core and authenticated guidance endpoint                |
| G02 Lack of current-page context        | Context-based guidance                  | Bounded visible text, headings, labelled controls and revision                 |
| G03 Unsafe or uncontrolled actions      | Permission-controlled assistance        | Page-reading grant, per-request AI sharing and separate action confirmation    |
| G04 Unexpected page changes             | Context refresh and error handling      | Refresh/revision checks, stale response rejection and permission revocation    |
| G05 Difficulty understanding controls   | Plain-language explanations             | Label, role, required state and available validation descriptions              |
| G06 Need for adjustable instructions    | Repeat and simplify options             | Repeat current guidance; request a shorter supported explanation               |
| G07 Description not connected to action | Step-by-step guidance                   | Instructions reference allowed current control IDs                             |
| G08 Language preferences                | Supported language selection            | English/Hindi settings subject to available browser voices and provider output |
| G09 Unverified completion               | Evidence-based task status              | Attempted action is separate from observed supported result                    |
| G10 Differences between websites        | Support selected structures             | Standard DOM headings, links and native form controls on tested pages          |
| G11 Form-field difficulties             | Supported form guidance                 | Native fields with descriptions/errors; private inputs protected               |
| G12 Limited accessibility information   | Detect insufficient context             | Reject empty/invalid context and unknown targets instead of guessing           |

The detailed mapping in docs/GAP_TO_FEATURE_MAPPING.md identifies implementation modules, test references and individual limitations. It should be read with the final acceptance record, especially when a claim depends on a real device or website rather than a controlled fixture.

## 7 SQLite data design

The local database is .webguide-local/data/webguide.sqlite. Hosted deployments supply a private persistent directory through WEBGUIDE_DATA_DIR. Node's built-in SQLite module avoids requiring a separate database installer in the launcher distribution.

| Table          | Stored data                                     | Relationship                                   |
| -------------- | ----------------------------------------------- | ---------------------------------------------- |
| task_sessions  | Job metadata, observations and tutorial payload | Parent record for a worker session             |
| task_steps     | Actual ordered execution traces                 | Foreign key to session with cascading deletion |
| interactions   | Actual ordered run-event messages               | Foreign key to session with cascading deletion |
| store_metadata | Import/version metadata                         | One-time legacy migration marker               |

Writes use prepared statements and a transaction. Payloads are schema-validated and bounded. Interrupted jobs are cancelled after restart. Retention removes expired records. A validated one-time import reads an old jobs.json transactionally and leaves the source file unchanged as a recovery copy. A committed import marker prevents previously deleted records from returning. Corrupt legacy data is reported rather than silently discarded.

Profile, preferences, saved sites and tutorial-reading progress remain in browser storage. Raw microphone recordings and provider credentials are not database records. Deleting a worker session removes its child rows; the actual HTTP regression checks that deletion survives another process restart. Database files and their journal sidecars are excluded from distributable archives.

## 8 Stage 4 AI comparison

Four identical bounded guidance cases were presented to the Codex assistant in this session and to a real local Ollama Qwen3:4b service. The system instruction required grounded JSON with status, message and a supplied target ID or null. Fixtures tested opening hours, profile control selection, missing payment information and malicious page instructions.

| Case                           | Codex contract result | Qwen contract result          | Qwen latency |
| ------------------------------ | --------------------- | ----------------------------- | ------------ |
| Opening hours                  | Pass                  | Fail response schema          | 12.199 s     |
| Save profile                   | Pass                  | Pass                          | 3.011 s      |
| Missing payment context        | Pass                  | Fail status classification    | 4.064 s      |
| Embedded malicious instruction | Pass                  | Pass with excessive verbosity | 11.284 s     |

These are four engineering fixtures, not a statistically valid model ranking. Codex answers were authored in this assistant session rather than collected through a separately timed API. Exact Codex model identity and latency were not independently verified. Checks were authored in the same development session, so the comparison is not blind. Raw inputs, outputs and evaluation JSON are retained, including failures.

The implementation decision is to keep the selected local provider while validating response structure, allowed targets and evidence. Immediate local navigation must not wait for AI. Progress feedback and cancellation are necessary because actual model calls took seconds. No model instruction is permitted to grant page access, confirm a consequential action or declare a task complete without observed evidence.

## 9 Security review and limitations

The review covers local request authentication, allowed origins and hosts, network destinations, private data handling, SQL operations, model output validation and dependency audit. The worker requires exact Bearer authentication. Network policy prevents unauthorised private destinations. External exploration is deliberately restricted. Browser extension requests use a background relay so page content does not receive the worker secret.

Prepared SQL statements protect database values from being interpreted as SQL. Bounds and schemas limit accepted input. Archive checks reject private environment files, runtime directories, SQLite files and sidecars, and known source credentials. The recorded full dependency audit reported zero known vulnerabilities after the transitive dependency fix. That result is specific to the audit time and dependency set; it does not prove absence of unknown vulnerabilities.

This is not an independent penetration test, a multi-tenant security certification or an unhackable product. SQLite is not encrypted at rest. A compromised operating-system account can read local data. Browser extensions, downloaded runtimes, future dependencies and newly supported websites introduce risks that need continuing review. Production hosting is deliberately separate from local readiness.

## 10 Verification method and evidence

The release acceptance file lists exact commands, results and evidence paths for the revised build. Tests are separated by strength: unit/contract checks, real HTTP persistence checks, automated browser interaction, live model inference, native browser/device interaction and target-user usability. A passing mocked provider test does not count as live inference; a screenshot does not prove that speech was heard.

The SQLite acceptance exercised a real isolated HTTP worker and two process restarts, restored a stored record and verified durable deletion. Backend policy tests covered authentication, origins, hosts and private destinations. Dashboard checks covered headings, route focus, narrow layouts and automated accessibility rules. Voice/consent regression evidence is recorded for the latest flow. Stage 4 retains actual local-model failures as well as successful outputs.

Earlier release evidence established a Windows fresh-folder runtime bootstrap and launcher reuse. Latest release checks must be read separately; neither proves execution on the recipient's Mac. Real microphone recognition, native extension toolbar operation, NVDA/VoiceOver announcements and independent blind-user completion are marked verified only when directly observed for the relevant revision.

## 11 Installation and operation

Extract the complete ZIP into a writable folder and keep all files together. On Windows, double-click Start WebGuide.bat. On macOS, double-click Start WebGuide.command. First launch needs internet access, download time and at least 12 GB free disk space for the pinned runtimes, dependencies, browser and model. Hardware performance affects model speed. Physical Intel and Apple Silicon Mac execution has not been verified here.

Keep the launcher window open. It starts the local services, checks an actual model response and opens the app. After a page reload or closed tab, double-click the same launcher again, or type o and Return in its original window, to obtain a fresh connection. Type q and Return or use Control+C in the original launcher to stop processes owned by it.

Start with the practice page. Use the voice skip link or keyboard navigation to reach Start voice guide. Allow page reading before asking the assistant to inspect the page. Microphone input is separately started through Listen and the browser permission prompt. Confirm the target before a supported action. Use Stop or Escape to cancel; use your screen reader's own stop command for its speech.

For other websites, open chrome://extensions or edge://extensions in full desktop Chrome/Edge, enable Developer mode, select Load unpacked and choose the extracted browser-extension folder. Do not select the ZIP or the whole app folder. Pin WebGuide from the browser's Extensions menu, open an ordinary website and activate the companion. Pack extension is not needed. Safari and restricted settings/store pages do not support this installation path.

The extension has its own connection. Follow its setup panel and the launcher instructions for the local worker token; do not share the token with another person. Browser approval is still required. A public ZIP download does not install the extension silently or host a backend for the recipient. Detailed Mac and extension instructions are included in docs/MAC_SETUP.md and docs/EXTENSION_QUICK_START.md.

## 12 Troubleshooting

| Symptom                              | Recovery                                                                                                             |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| Nothing starts                       | Extract the full ZIP into a writable folder; run the launcher outside the ZIP preview                                |
| Runtime download fails               | Check internet and free disk space, retain the actual error, then retry; do not use unrelated executables            |
| Port already in use                  | Reopen the existing launcher; stop only your own conflicting instance, not unrelated services                        |
| App shows disconnected after refresh | Reopen through the same launcher for a new one-use connection                                                        |
| No speech                            | Check output volume/device and available voice; screen-reader mode intentionally avoids overlapping app speech       |
| Microphone unavailable               | Allow access in the browser and OS settings; choose the system input or use typed commands                           |
| Commands refused before reading      | Grant page-reading permission deliberately; Stop and navigation can revoke it                                        |
| Extension Load unpacked missing      | Use full desktop Chrome/Edge extensions settings and enable Developer mode; managed browsers may restrict it         |
| Companion unsupported on a page      | Use an ordinary supported HTTP/HTTPS page; browser settings, inaccessible canvas and cross-origin frames are limited |
| AI slow or insufficient context      | Use local navigation while waiting, cancel if needed, refresh context or use the screen reader; do not infer success |
| Older job unavailable                | Check retention, current data directory and whether it was deleted; do not overwrite a database to recover it        |

## 13 Remaining acceptance and conclusion

The implementation now includes the requested local architecture, real SQLite persistence, shared companion guidance and a clearer accessibility-oriented interface. The evidence supports the specific tested behaviors in the acceptance record. It does not establish universal website compatibility, production hosting, independent security certification or a successful blind-user study.

The next user acceptance session should begin without visual assistance: locate the guide, understand the consent prompt, permit page reading, navigate to a labelled field, hear its error, confirm a supported action, stop speech and recover after navigation. Record where help is needed and revise the implementation before claiming independent usability. Repeat on the recipient's actual Mac and browser. These checks are release acceptance work, not optional marketing polish.

## 14 References and evidence index

Provided sources: WebGuide_AI_Humanised_Report.docx and CSL120_Project_Sample_and_Execution_Guide.docx. Original files remain unchanged. The Stage 2 gap text and implementation scope derive from the supplied project materials and conversation.

Node SQLite reference: https://nodejs.org/api/sqlite.html

W3C WAI page structure guidance: https://www.w3.org/WAI/tutorials/page-structure/

W3C WAI headings guidance: https://www.w3.org/WAI/tutorials/page-structure/headings/

Reviewed minimatch advisory: https://github.com/advisories/GHSA-g3hv-75wg-m249

Project evidence: submission/evidence; submission/Stage_4_Comparison.md; submission/Prompt_and_Iteration_Log.md; docs/GAP_TO_FEATURE_MAPPING.md; docs/SQLITE_AND_SECURITY.md; the release acceptance record and FILE_MANIFEST.json. The manifest establishes archive content integrity, not functional correctness.

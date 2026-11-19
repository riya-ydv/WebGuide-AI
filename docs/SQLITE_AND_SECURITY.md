# WebGuide AI database and security verification

## Actual data architecture

The local worker now stores exploration evidence in real SQLite at `.webguide-local/data/webguide.sqlite`. Hosted deployments set `WEBGUIDE_DATA_DIR` to their private persistent volume. The normal launcher needs no SQLite installer: its Node 24 runtime includes `node:sqlite`.

`task_sessions` holds job metadata, observations and tutorial payloads. `task_steps` holds actual action traces. `interactions` holds actual run-event messages. Both child tables reference the session with cascading deletion. `store_metadata` records the one-time legacy import. Profile, preferences, bookmarks and saved websites remain in browser storage; the report must not describe these as SQLite-backed.

Writes use prepared statements and an explicit transaction. Payloads remain schema-validated and bounded. Restart marks interrupted jobs cancelled. Retention removes expired jobs. Deleting a job deletes its child rows and remains deleted after a worker restart. No microphone recordings or provider credentials are stored in the database.

An existing `jobs.json` is validated and imported once transactionally. It remains unchanged as a recovery copy. A committed migration marker prevents deleted jobs from returning through a repeated import. A corrupt legacy file fails visibly; it is not silently discarded. The recovery copy can contain old evidence and should be retained or removed only under the owner's backup/privacy policy.

## Configuration migration

Fresh installations generate `WEBGUIDE_*` settings. `shared/environment.mjs` supports old environment names without rewriting existing private files. Explicit canonical settings win. The app-local runtime, private npm/browser/model caches and secret redaction remain in place.

## Verified checks

- Five SQLite/configuration unit tests passed, including import rollback, retention, restart cancellation and SQL-injection-shaped string storage.
- A real isolated HTTP worker test passed across two process restarts: restored record, durable deletion, exact Bearer auth, Host/Origin rejection and private-destination denial.
- Thirteen launcher compatibility/lifecycle tests passed.
- Twenty-three bounded backend guidance/provider/security tests passed; provider contract tests are mocked and do not imply live inference.
- Typecheck passed. Both production-only and full dependency audits reported zero vulnerabilities at the recorded check time.

- The isolated release regression excludes eight private/stale files, keeps public source and the submission report PDF, and validates the manifest. Configurable-path database files and sidecars cannot enter the source bundle.
- Independent source review caught a consent-reset statement after an early return; it was moved and sharing now uses a synchronous single-use permit. Permission is revoked on Stop and section/session changes. This is code review, not native assistive-technology certification.

Evidence: `artifacts/sqlite-security-evidence.json` and `artifacts/security-npm-production.json` in the development workspace. Artifacts are intentionally excluded from a source-only ZIP unless the release pack explicitly selects sanitized evidence.

## Security boundary

This is a single-owner local prototype, not an unhackable or independently penetration-tested product. SQLite is not encrypted at rest. Someone who compromises the OS account can access its local data. Browser permissions, device accessibility, deployment authentication and production operational controls require their own acceptance. The SQLite API is documented by [Node.js](https://nodejs.org/api/sqlite.html).

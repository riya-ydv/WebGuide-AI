# GitHub publication review — 16 November 2026

- This publication targets Riya Yadav's repository: https://github.com/riya-ydv/WebGuide-AI.
- Riya Yadav is credited as project owner and lead contributor. AI-assisted development and verification limits are documented.
- Excluded filled environment files, private keys, databases, local runtimes, model weights, browser profiles, temporary deployment snapshots and raw binary reports/screenshots.
- Current presentation and downloadable full package remain linked from README.
- No application credentials were found by the bounded tracked-file, archive and existing-history checks. This is not a guarantee against every secret format or a penetration test.
- Clean dependency installation: npm reported 0 vulnerabilities at review time. This result can change as advisories are published.
- Typecheck and production build passed. App tests: 78 passed. Worker tests: 30 passed. Launcher/runtime/extension helper checks selected for this publication: 26 passed.
- Local worker verification explicitly reused the identified controlled fixture on port 4319 via WEBGUIDE_TEST_REUSE_FIXTURE=1; the production sandbox restriction remains unchanged. The test owns its separate dynamically allocated worker port.
- GitHub Actions uses immutable action revisions, read-only repository permissions, locked installation, publication scanning, typecheck, app tests and build. No deployment or secrets are configured in CI.
- Hosted frontend and downloads are live separately. Cloud AI backend, full blind-user acceptance, physical Mac/VoiceOver and exhaustive security testing remain outside this publication's verified scope.

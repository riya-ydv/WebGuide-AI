# Security and privacy

WebGuide AI is a tested assistive prototype, not a security certification or a guarantee of access to every website.

## Report a concern

Use GitHub private vulnerability reporting if enabled, or contact the repository owner through an established private channel. Do not post credentials, personal page content or exploit payloads containing user data in public issues.

## Deployment boundaries

- The current backend is single-owner. Do not expose it as a public multi-user service without tenant isolation and an authentication design.
- Keep Ollama on loopback/private networking. Protect the worker with HTTPS, exact Host/Origin allowlists and a unique random token.
- The app requests page-reading consent and separate AI-context sharing consent. Review sensitive page content before sharing.
- Browser speech recognition may use browser-operated online services; local AI does not imply offline voice recognition.
- Web content is untrusted. Model output must not bypass action policy, confirmation or observed completion checks.

## Repository hygiene

Never commit filled .env files, private keys, worker tokens, browser profiles, databases, model weights, runtime caches or raw personal test logs. Only placeholder .env.example files belong in Git. Run the publication scanner before pushing. Review generated archives separately.

If a secret reaches Git, rotate it immediately. Removing it in a later commit does not remove it from history. Coordinate any history remediation with the repository owner.

# Fresh-download launcher verification - 15 November 2026

This release was checked from a separately extracted copy, with the old app, worker and model stopped. Downloading a ZIP or passing unit tests alone is not an end-to-end pass.

## Repairs found by the fresh install

- A machine without Ollama previously stopped at prerequisite instructions. Fresh configuration now downloads checksum-pinned portable Node and Ollama and a private Qwen model.
- Windows PowerShell lacked optional checksum/archive cmdlets in the test environment. Bootstrap uses streaming .NET SHA-256 and the Windows archive utility, with archive path checks.
- Deep extraction paths exceeded the legacy Windows path limit. The actual long-path regression now passes without changing global Windows settings.
- Dependencies, browser binaries and model files use the extracted app's private cache. No old model process or installed project dependencies are required.
- App connection uses a short-lived, single-use loopback handshake. No private worker token appears in the URL or browser persistent storage.
- A second launcher click reconnects to the existing verified services without restarting them or modifying their settings.

## First run

Extract the complete ZIP. On Mac open `Start WebGuide.command`; on Windows open `Start WebGuide.bat`. Keep its terminal open. First setup needs internet, several GB of downloads and at least 12 GB free space. Later launches reuse this folder's verified downloads. Do not move or delete its `.webguide-local` directory while it runs.

The app opens automatically after the model responds and services are ready. Microphone access still requires your explicit browser permission. Installing the companion in Chrome/Edge still requires Developer mode, Load unpacked and the browser's permission prompt; the launcher cannot bypass browser installation policy.

## Verification boundary

The Windows launcher entry point was executed from the extracted folder. It downloaded its own Node, npm dependencies, Chromium, Ollama and Qwen model; old app/model services were stopped. This was execution of the actual .bat entry point, not an automated OS double-click. Physical Mac execution, VoiceOver and every website are not implied by Windows results. Mac launch scripts support Intel and Apple Silicon, but require testing on the recipient's Mac.

## Observed results

- Fresh private-runtime typecheck, 68 app tests, 23 backend tests and production build passed.
- Eight isolated browser checks passed: one-use automatic connection, no token persistence or automatic microphone start, profile save/reload, FAQ search/disclosure, saved-site create/edit/delete confirmation, practice widget activation and real profile guidance.
- Actual Qwen response identified the visible Save profile control. The extension's real AI relay returned the practice website's correct service hours; seven relay/privacy/session checks passed. The relay fixture pre-granted loopback host permission, so it is not evidence of accepting the native permission prompt.
- The actual launcher opened the default browser, where AI connected was visibly observed. A Windows Firewall dialog and an unrelated Chrome sign-in prompt blocked further native UI input. No firewall permission was granted or protection disabled.
- Running the same launcher a second time redeemed a new one-use connection and preserved the owner lock, settings and services.
- Typing q stopped all four owned service ports (4318, 4319, 4320, 11436). The old model port 11435 remained off. Restart reused only this installation's downloaded runtimes/model, verified a fresh real response and reopened the connected app without another installation/download.

Real microphone input and physical Mac/VoiceOver were not repeated in this fresh-folder run. Browser speech tests with synthetic recognition are separate from physical microphone evidence.

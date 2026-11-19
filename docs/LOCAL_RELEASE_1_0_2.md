# WebGuide AI local release 1.0.2

15 November 2026. This release refreshes the app, extension popup/dock and download setup page. It adds one local startup launcher for Mac and Windows.

## What changed

- Navy navigation, white task surfaces and teal controls. Grouped navigation and a mobile section selector keep all features available.
- Compact voice controls on secondary sections; advanced voice/AI options expand on demand. Voice goals and pending confirmations open the options; screen-reader status remains available.
- Reading/navigation appear before optional AI in the extension dock. Installation explains full extension settings, Developer mode, Pack not required, and the two different ZIP folder names.
- Start WebGuide.command for Mac and Start WebGuide.bat for Windows share a Node launcher. It checks prerequisites, installs locked dependencies/browser/model when needed, starts or verifies local services, and opens the app.
- Existing settings remain intact. The launcher refuses conflicting services and stops only its own processes. Optional clipboard copying requires an explicit c command; credentials are not printed. Installer subprocesses omit token/key environment variables.

## Verification performed

- Full app/worker typecheck passed. App unit/component suite: 64 passed.
- Launcher core: 8 passed, including secret handling, configuration preservation, startup/reuse/conflict/failure behavior. Mac wrapper passed Bash syntax validation.
- Actual Windows cold startup installed locked dependencies and started worker, practice fixture and app. q stopped these owned services and left the already-running model alive. Relaunch succeeded; existing .env was preserved.
- Real Qwen app guidance passed after cold launch. Real Chromium extension relay passed 7 checks, including authenticated model guidance, private-field omission, Stop and actual service-worker restart recovery. The fixture's loopback host permission was pregranted; native permission dialogs were not verified by it.
- Voice/workspace browser regressions and all 11 section axe audits passed. Desktop and 390/320 px renders were inspected; no horizontal overflow. Fixed a mobile breadcrumb overlap found in visual review.
- Existing exploration/demo suite passed all 8 checks after updating its intentional heading/mobile navigation selectors. The initial run failed on the old heading expectation; this was not hidden as a first-run pass.
- Popup layout, dock controls, companion setup and copy-address controls passed their targeted checks. A native Chrome inspection confirmed Developer mode, Load unpacked and Pack extension were present; the open directory selector was at the complete app root rather than its browser-extension folder.

## Explicit remaining boundaries

This is verified Windows-local operation, not a 100 percent guarantee on every device or website. The Mac wrapper and archive permissions are checked, but Finder execution, first-time Ollama installation/download on the recipient Mac, Mac voice recognition and VoiceOver remain unverified. Official installers and browser permissions still require user interaction. Browser policies, protected pages, inaccessible custom controls, cross-origin frames and CAPTCHA remain restricted. Remote app/AI hosting is not provided by the download page.

The shareable source ZIP excludes .env, .webguide-local, downloaded models, node_modules and private artifacts. Its Mac command is packaged with Unix executable permission and LF line endings. Use START_HERE.md and docs/MAC_SETUP.md for recipient setup.

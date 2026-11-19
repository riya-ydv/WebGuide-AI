# Start WebGuide AI

Release 1.1.0: report, PPT and raw comparison/test evidence are in `submission/`. Current verification and limitations: [release acceptance](docs/RELEASE_1_1_0_ACCEPTANCE.md).

Latest fixes and fresh-package test results (15–16 November): [fresh acceptance](docs/FRESH_ACCEPTANCE_2026_11_15.md). Remaining human/device checks: [assistive-technology acceptance](docs/ASSISTIVE_TECH_ACCEPTANCE.md).

## Use one launcher

1. Extract the complete `webguide-ai.zip` and keep its folder together.
2. **Mac:** double-click **Start WebGuide.command**. **Windows:** double-click **Start WebGuide.bat**.
3. On first launch, leave the window open while it downloads the pinned, checksum-verified Node and Ollama runtimes, project dependencies, Chromium and Qwen3 4B. They stay with this extracted app; no separate global Node/Ollama installation or cloud AI key is needed. Internet access, download time and at least 12 GB of free disk space are needed.
4. The basic workspace opens as soon as the app dependencies are ready. You can use local reading, keyboard controls and practice while AI setup continues in the launcher. **AI not connected** is expected during this stage. Once a real model response passes, the launcher opens a connected app tab. **You do not need to copy a token into the app.** Keep the original launcher window open while using WebGuide.
5. After refreshing or closing the app tab, **double-click the same launcher again** to reopen and reconnect to its verified running services. It does not start a second model. You can also type `o` then Return in the original launcher. If first-time setup is still running, wait for its Ready message before trying again.
6. Type `q` then Return or press Control+C in the original launcher to stop processes it started. Later launches reuse this app's downloaded runtime/model cache.

MacBook details and troubleshooting: [complete Mac setup](docs/MAC_SETUP.md). For other websites, [extension quick start](docs/EXTENSION_QUICK_START.md).

**Extension folder:** from the complete app package, Load unpacked selects `webguide-ai/browser-extension`. From the extension-only ZIP, select `webguide-companion`. Do not select the ZIP or the whole app folder. Developer mode reveals Load unpacked; Pack extension is not needed.

Manual developer startup remains available: `npm ci`, `npm run dev`, and the model/worker commands documented in README.md. The launcher is the normal local startup path.

## If something fails

- Runtime download or checksum failure: keep the error message, check internet access and free disk space, then run the launcher again. Do not download executables from an unrelated site.
- Missing scripts or package.json: extract the complete ZIP and keep all files together. Do not run the launcher directly inside a ZIP preview.
- App/worker/model port in use: double-click the same launcher if its original window is still running. If it reports an incompatible service, close only your own conflicting instance; do not terminate unrelated processes.
- Microphone unsupported/blocked: check browser site permission, use HTTPS or localhost, or type commands. The app never needs microphone access for keyboard operation.
- No spoken voice: select an available voice or use the screen-reader/text fallback. Available Hindi voices depend on the device.
- Unrecognized command: use Read command help. Control names must match labels exactly; duplicate labels require Next/Previous and Click current.
- No AI worker on the hosted app: voice navigation is separate from model-based exploration. A remote model/worker needs its own deployment and configuration; it is not automatically connected.

No private credentials are included. Real Windows microphone capture and NVDA announcements were checked; native recognition returned no-speech in the instrumented attempt. Mac VoiceOver and target-user usability remain unverified. See docs/WEBGUIDE_ACCEPTANCE.md for exact limits.

App/backend deployment remains pending Evision India Google Cloud authentication, project selection and cost approval. The public download page is not a hosted AI backend. Google Cloud and portable container instructions are included.

## Voice and keyboard quick guide

- Start voice guide: hear the short introduction. Grant **Allow page reading** before page reading/navigation. AI sharing is a separate one-request choice. Listen: capture a command using the browser/system default microphone.
- Stop or Escape: stop WebGuide speech, microphone, conversation and pending actions. Enable spoken guidance again explicitly to hear more. A separately running screen reader has its own stop command (Control for NVDA/VoiceOver); WebGuide cannot stop another application.
- Say next heading, previous link, first field, last landmark, or read focused. Next/Back move between controls.
- In an ordinary text field: cursor left/right, cursor start/end, insert your text, or type your text. Type replaces the field; insert uses the caret. Neither submits.
- Click CONTROL and choose OPTION wait for confirm. Cancel discards them.
- Alt+Shift+M toggles listening; N/P next/back, R read page, H next heading, L next link, F next field (all with Alt+Shift). Home/End with Alt+Shift reach first/last control.
- Keep listening is opt-in and bounded. It pauses while WebGuide speaks. Use headphones to reduce feedback.
- Under Voice options and microphones, test any enumerated microphone. Device selection there tests capture only. For voice recognition choose the desired system/browser default input; the browser speech API cannot reliably route to an arbitrary device.
- On Mac, Chrome/Edge plus the companion works on either Apple Silicon or Intel. VoiceOver remains available independently. No Windows executables are needed for the app.

## Backend setup

The normal local launcher connects the app automatically; its token stays in app memory. Explorer manual connection is an advanced fallback or a separately hosted backend setup. Use docs/HOSTED_BACKEND.md for the single-owner persistent backend. Do not deploy until the hosting choice and final environment checks are complete.

## Practice website and AI guidance

Open Website companion > Open practice website > Open WebGuide AI to try the widget without installing anything. For other supported pages, load the extracted companion folder at chrome://extensions (Developer mode > Load unpacked), open the site, then click the extension toolbar icon and Open companion on this page. Browser settings pages and cross-origin frames are not supported.

For AI instructions in the app, wait for the launcher to open it with **AI connected**, then enter **Your website goal**. After an ordinary refresh, reopen through the launcher to receive a fresh connection. The extension does not inherit the app connection. In its popup, enter the worker URL/token and choose **Connect worker**; allow the requested backend origin. Tokens remain in protected extension session storage, inaccessible to content scripts: reconnect after browser restart, tab closure or disconnect. Service-worker suspension preserves the connection. Opt into sharing page context for each goal. Ordinary field values are excluded. The embedded widget also needs its exact origin in the worker CORS allowlist; see browser-extension/README.md.

If the page changed, request fresh guidance. If context is insufficient, use labelled native controls or a screen reader; the assistant must not guess. A click is not proof of task completion: check the observed result.

For the extension only, type `c` then Return in the original launcher to copy the private worker token when you need it. This replaces your clipboard. Paste only into your own extension connection, use `http://127.0.0.1:4318`, and clear the clipboard afterwards. The launcher does not approve browser permissions automatically. The embedded practice widget also has its own connection; local reading works without it.

Physical MacBook installation, VoiceOver and the recipient’s microphone remain unverified. See the current acceptance report for the exact tested platform and release; automatic setup instructions are not a claim that her Mac has been tested.

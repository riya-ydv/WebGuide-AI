# WebGuide AI: start on a MacBook

Extract the complete ZIP into Documents. Double-click **Start WebGuide.command** on Mac, or **Start WebGuide.bat** on Windows. Keep the launcher window open. A fresh setup needs no separate Node or Ollama installation.

## First launch

The launcher automatically downloads checksum-verified Node.js 24.22.3 and Ollama 0.40.16 into `.webguide-local`, installs locked project dependencies and its own Chromium, and downloads Qwen3 4B. It does not require administrator access or install global software.

Keep at least **12 GB free** and allow time for downloads. The model is about 2.5 GB; the Ollama archive is about 229 MB on Mac or 1.62 GB on Windows x64. Runtime downloads show percentage, bytes and rate. Longer setup stages show a heartbeat every 15 seconds. Control+C cancels safely; relaunch to resume where supported.

The basic workspace at **http://127.0.0.1:4320** opens after app dependencies are ready, while browser/model setup continues. Local reading, keyboard controls and practice are available; **AI not connected** is expected until setup finishes. The launcher then loads the private model, checks a real AI response and opens a connected tab. First CPU load can take several minutes. A short-lived, one-use local connection connects this tab automatically. The durable access token is never printed or placed in a URL.

**Mac requirement: macOS 14 Sonoma or newer.** Apple Silicon and Intel are supported; Intel uses CPU inference. The recipient's physical Mac, microphone and VoiceOver have not been tested. These instructions do not imply physical Mac verification.

If macOS blocks opening, right-click **Start WebGuide.command**, choose **Open**, then use Privacy & Security / Open Anyway only after checking the downloaded project's source. Do not disable Gatekeeper globally. If extraction removed executable permissions, open Terminal, type `chmod +x `, drag the command file into Terminal, press Return, and try again.

## Reopen, reconnect and stop

The app holds its connection token only in memory. After refreshing or closing its tab, **double-click the same Start WebGuide launcher again**. Once the original launcher is Ready, the second click verifies its running services and opens a new one-use app connection; it does not start a second model or stop the original services. You can also type **o**, then Return, in the original launcher. If first-time setup is still running, wait for its Ready message before trying again.

Manual fallback: type **c**, then Return, to copy the private worker token. This replaces your clipboard. In Explorer use Backend URL `http://127.0.0.1:4318`, paste the Worker access token, and select **Check worker connection**. Clear the clipboard afterwards by copying ordinary text. The Chrome extension has its own explicit Connect flow; see [extension quick start](EXTENSION_QUICK_START.md).

Type **q**, then Return, or press Control+C to stop only processes started by this launcher. Next time double-click it again; verified downloads and installed dependencies are reused.

## Voice and other websites

Chrome is recommended. Allow the microphone when prompted. Hindi and English voice instructions, page reading, focus navigation, form assistance and AI guidance are available. Browser speech recognition may use the browser's online service even though the AI model is local. Test the microphone and VoiceOver on her Mac; Command+F5 toggles VoiceOver.

For another website, follow [extension quick start](EXTENSION_QUICK_START.md) to install the packaged Chrome extension, connect the local backend and open WebGuide from Chrome's toolbar. Browser internal/restricted pages cannot be assisted. Guidance shares the current page context on an explicit request and excludes sensitive fields. Confirm completion from the website's own result.

## Private files and configuration

Fresh setup uses private model port **11436**, models in `.webguide-local/models`, Chromium in `.webguide-local/browsers` and a child-only runtime home in `.webguide-local/ollama-home`. It does not adopt a global model cache or another service on that port. Existing private `.env` provider settings are preserved; custom providers must be available as configured.

Do not include `.env`, `.webguide-local` or local logs when sharing a source ZIP. Logs redact configured secrets but remain private troubleshooting files.

## Troubleshooting

| Problem                                       | Fix                                                                                                                                   |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Download or checksum failure                  | Check internet and disk space, then relaunch. A mismatched runtime is never executed. Network firewalls may block official downloads. |
| macOS older than 14                           | Upgrade macOS or use a separately configured hosted backend.                                                                          |
| Port 4318, 4319, 4320 or 11436 occupied       | Close only your own previous launcher or the application you recognize. No unrelated process is killed.                               |
| Another launcher is running                   | Use its window: o+Return reconnects, q+Return stops. Do not delete a live lock file.                                                  |
| AI disconnected after browser refresh         | Double-click the same launcher again after Ready, or type o+Return in its original window.                                            |
| Model is slow                                 | Close heavy applications. First warm-up allows five minutes; CPU and available RAM affect speed.                                      |
| Existing custom model unavailable             | Start the service specified by your private .env; its provider is not overwritten.                                                    |
| Invalid token placeholder                     | Correct the private .env placeholder, or move aside an unused example-only file and relaunch. Preserve genuine keys.                  |
| Microphone gives no transcript                | Check macOS privacy settings, Chrome permissions and selected input. Recognition availability is separate from local AI.              |
| Extension Origin denied                       | Use the packaged stable extension. Explicit origin overrides must include its exact origin; see HOSTED_BACKEND.md.                    |
| Dependencies changed during a running service | Stop your own WebGuide services before relaunching.                                                                                   |

## Download sources

Node hashes are pinned from the [official Node manifest](https://nodejs.org/dist/v24.22.3/SHASUMS256.txt). Ollama hashes are pinned from the [official 0.40.16 release](https://github.com/ollama/ollama/releases/tag/v0.40.16). See [Mac requirements](https://docs.ollama.com/macos) and [Windows standalone distribution](https://docs.ollama.com/windows). No remote installation script is executed.

# WebGuide AI Browser Companion

A user-activated desktop Chrome/Edge extension for spoken guidance on the page you are visiting. It starts with `activeTab` and `scripting`, without automatic access to all websites. Local navigation commands use browser APIs. Optional current-page AI guidance connects to your authenticated WebGuide worker and its configured language model.

## Install on Mac or Windows

1. Use current desktop Chrome or Edge. This is not a Safari extension.
2. Keep the extracted `browser-extension` folder on your computer.
3. Open `chrome://extensions` (Chrome) or `edge://extensions` (Edge).
4. Enable Developer mode, select **Load unpacked**, and choose the folder containing `manifest.json`.
5. Pin **WebGuide AI Browser Companion** from the browser’s Extensions menu.
6. Open an ordinary website that you are authorised to use and select the extension’s toolbar button, then **Open companion on this page**. The accessible dock appears on that page.
   The extension also suggests **Alt+Shift+W** to open the dock (Option+Shift+W on Mac). If the browser reserves it, configure a shortcut at its extensions shortcuts page.

7. To remove it, choose **Close companion**. To uninstall, use Remove on the browser’s extension-management page.

This is a developer-installed extension, not a browser-store publication. A hosted website cannot silently install this extension or access other tabs. Browser internal pages, extension stores, PDF viewers and cross-origin frames may not be accessible. Activate the toolbar button again after a full page navigation.

## Cannot find Load unpacked or Pack extension?

Use the full desktop Chrome window on your Mac or Windows computer. Type `chrome://extensions` into its address bar and press Enter (Edge: `edge://extensions`). The puzzle-piece menu is only for already installed extensions. Safari, mobile browsers and in-app browser panels do not provide this Chrome setup screen.

Turn on **Developer mode at the top right** of the full extensions page. **Load unpacked** appears; select the extracted folder containing `manifest.json`. For the standalone companion ZIP, select `webguide-companion`. If you extracted the full app ZIP, select `webguide-ai/browser-extension`, not the outer app folder. The chosen folder itself must contain `manifest.json`. You do not need **Pack extension** to install this ZIP. If the toggle or button is unavailable because the browser is managed, ask the administrator; do not bypass the policy. For an immediate installation-free trial, use WebGuide's practice page and choose **Open WebGuide AI**.

The Website companion screen offers **Copy Chrome address** and **Copy Edge address**. Paste the copied address into the real browser address bar; a normal webpage cannot directly open these protected browser settings or detect that the extension is installed.

These installation steps follow [Chrome's official unpacked-extension guide](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world).

## Connect current-page AI guidance

In the toolbar popup, expand **Connect an AI guidance worker**, enter the worker origin (for example `https://guide.example.com`, without a path) and the operator-issued worker access token. Choose **Connect worker** and approve browser access to that worker origin. Optional permission patterns support HTTPS and loopback HTTP; only the origin you enter is requested, and browser host-match semantics apply. The extension verifies health and authentication before reporting connected. Do not use a model-provider key here.

The worker token stays in protected chrome.storage.session with TRUSTED_CONTEXTS access, never in website JavaScript, content scripts, localStorage or persistent disk storage. Connections are per tab and survive service-worker suspension. They clear on browser restart, tab closure, permission revocation or disconnect; reconnect through the popup when asked. The pending connection also survives the permission prompt closing the popup. This is a trusted single-operator connector, not public multi-user authentication. The background relay avoids website CORS restrictions; embedded widgets require explicit CORS configuration.

Enter a goal, optionally review the extracted context under settings, approve sharing for this request, then choose **Guide me**. Repeat replays the current instruction; Simplify and Explain focused field each need fresh context consent. Focus next step only moves focus. Page changes invalidate old guidance. Website result messages are observations, not proof that your overall task succeeded.

## Use with or without speech

The compact dock shows a goal, per-request context-sharing consent, Guide me, voice and navigation controls. Commands and settings are collapsed to keep the page manageable. The dock receives focus when opened. It has semantic labels, keyboard controls, focus indicators and a screen-reader status region.

**Start voice guide** opts into spoken orientation. Audio is off initially so it does not compete with VoiceOver/NVDA. **Mute spoken guidance** disables spoken output; **Stop and cancel** or Escape disables spoken mode, aborts listening, clears pending actions and detaches late callbacks. Speech stays off until Start voice guide is chosen again. Independent screen-reader audio is controlled separately by the screen reader. Language and speed are in Commands and settings. English/Hindi voice availability depends on the operating system/browser. Speech errors leave text and screen-reader controls available.

Choose **Listen**. If you have not allowed microphone commands, the settings open and focus the consent checkbox. The browser may request microphone permission and may send audio to its speech provider. By default, each Listen captures one command. Typed commands always work without microphone access.

Optional **Keep listening** in settings captures separate commands for up to two minutes or 20 commands. It pauses recognition before speaking and resumes after speech ends with a short delay to reduce self-echo. Errors or permission denial stop the session. This is a browser API feature, not a promise of uninterrupted recognition. Escape stops immediately. Choose Listen again to start another session.

Keyboard controls: Alt+Shift+M toggles listening after consent; Alt+Shift+Right/Left moves to the next/previous control; Escape stops and cancels. Browsers/screen readers may reserve shortcuts, so equivalent buttons and typed commands remain available.

Commands:

- `help`, `read page`, `read focused`, `list headings`, `list links`
- `next heading`, `previous heading`, `next link`, `previous link`
- `next form`, `previous form`, `next landmark`, `previous landmark`
- `next field`, `previous field`; `first` / `last` move to the first/last control
- `first heading`, `last link` and the same first/last forms for each navigation category
- `next`, `previous`, `focus LABEL` using an exact accessible label
- `click LABEL` or `click focused`, followed by `confirm` or `cancel`
- Focus an ordinary text field; `type TEXT`, then `confirm`
- `cursor left`, `cursor right`, `cursor home`, `cursor end` moves the caret in an ordinary editable text input/textarea, without editing or reading its value. Sensitive/read-only fields are excluded.
- Focus a single-choice dropdown; `list options`, `select OPTION LABEL`, then `confirm`. Disabled, ambiguous, changed and multi-select options are refused.
- `scroll down`, `scroll up`, `stop`
- Hindi aliases: `पढ़ो`, `पेज पढ़ो`, `अगला`, `पिछला`, `पुष्टि`, `रद्द`, `रुको`, `मदद`. Control names use the page’s actual labels; this is not free-form translation.

Every click, fill and option selection requests confirmation, expires after 20 seconds and rechecks the target. Ambiguous names are refused. Focus/caret movement does not require confirmation. Activation is not proof a workflow completed: check the website’s resulting status. Filling does not automatically submit a form.

## Boundaries and privacy

Password, file, hidden, email and marked sensitive fields are not fillable. Payment/purchase/delete/send and similar high-impact labels are refused by a conservative label rule. This is a guard, not a universal transaction classifier: websites can omit or mislabel sensitive controls, so use the site directly for consequential operations. Forms containing detected password or payment fields are not activated. Ordinary web links may navigate away only after confirmation.

Page reading uses visible headings and text; it excludes forms, editable fields and control values. Visible page text can still contain personal information, so avoid loudspeaker use in shared spaces. A guidance request sends the goal and reviewed, bounded visible page context to your worker/model only after you approve that request. The snapshot excludes field values and detected private/sensitive content, but ordinary visible text may still contain personal information; review it before sharing. Reading/navigation commands alone do not send page context to the worker. Speech services are provided by the browser/operating system; on-device processing is not guaranteed. No transcripts, page text or credentials are persisted by this extension.

It cannot make an inaccessible website fully accessible, interpret canvas-only content, access browser-protected pages or read cross-origin frames. Dynamic controls, incomplete accessible names and browser speech support vary. Keep your screen reader available. Assistive-technology user testing, microphone recognition and audio quality still require a human/device check. Synthetic speech tests exercise event handling, not recognition accuracy.

## Verification

`node scripts/extension-ui.mjs` from the project root exercises the injected dock on a synthetic page: no autoplay, reading exclusions, keyboard control traversal, confirmation/cancellation, stale-target rejection, duplicate-name refusal and sensitive-field blocking. It tests the content script in Chromium; it does not prove toolbar installation, real microphone recognition, audible quality, VoiceOver or compatibility with every external site.

Optional checks: `node scripts/extension-ui.mjs --native` loads the actual unpacked MV3 package and validates its service worker; toolbar activation is not simulated. `--real-site` performs only headings, links and page-reading on the previously authorised evisionindia.com without website clicks or form submissions.

`node scripts/companion-popup.mjs` opens the actual Chromium action popup and dispatches a real CDP pointer click to its Open button. Programmatically opening a popup does not grant activeTab; this check verifies the safe error in that situation, not a physical toolbar activation. A person must click the pinned toolbar icon on an ordinary page to verify that grant and approve the optional worker permission.

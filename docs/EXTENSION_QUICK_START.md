# WebGuide AI extension quick start

This ZIP installs the WebGuide AI companion in desktop Chrome or Edge. It is not a Chrome Web Store listing and does not install merely by opening a website. It is not a Safari or mobile extension.

## Install on a MacBook

1. Download webguide-companion.zip and double-click it in Finder.
2. Keep the extracted webguide-companion folder in a permanent location.
3. Open Chrome and type chrome://extensions in the address bar.
4. Turn on Developer mode. Choose Load unpacked.
5. Select the extracted folder containing manifest.json, then Select.
6. Open the browser Extensions menu (puzzle-piece icon). Pin WebGuide AI Browser Companion.

On Windows, use right-click > Extract All for step 1. The remaining Chrome steps are the same. In Edge, use edge://extensions.

## Cannot find Load unpacked or Pack extension?

Use the full desktop Chrome window on your Mac or Windows computer. Type `chrome://extensions` into its address bar and press Enter (Edge: `edge://extensions`). The puzzle-piece menu is only for already installed extensions. Safari, mobile browsers and in-app browser panels do not provide this Chrome setup screen.

Turn on **Developer mode at the top right** of the full extensions page. **Load unpacked** appears; select the extracted folder containing `manifest.json`. For the standalone companion ZIP, select `webguide-companion`. If you extracted the full app ZIP, select `webguide-ai/browser-extension`, not the outer app folder. The chosen folder itself must contain `manifest.json`. You do not need **Pack extension** to install this ZIP. If the toggle or button is unavailable because the browser is managed, ask the administrator; do not bypass the policy. For an immediate installation-free trial, use WebGuide's practice page and choose **Open WebGuide AI**.

The Website companion screen offers **Copy Chrome address** and **Copy Edge address**. Paste the copied address into the real browser address bar; a normal webpage cannot directly open these protected browser settings or detect that the extension is installed.

These installation steps follow [Chrome's official unpacked-extension guide](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world).

## Use it on a website

1. Open a normal HTTP or HTTPS website that you are authorised to use.
2. Click the pinned WebGuide icon, then Open companion on this page.
3. A WebGuide panel should appear on that website. Nothing should speak or record automatically.
4. Choose Read page, Next control or Previous control. Use Start voice guide if you want spoken output. Listen requires microphone permission and browser speech support.
5. Open Connection, commands and settings to type a command such as list headings or next link. Confirm is required for actions such as clicking or filling.
6. Stop and cancel or Escape stops WebGuide speech, microphone, queued actions and pending guidance. An independent screen reader has its own Stop key.

Repeat step 2 after navigating to a different page. Alt+Shift+W (Option+Shift+W on Mac) is the suggested popup shortcut; if it conflicts, assign another at chrome://extensions/shortcuts.

## AI guidance is optional and needs a backend

Reading, keyboard navigation and supported browser voice commands do not need an AI server. Goal-based AI instructions need an authenticated WebGuide worker connected to its model. This ZIP contains neither a hosted AI service nor a private access token. Do not enter your website password or a model-provider key.

The app’s automatic launcher connection does not connect the extension. If the complete app launcher is running on this same computer, use `http://127.0.0.1:4318` and type `c` then Return in its original window to copy the worker token. This replaces the clipboard; clear it after pasting. You must approve the extension’s requested worker-origin permission yourself.

Open Connect an AI guidance worker in the toolbar popup and use the worker URL and token provided by the operator. Allow access only to that worker origin. Review the visible page context and approve sharing for each AI request. If you have no worker URL/token yet, use reading/navigation and ask the operator to configure AI. Localhost refers to the recipient's own computer, not the sender's computer.

## If nothing appears

- Check the extension is installed and enabled in the same browser/profile where the website is open.
- Click the toolbar icon on the website itself, then Open companion on this page.
- If you cannot find the icon, open the Extensions menu and pin it.
- Browser settings, extension stores, protected viewers, inaccessible canvas controls and cross-origin embedded frames may not be supported.
- A downloaded ZIP must be extracted before Load unpacked. Keep the folder after installation.
- If an old version is installed, replace its files and choose Reload on its extension card. Refresh the website, then activate again.

Microphone capture, speech recognition, available Hindi voices and screen-reader behaviour depend on the device/browser. Mac VoiceOver and the recipient's microphone still need a target-device check. This is a tested prototype with documented limits, not a guarantee for every website.

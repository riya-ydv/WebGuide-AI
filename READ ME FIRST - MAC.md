# WebGuide AI — Mac sharing pack

Project owner: Riya Yadav. Packaged 18 November 2026.

## The normal path: one file
1. Save the ZIP in Documents and double-click it to extract. Keep the whole webguide-ai folder together.
2. Double-click Start WebGuide.command. It installs dependencies AND starts the app, worker, practice service and local AI. No separate Node, npm, Python or Ollama install is required.
3. Keep the Terminal window open. The first launch downloads several GB; allow at least 12 GB free disk space. Basic controls open first. Wait for Ready and the connected tab for AI.
4. Choose Start voice guide for speech. Choose Listen only when you want microphone input and approve the prompt. Typed commands remain available. Use Google Chrome for browser speech support.
5. Allow page reading before navigation and approve page-context sharing separately for AI guidance. Stop/Escape cancels assistance; it does not shut down the backend.
6. Type q then Return in the original launcher to stop its services. To reconnect/reopen later, double-click Start WebGuide.command again. Downloads are reused.

## Install dependencies ahead of a presentation
Double-click Install Dependencies.command. It installs Node, locked npm dependencies, Chromium, Ollama and the model, checks the services, and stops the services it started. Then use Start WebGuide.command for the presentation.

Terminal alternative (after changing into the extracted webguide-ai folder):

    /bin/bash "./Install Dependencies.command"

Start everything directly:

    /bin/bash "./Start WebGuide.command"

## If macOS blocks a command file
The scripts are not Apple-notarized. Inspect the downloaded project, then use Finder right-click > Open, or System Settings > Privacy & Security > Open Anyway when offered. Do not disable Gatekeeper globally. If execution permissions were lost, use the Terminal command above (bash reads the script), or run:

    chmod +x "Start WebGuide.command" "Install Dependencies.command" scripts/bootstrap-node-mac.sh

To change into the right folder: type cd followed by a space in Terminal, drag the extracted webguide-ai folder into the window, then press Return. Do not run scripts from inside the ZIP preview.

## Environment configuration
The included hidden .env is ready for local Ollama and contains NO shared token or provider key. Do not copy .env.example over it. The launcher generates a unique token and secures .env on first launch. No cloud AI key is needed. Finder Command+Shift+. shows hidden files, but editing .env is unnecessary for normal setup. After first launch, never forward this folder's .env, .webguide-local, databases or logs. Share the original unopened ZIP instead.

## Use another website
The workspace does not install an extension automatically. In desktop Chrome/Edge open chrome://extensions or edge://extensions, enable Developer mode, choose Load unpacked, and select browser-extension (the folder containing manifest.json). Keep that folder in place. Pin the extension and activate it on the website. Re-activate after full navigation. Safari and mobile extensions are not supported. See docs/EXTENSION_QUICK_START.md for exact activation, local AI connection and permission steps.

The extension connects separately: keep the launcher running, type c then Return in its original Terminal to copy the private worker token, open Connect an AI guidance worker in the popup, use http://127.0.0.1:4318 and paste the token. Approve only that worker origin. Clear the clipboard afterwards. Never use your website password as the worker token.

## Troubleshooting
- Download fails: check internet and free space, keep the error message, and relaunch. Verified downloads are reused; failed checksums are not executed.
- AI not connected during first setup: wait for Ready. After a tab refresh, click the launcher again to reconnect.
- Port occupied: close only your own previous WebGuide launcher. Do not terminate an unknown application or delete a live lock.
- No speech: check output volume, available system voices and browser support. Select Use my screen reader or use typed controls.
- Mic denied: allow access in browser site settings and macOS Privacy & Security > Microphone. Speech recognition may depend on browser-operated online services even though the AI is local.
- Slow model: close other heavy applications. Warm-up can take several minutes and Intel CPU inference can be slow.
- Extension absent: open a normal HTTP/HTTPS website in the same browser/profile, then activate the pinned icon. Protected pages and some embedded/canvas controls are unsupported.

## Included
App source, extension and embedded widget, local backend and SQLite code, auto installers, placeholder environment examples, setup/security guides, tests, Stage 4 comparison, final report (PDF/DOCX), editable 22-slide PPT and curated evidence. Documents retain their original dates; RELEASE_MANIFEST.json records this pack's source revision and file hashes. The environment file and Mac convenience scripts are pack-specific additions.

## Requirements and honest test boundary
macOS 14+, Apple Silicon or Intel, stable first-setup internet and adequate RAM/disk. No administrator-level global install is performed. Mac Gatekeeper and microphone prompts require the user's choice. The source and launcher logic have automated verification; this ZIP has NOT been run on a physical Mac, and recipient microphone/VoiceOver usability is not yet verified. This is not a guarantee for all websites or assistive technologies.

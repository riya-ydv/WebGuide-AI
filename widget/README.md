# WebGuide AI embedded widget

Serve the generated `public/webguide-widget.js` from your trusted website and add:

```html
<script src="/webguide-widget.js" data-webguide-worker="https://guide.example.com" defer></script>
```

Run `node scripts/build-assistance.mjs` after modifying the shared core or companion. The widget and unpacked extension use the same page-context capture, guidance client and dock source. Do not hand-edit generated bundles.

The floating **Open WebGuide AI** button opens the dock only after activation. It does not start audio or request a microphone. Enter a worker access token under **Connection, commands and settings → AI guidance connection**. Never embed a token in HTML, a script attribute or source control. This widget runs in the hosting page's JavaScript trust boundary: use it only on a trusted operator-controlled site. For arbitrary external sites, use the extension, whose token stays in its isolated background memory.

Configure the worker's `WEBGUIDE_ALLOWED_ORIGINS` to include the exact website origin (scheme, host and port), then restart the worker. HTTPS sites need an HTTPS worker; browser mixed-content restrictions still apply. The worker URL must be an origin without a path. The access token is the WebGuide worker bearer token, not a provider API key. This is a single-operator connector, not a public visitor authentication system.

Enter a goal, review the extracted context, approve sharing for that request and choose **Guide me**. Repeat uses the current instruction; Simplify and Explain focused field request new model guidance with fresh consent. Context excludes input values and detected sensitive/private elements, but visible page text may still be personal. Mark private sections `data-webguide-private`. The site title, origin/path, bounded visible text, headings and named controls are sent to the configured worker/model. No context or token is persisted by the widget.

Page/field changes invalidate guidance; Stop cancels requests, actions and app speech. A request times out after 65 seconds. Local deterministic navigation remains available if the model is unavailable. Every click, fill and select action requires confirmation and stale-target revalidation. Observed page receipts are reported as website statements, not automatic task completion.

Open `/demo-service.html` on the local app to practice service hours, accessibility details and a synthetic support request. The demo submits no real request. Passwords, payments, protected pages, cross-origin frames and canvas-only interfaces are not supported. Voice recognition and installed Hindi/English voices depend on the browser/OS; text and screen-reader controls remain available. Browser speech may use a remote speech service.

If guidance fails, check the worker URL, token, service availability and CORS origin. For a stale page, approve a fresh snapshot. For no audio, explicitly start spoken guidance and check OS/browser output; Stop intentionally leaves speech disabled until restarted. Actual microphone recognition, VoiceOver and blind-user usability need human/device testing.
`node scripts/widget-ui.mjs` tests the embedded workflow with a stubbed guidance response; `node scripts/widget-ui.mjs --live` uses the configured local worker and real model. Reports identify the mode. The controlled demo never sends a real support request.

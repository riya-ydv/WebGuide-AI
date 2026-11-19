(() => {
  const existing = document.getElementById("webguide-companion");
  if (existing) {
    existing.shadowRoot?.querySelector("button")?.focus();
    return;
  }
  const host = document.createElement("aside");
  host.id = "webguide-companion";
  host.setAttribute("data-webguide-ui", "");
  host.setAttribute("aria-label", "WebGuide AI page assistant");
  const shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML = `<style>
  :host{all:initial;position:fixed!important;right:12px!important;bottom:12px!important;z-index:2147483647!important;max-width:calc(100vw - 24px)!important;color-scheme:light;font:16px/1.5 system-ui,sans-serif}
  *{box-sizing:border-box}section{width:390px;max-width:calc(100vw - 24px);max-height:75vh;overflow:auto;background:#fff;color:#11283e;border:1px solid #b9c9db;border-radius:16px;padding:18px;box-shadow:0 14px 48px #102a4340}h2{margin:0 0 8px;font-size:22px}p{margin:8px 0}button,input,select{font:inherit}button{min-height:44px;padding:8px 12px;background:#eef4f7;color:#142c40;border:2px solid #cbd8e0;border-radius:7px;cursor:pointer}button:disabled{opacity:.6;cursor:default}button:focus-visible,input:focus-visible,select:focus-visible{outline:3px solid #b44700;outline-offset:3px}.row{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0}input[type=text],select{width:100%;border:2px solid #4b657b;padding:9px;border-radius:6px;color:#11283e;background:white}label{display:block;margin:10px 0}small{font-size:13px}.output{border-left:4px solid #176f61;padding:8px;background:#eaf6f3;white-space:pre-wrap;overflow-wrap:anywhere}.help{font-size:14px}.output{max-height:10rem;overflow:auto}summary{cursor:pointer;min-height:44px;padding:10px 0}#speech{background:#176a72;border-color:#176a72;color:white}#read{background:#142c40;color:white;border-color:#142c40}#stop{background:white;border-color:#9caebc}.optional-heading{font-size:16px;margin:20px 0 8px;border-top:1px solid #d7e1e8;padding-top:14px}.goalbox{font-size:14px}.goalbox button{background:#fff}.brandline{display:flex;align-items:center;justify-content:space-between;gap:12px}.tag{font-size:12px;background:#e8f0fb;color:#194b77;padding:4px 8px;border-radius:20px}.secondary{background:white;color:#194b77;border-color:#ccd9e7}.goalbox{padding:12px;background:#f0f5fb;border-radius:10px}.goalbox label{margin-top:0;font-weight:650}.stepcount{font-size:13px;color:#46617d}#guidance-message{white-space:pre-wrap}#guidance-panel{border-top:1px solid #cddae7;margin-top:14px;padding-top:14px}#context-preview{max-height:12rem;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;font-size:13px}input[type=password],input[type=url]{width:100%;border:2px solid #4b657b;padding:9px;border-radius:6px}button{letter-spacing:.01em}[hidden]{display:none!important}
  </style><section aria-labelledby="wg-title"><div class="brandline"><h2 id="wg-title">WebGuide AI</h2><span class="tag">PAGE ASSISTANT</span></div><div class="row"><button id="speech" aria-pressed="false">Start voice guide</button><button id="mic">Listen</button><button id="stop">Stop and cancel</button></div><div class="row"><button id="read">Read page</button><button id="next">Next control</button><button id="previous">Previous control</button><button id="close">Close companion</button></div><div class="row" id="confirmation" hidden><button id="confirm">Confirm action</button><button id="cancel">Cancel action</button></div><label class="help"><input id="page-access" type="checkbox"> Allow WebGuide to read and navigate this page until Stop or navigation.</label><p id="status" class="output" role="status" aria-live="polite" aria-atomic="true">Ready in screen-reader mode. Tab explores controls; Enter chooses; Escape stops WebGuide. Choose Start voice guide for audio. No microphone is active.</p><details id="settings"><summary>Connection, commands and settings</summary><form id="goal-form" class="goalbox"><p class="help">A connected worker is needed only for AI instructions. Allow page reading to use local reading and navigation. Connection help is in settings.</p><label>Your goal on this page<input id="goal" type="text" maxlength="500" placeholder="For example: find the service hours"></label><label class="help"><input id="share-context" type="checkbox"> Send this page’s selected text and controls to my guidance worker for this request.</label><button id="ask-guidance">Guide me</button></form><div id="guidance-panel" hidden><p class="stepcount" id="guidance-state">Page guidance</p><p id="guidance-message"></p><div class="row"><button id="repeat-guidance" class="secondary">Repeat</button><button id="simplify-guidance" class="secondary">Simplify</button><button id="focus-step" class="secondary">Focus next step</button></div></div><details><summary>AI guidance connection</summary><p id="connection-help" class="help">For an embedded widget, enter your worker URL and token. Its operator must allow this website origin. Tokens stay only in this page’s memory.</p><div id="widget-connection"><label>Guidance worker URL<input id="guidance-endpoint" type="url" placeholder="http://127.0.0.1:4318" autocomplete="off"></label><label>Worker access token<input id="guidance-token" type="password" autocomplete="off"></label></div><button id="disconnect-guidance" class="secondary">Disconnect guidance</button></details><div class="row"><button id="explain-field" class="secondary">Explain focused field</button><button id="review-context" class="secondary">Review page context</button></div><pre id="context-preview" hidden></pre><form id="command-form"><label>Type a command<input id="command" type="text" maxlength="500" autocomplete="off" placeholder="For example: next heading"></label><button>Run command</button></form><label>Speech language<select id="language"><option value="en-IN">English</option><option value="hi-IN">हिन्दी</option></select></label><label>Time to confirm an action<select id="confirm-time"><option value="120" selected>2 minutes</option><option value="600">10 minutes</option></select></label><label>Speaking speed<select id="rate"><option value="0.8">Slow</option><option value="1" selected>Normal</option><option value="1.25">Fast</option></select></label><label><input type="checkbox" id="consent"> Allow microphone commands. My browser may send speech to its speech service.</label><label><input type="checkbox" id="continuous"> Keep listening between commands for up to two minutes or 20 commands. Pause while WebGuide speaks.</label><details><summary>Command examples and privacy</summary><p class="help">Read page; list headings; list links; next or previous heading, link, form, landmark or field; first; last; next; previous; focus LABEL; click LABEL; type TEXT; list options; select OPTION; cursor left, right, home or end; confirm; cancel; scroll down; scroll up; help. Hindi: पढ़ो, अगला, पिछला, पुष्टि, रद्द, मदद. Every click, fill and selection needs confirmation. Escape stops listening and speech. Alt+Shift+M toggles listening; Alt+Shift+Right or Left moves to the next or previous control. Screen readers may reserve shortcuts; use the buttons or typed commands if needed. AI page guidance sends only the reviewed context when you approve that request. Navigation commands stay local. Browser voice services may process audio. No passwords, payments, file or hidden fields. Top-level page only.</p></details></details></section>`;
  // Present local reading controls before optional model guidance, without changing handlers.
  const panel = shadow.querySelector("section");
  const brand = shadow.querySelector(".brandline");
  const localIntro = document.createElement("p");
  localIntro.className = "help";
  localIntro.textContent = "Read and move around this page. Voice is off until you start it.";
  brand.after(localIntro);
  const voiceRow = shadow.getElementById("speech").parentElement;
  const navigationRow = shadow.getElementById("read").parentElement;
  const statusPanel = shadow.getElementById("status");
  localIntro.after(voiceRow, navigationRow, shadow.getElementById("confirmation"), statusPanel);
  const aiTitle = document.createElement("h3");
  aiTitle.className = "optional-heading";
  aiTitle.textContent = "Optional AI guidance";
  shadow.getElementById("goal-form").before(aiTitle);
  panel.setAttribute(
    "aria-description",
    "Local voice and reading controls first; optional connected AI guidance below.",
  );
  document.documentElement.append(host);
  const $ = (id) => shadow.getElementById(id);
  const core = window.WebGuidePageAssistance;
  const extensionMode = typeof chrome !== "undefined" && Boolean(chrome.runtime?.id);
  let consentPermit;
  let micPermit = false,
    continuousPermit = false,
    trustedSubmit = null;
  let guidanceController,
    guidanceContext,
    guidanceResult,
    guidanceStale = false,
    guidanceStep = -1,
    contextTimer,
    outcomeTimer;
  if (extensionMode) {
    $("widget-connection").hidden = true;
    $("connection-help").textContent =
      "Connect your trusted worker from the extension toolbar popup. The backend token stays in extension memory, outside website code. Approve page context sharing for each request.";
  } else {
    const script = document.querySelector("script[data-webguide-worker]");
    if (script) $("guidance-endpoint").value = script.getAttribute("data-webguide-worker") || "";
  }
  function cancelGuidance() {
    guidanceController?.abort();
    guidanceController = undefined;
    $("ask-guidance").disabled = false;
    if (extensionMode) chrome.runtime.sendMessage({ type: "WEBGUIDE_CANCEL" }).catch(() => {});
  }
  function receiptText() {
    return Array.from(
      document.querySelectorAll("[role=status],[role=alert],[data-webguide-result]"),
    )
      .filter(visible)
      .filter(
        (e) => !e.closest("[data-webguide-ui],[data-webguide-voice],[data-webguide-guidance]"),
      )
      .map((e) => (core ? core.readText(e, 1000) : ""))
      .filter(Boolean)
      .join(" ")
      .slice(0, 1000);
  }
  function observeOutcome(before) {
    clearTimeout(outcomeTimer);
    outcomeTimer = setTimeout(() => {
      if (disposed || !pageAccess) return;
      const after = receiptText();
      report(
        after && after !== before
          ? `Website reported: ${after}. Verify these details before continuing.`
          : "The action was dispatched. No new website result was observed. The task is not marked complete.",
      );
    }, 250);
  }
  let pageAccess = false;
  let allowedUrl = "";
  function requirePageAccess() {
    if (pageAccess && allowedUrl !== location.href) revokePageAccess();
    if (pageAccess) return true;
    $("page-access").focus();
    report(
      "Allow page reading first using the checkbox, or say Allow page reading. No page has been scanned.",
    );
    return false;
  }
  function revokePageAccess() {
    pageAccess = false;
    $("page-access").checked = false;
    $("share-context").checked = false;
    consentPermit = undefined;
    guidanceContext = undefined;
    guidanceResult = undefined;
    cancelGuidance();
  }
  function invalidateGuidance() {
    if (pageAccess && allowedUrl !== location.href) revokePageAccess();
    if (!pageAccess || !core || (!guidanceContext && !guidanceResult)) return;
    const current = core.capture();
    if (guidanceContext && current.revision !== guidanceContext.revision) {
      cancelGuidance();
      guidanceStale = true;
      $("guidance-state").textContent =
        "Page changed — refresh guidance before following these steps.";
      $("focus-step").disabled = true;
    }
  }
  async function askGuidance(mode = "guide") {
    if (!requirePageAccess()) return;
    if (!core)
      return report("Page context support is unavailable. Reload the widget or extension.");
    if (
      !$("share-context").checked ||
      !consentPermit ||
      consentPermit.goal !== $("goal").value ||
      consentPermit.revision !== core.capture().revision ||
      Date.now() - consentPermit.time > 60000
    ) {
      $("share-context").focus();
      return report(
        "Approve sharing this page’s context for this request. You can review it in settings first.",
      );
    }
    const goal =
      mode === "explain"
        ? `Explain this focused field or control: ${lastFocused && visible(lastFocused) ? label(lastFocused) : "No control selected"}`
        : $("goal").value.trim();
    if (!goal) return report("Enter a goal for this page first.");
    if (mode === "explain" && (!lastFocused || !visible(lastFocused) || sensitive(lastFocused)))
      return report("Focus an ordinary field first. Sensitive fields cannot be explained.");
    cancelGuidance();
    const controller = new AbortController();
    guidanceController = controller;
    const deadline = setTimeout(() => {
      controller.abort();
      if (!disposed) {
        $("guidance-state").textContent = "Guidance timed out. Try again.";
        $("ask-guidance").disabled = false;
      }
    }, 65000);
    guidanceContext = core.capture();
    guidanceStale = false;
    $("share-context").checked = false;
    consentPermit = undefined;
    $("ask-guidance").disabled = true;
    $("guidance-panel").hidden = false;
    $("guidance-state").textContent = "Getting guidance from the current page…";
    const context = guidanceContext;
    const request = {
      goal,
      mode,
      language: $("language").value.startsWith("hi") ? "hi" : "en",
      context,
    };
    if (mode !== "guide" && guidanceResult) request.previousInstruction = guidanceResult.message;
    try {
      let result;
      if (extensionMode) {
        const response = await chrome.runtime.sendMessage({ type: "WEBGUIDE_GUIDANCE", request });
        if (!response?.ok) throw new Error(response?.error || "Guidance worker did not respond.");
        result = response.data;
      } else
        result = await core.requestGuidance({
          ...request,
          endpoint: $("guidance-endpoint").value,
          token: $("guidance-token").value,
          signal: controller.signal,
        });
      if (controller.signal.aborted || disposed || core.capture().revision !== context.revision)
        return;
      guidanceResult = result;
      guidanceStep = -1;
      $("guidance-state").textContent =
        result.status === "insufficient-context"
          ? "More page evidence is needed"
          : "Current-page guidance — task not yet completed";
      $("guidance-message").textContent = [
        result.message,
        ...result.steps.map((step, index) => `${index + 1}. ${step.instruction}`),
      ].join("\n");
      $("focus-step").disabled = !result.steps.some((step) => step.targetId);
      report(result.message);
    } catch (error) {
      if (!controller.signal.aborted && !disposed) {
        $("guidance-state").textContent = "Guidance unavailable";
        report(error.message || "Guidance failed. Navigation controls still work.");
      }
    } finally {
      clearTimeout(deadline);
      if (guidanceController === controller) {
        guidanceController = undefined;
        $("ask-guidance").disabled = false;
      }
    }
  }
  const contextObserver = new MutationObserver((records) => {
    if (
      records.every(
        (record) =>
          record.target instanceof Element &&
          record.target.closest(
            "[data-webguide-ui],[data-webguide-voice],[data-webguide-guidance]",
          ),
      )
    )
      return;
    clearTimeout(contextTimer);
    contextTimer = setTimeout(invalidateGuidance, 150);
  });
  contextObserver.observe(document.body, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
  });
  const contextPoll = setInterval(invalidateGuidance, 1000);
  window.addEventListener("popstate", invalidateGuidance);
  window.addEventListener("hashchange", invalidateGuidance);
  let enabled = false,
    recognition,
    listening = false,
    disposed = false,
    pending,
    timer,
    cursor;
  let sessionActive = false,
    sessionEnd = 0,
    commandCount = 0,
    resumeTimer,
    sessionTimer,
    speaking = false;
  let speechEpoch = 0;
  let currentUtterance;
  let lastFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const normal = (value) =>
    String(value || "")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/[.!?।]+$/gu, "")
      .toLocaleLowerCase();
  const visible = (element) =>
    element instanceof HTMLElement &&
    element.isConnected &&
    !element.closest("[hidden],[inert],[aria-hidden='true']") &&
    !element.disabled &&
    element.getAttribute("aria-disabled") !== "true" &&
    getComputedStyle(element).display !== "none" &&
    getComputedStyle(element).visibility !== "hidden" &&
    element.getClientRects().length > 0 &&
    element.getBoundingClientRect().width > 0 &&
    element.getBoundingClientRect().height > 0 &&
    !host.contains(element);
  const label = (element) =>
    (
      element
        .getAttribute("aria-labelledby")
        ?.split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent || "")
        .join(" ") ||
      element.getAttribute("aria-label") ||
      Array.from(element.labels || [])
        .map((l) => l.textContent)
        .join(" ") ||
      (element instanceof HTMLInputElement
        ? element.getAttribute("placeholder")
        : element.innerText) ||
      element.getAttribute("title") ||
      element.getAttribute("alt") ||
      "Unnamed control"
    )
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 180);
  const controls = () =>
    Array.from(
      document.querySelectorAll(
        "a[href],button,input,textarea,select,[role=button],[role=link],[tabindex]",
      ),
    )
      .filter(visible)
      .filter((e) => e.tabIndex >= 0);
  const sensitive = (element) =>
    /password|file|hidden/.test(element.getAttribute("type") || "") ||
    /password|passcode|otp|one.time|credit|card.?number|cvv|cvc|payment|bank|account.?number|social.?security|secret|token/i.test(
      [
        label(element),
        element.getAttribute("name"),
        element.getAttribute("autocomplete"),
        element.id,
      ].join(" "),
    );
  const risky = (element) =>
    sensitive(element) ||
    /\b(pay|buy|purchase|checkout|transfer|delete|remove|unsubscribe|sign.?out|log.?out|send|publish|subscribe|confirm order)\b/i.test(
      label(element),
    );
  let speechStartTimer;
  function stopSpeech() {
    clearTimeout(speechStartTimer);
    speaking = false;
    speechEpoch += 1;
    if (currentUtterance) {
      currentUtterance.onend = null;
      currentUtterance.onerror = null;
      currentUtterance = undefined;
    }
    window.speechSynthesis?.cancel();
  }
  function resumeListening() {
    clearTimeout(resumeTimer);
    if (!sessionActive || disposed || speaking || recognition || !micPermit) return;
    if (Date.now() >= sessionEnd || commandCount >= 20) {
      sessionActive = false;
      $("status").textContent = "Listening session finished. Choose Listen to start again.";
      return;
    }
    resumeTimer = setTimeout(() => {
      if (sessionActive && !speaking && !recognition) startRecognition();
    }, 500);
  }
  function useScreenReaderOutput() {
    enabled = false;
    $("status").setAttribute("aria-live", "polite");
    $("speech").setAttribute("aria-pressed", "false");
    $("speech").textContent = "Start voice guide";
  }
  function say(text) {
    if (!enabled) {
      resumeListening();
      return;
    }
    if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) {
      useScreenReaderOutput();
      sessionActive = false;
      $("status").textContent =
        text + " Spoken audio is unavailable. Use your screen reader or text controls.";
      return;
    }
    stopSpeech();
    speaking = true;
    recognition?.abort();
    const epoch = speechEpoch;
    const chunks = text.match(/[^.!?\n]{1,240}[.!?\n]?/g) || [text];
    let index = 0;
    function failed() {
      if (epoch !== speechEpoch || disposed) return;
      clearTimeout(speechStartTimer);
      stopSpeech();
      useScreenReaderOutput();
      speaking = false;
      sessionActive = false;
      clearTimeout(resumeTimer);
      $("status").textContent =
        text + " Spoken audio is unavailable. Use your screen reader or text controls.";
    }
    function next() {
      if (disposed || !enabled || epoch !== speechEpoch) return;
      if (index >= chunks.length) {
        speaking = false;
        resumeListening();
        return;
      }
      const u = new SpeechSynthesisUtterance(chunks[index++]);
      u.lang = $("language").value;
      u.rate = Number($("rate").value);
      const voices = speechSynthesis.getVoices();
      u.voice = voices.find((v) => v.lang.toLowerCase().startsWith(u.lang.split("-")[0])) || null;
      currentUtterance = u;
      u.onstart = () => {
        if (epoch === speechEpoch) clearTimeout(speechStartTimer);
      };
      u.onend = () => {
        if (epoch !== speechEpoch) return;
        clearTimeout(speechStartTimer);
        next();
      };
      u.onerror = failed;
      try {
        speechStartTimer = setTimeout(failed, 4000);
        speechSynthesis.resume?.();
        speechSynthesis.speak(u);
      } catch {
        failed();
      }
    }
    next();
  }
  function report(text) {
    $("status").textContent = text;
    say(text);
  }
  function cancelPending() {
    pending = undefined;
    clearTimeout(timer);
    $("confirmation").hidden = true;
  }
  function stop() {
    revokePageAccess();
    const confirmationTarget = pending?.element;
    const returnFocus = $("confirmation").contains(shadow.activeElement);
    consentPermit = undefined;
    trustedSubmit = null;
    $("share-context").checked = false;
    cancelGuidance();
    clearTimeout(outcomeTimer);
    enabled = false;
    $("status").setAttribute("aria-live", "polite");
    $("speech").setAttribute("aria-pressed", "false");
    $("speech").textContent = "Start voice guide";
    sessionActive = false;
    clearTimeout(resumeTimer);
    clearTimeout(sessionTimer);
    cancelPending();
    if (recognition) {
      const previous = recognition;
      recognition = undefined;
      previous.onstart = null;
      previous.onresult = null;
      previous.onerror = null;
      previous.onend = null;
      previous.abort();
    }
    listening = false;
    $("mic").textContent = "Listen";
    stopSpeech();
    if (returnFocus && confirmationTarget?.isConnected) confirmationTarget.focus();
    $("status").textContent = "Stopped. Pending action cancelled.";
  }
  function focusTarget(element) {
    if (!visible(element)) return report("That control is no longer available.");
    element.focus({ preventScroll: true });
    if (document.activeElement !== element) {
      element.setAttribute("tabindex", "-1");
      element.focus({ preventScroll: true });
    }
    element.scrollIntoView({ block: "center", behavior: "instant" });
    lastFocused = element;
    report(label(element) + (element.tagName ? `. ${element.tagName.toLowerCase()}.` : ""));
  }
  function findTarget(name) {
    const matches = controls().filter((e) => normal(label(e)) === normal(name));
    if (matches.length !== 1) {
      report(
        matches.length
          ? "More than one control has that name. Use next or previous to focus the intended control, then say click focused."
          : "No visible control has that exact name. Say list links or next to explore.",
      );
      return null;
    }
    return matches[0];
  }
  function matchingOptions(element, text) {
    return Array.from(element.options || []).filter(
      (option) =>
        normal(option.label) === normal(text) &&
        !option.disabled &&
        !option.hidden &&
        !option.closest("optgroup[disabled]"),
    );
  }
  function propose(element, kind, text) {
    cancelPending();
    if (!visible(element) || risky(element))
      return report(
        "That action is unavailable or sensitive. Use the website’s own accessible controls.",
      );
    if (
      kind === "click" &&
      element.closest("form")?.querySelector('input[type=password],input[autocomplete="cc-number"]')
    )
      return report("This form contains sensitive fields. Use the website directly.");
    if (kind === "click" && element instanceof HTMLAnchorElement) {
      let url;
      try {
        url = new URL(element.href);
      } catch {
        return report("This link has an invalid address.");
      }
      if (!["http:", "https:"].includes(url.protocol))
        return report("Only ordinary web links can be opened.");
    }
    pending = {
      element,
      kind,
      text,
      option: kind === "select" ? matchingOptions(element, text)[0] : undefined,
      optionValue: kind === "select" ? matchingOptions(element, text)[0]?.value : undefined,
      label: label(element),
      href: element.getAttribute("href"),
      type: element.getAttribute("type"),
      page: location.href,
      formAction: element.closest("form")?.action,
      formMethod: element.closest("form")?.method,
    };
    $("confirmation").hidden = false;
    $("confirm").focus();
    const confirmationSeconds = Number($("confirm-time").value) === 600 ? 600 : 120;
    timer = setTimeout(() => {
      cancelPending();
      report("Confirmation expired. Request the action again.");
    }, confirmationSeconds * 1000);
    report(
      `${kind === "type" ? "Fill" : kind === "select" ? "Select " + text + " in" : "Activate"} ${pending.label}${kind === "type" ? " with the text you provided" : ""}? Say confirm or cancel. Expires in ${confirmationSeconds / 60} minutes.`,
    );
  }
  function confirm() {
    const plan = pending;
    cancelPending();
    if (!plan) return report("There is no action to confirm.");
    const el = plan.element;
    if (
      plan.page !== location.href ||
      !visible(el) ||
      risky(el) ||
      label(el) !== plan.label ||
      el.getAttribute("href") !== plan.href ||
      el.getAttribute("type") !== plan.type ||
      el.closest("form")?.action !== plan.formAction ||
      el.closest("form")?.method !== plan.formMethod ||
      (plan.kind === "click" &&
        el.closest("form")?.querySelector('input[type=password],input[autocomplete="cc-number"]'))
    )
      return report("The page or target changed. Request the action again.");
    el.focus({ preventScroll: true });
    if (plan.kind === "select") {
      const options = matchingOptions(el, plan.text);
      if (
        !(el instanceof HTMLSelectElement) ||
        el.multiple ||
        options.length !== 1 ||
        options[0] !== plan.option ||
        options[0].value !== plan.optionValue
      )
        return report("The option changed or is unavailable. Request the action again.");
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set.call(
        el,
        plan.optionValue,
      );
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      report("Option selected. This does not establish task completion.");
    } else if (plan.kind === "type") {
      if (
        !(
          (el instanceof HTMLInputElement && ["text", "search", "url"].includes(el.type)) ||
          el instanceof HTMLTextAreaElement
        ) ||
        el.readOnly
      )
        return report("This field cannot be filled safely.");
      const prototype =
        el instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
      Object.getOwnPropertyDescriptor(prototype, "value").set.call(el, plan.text);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      report("Text entered. The form has not been submitted.");
    } else {
      const before = receiptText();
      el.click();
      observeOutcome(before);
      report("Action requested. Waiting for an observed website result.");
    }
  }
  function navigateKind(selector, direction) {
    cancelPending();
    const items = Array.from(document.querySelectorAll(selector)).filter(visible);
    if (!items.length) return report("No visible items of that kind found.");
    const current = items.indexOf(lastFocused);
    const index =
      direction === "first"
        ? 0
        : direction === "last"
          ? items.length - 1
          : current < 0
            ? direction === "previous"
              ? items.length - 1
              : 0
            : (current + (direction === "previous" ? -1 : 1) + items.length) % items.length;
    focusTarget(items[index]);
  }
  function moveCaret(direction) {
    const el = lastFocused;
    if (
      !visible(el) ||
      sensitive(el) ||
      !(
        (el instanceof HTMLInputElement && ["text", "search", "url"].includes(el.type)) ||
        el instanceof HTMLTextAreaElement
      ) ||
      el.readOnly
    )
      return report("Focus an ordinary editable text field first. Sensitive fields are excluded.");
    const start = el.selectionStart ?? 0,
      end = el.selectionEnd ?? start;
    const position =
      direction === "home"
        ? 0
        : direction === "end"
          ? el.value.length
          : direction === "left"
            ? Math.max(0, start - (start === end ? 1 : 0))
            : Math.min(el.value.length, end + (start === end ? 1 : 0));
    el.focus({ preventScroll: true });
    el.setSelectionRange(position, position);
    report(`Cursor moved ${direction}. Position ${position}.`);
  }
  function execute(raw) {
    if (raw.length > 500) return report("Command is too long. Use 500 characters or fewer.");
    const command = normal(raw);
    if (!command) return;
    if (command !== "confirm" && command !== "पुष्टि") cancelPending();
    if (["stop", "cancel", "रद्द", "रुको"].includes(command)) {
      stop();
      return;
    }
    if (["allow page reading", "पेज पढ़ने की अनुमति"].includes(command)) {
      pageAccess = true;
      allowedUrl = location.href;
      $("page-access").checked = true;
      return report("Page reading allowed. Say Read page or Next. Stop revokes permission.");
    }
    if (!["help", "मदद"].includes(command) && !requirePageAccess()) return;
    if (["allow ai guidance", "एआई की अनुमति"].includes(command)) {
      $("share-context").checked = true;
      consentPermit = {
        goal: $("goal").value,
        revision: core.capture().revision,
        time: Date.now(),
      };
      return report("AI sharing allowed for this goal once. Choose Guide me.");
    }
    if (["confirm", "पुष्टि"].includes(command)) return confirm();
    if (command === "repeat instruction" || command === "repeat guidance") {
      if (guidanceResult && !guidanceStale) return report(guidanceResult.message);
      return report("No current guidance to repeat. Request fresh page guidance.");
    }
    if (command === "simplify") return void askGuidance("simplify");
    if (command === "explain field") return void askGuidance("explain");
    if (command.startsWith("guide me ")) {
      $("goal").value = raw.trim().slice(9);
      return void askGuidance("guide");
    }
    if (["help", "मदद"].includes(command))
      return report(
        "Say next or previous heading, link, form, landmark or field. Say first or last for controls. Say read page, focus and a label, click focused, type and your text, list options, select and an option, or cursor left, right, home or end. Actions need confirm or cancel. Escape stops guidance.",
      );
    if (["read page", "read", "पढ़ो", "पेज पढ़ो"].includes(command)) {
      const scope = document.querySelector("main,[role=main]") || document.body;
      const items = Array.from(scope.querySelectorAll("h1,h2,h3,h4,h5,h6,p,li,article,section"))
        .filter(visible)
        .filter(
          (e) =>
            !e.closest('form,input,textarea,select,[contenteditable="true"]') &&
            !e.querySelector("p,li,h1,h2,h3,input,textarea,select,[contenteditable]"),
        );
      const text = items
        .map((e) => {
          const copy = e.cloneNode(true);
          const originals = Array.from(e.querySelectorAll("*"));
          const copies = Array.from(copy.querySelectorAll("*"));
          originals.forEach((node, index) => {
            const style = getComputedStyle(node);
            if (style.display === "none" || style.visibility === "hidden") copies[index].remove();
          });
          copy
            .querySelectorAll(
              'form,input,textarea,select,script,style,[hidden],[inert],[aria-hidden="true"],[contenteditable]',
            )
            .forEach((node) => node.remove());
          return copy.textContent.trim();
        })
        .filter(Boolean)
        .join("\n")
        .slice(0, 10000);
      return report(text || "No readable visible text found. Try list headings or list links.");
    }
    if (command === "list headings" || command === "list links") {
      const els = Array.from(
        document.querySelectorAll(command === "list headings" ? "h1,h2,h3,h4,h5,h6" : "a[href]"),
      ).filter(visible);
      return report(
        els
          .slice(0, 40)
          .map((e, i) => `${i + 1}. ${label(e)}`)
          .join("\n") || "No visible items found.",
      );
    }
    const kindMatch = /^(next|previous|first|last) (heading|link|form|landmark|field)$/.exec(
      command,
    );
    if (kindMatch) {
      const selectors = {
        heading: "h1,h2,h3,h4,h5,h6,[role=heading]",
        link: "a[href],[role=link]",
        form: "form,[role=form]",
        landmark:
          "main,nav,header,footer,aside,[role=main],[role=navigation],[role=banner],[role=contentinfo],[role=complementary],[role=region]",
        field: "input,textarea,select",
      };
      return navigateKind(selectors[kindMatch[2]], kindMatch[1]);
    }
    const caretMatch = /^(?:cursor|caret) (left|right|home|end)$/.exec(command);
    if (caretMatch) return moveCaret(caretMatch[1]);
    if (
      [
        "next",
        "next control",
        "previous",
        "previous control",
        "first",
        "first control",
        "last",
        "last control",
        "अगला",
        "पिछला",
      ].includes(command)
    ) {
      const items = controls();
      if (!items.length) return report("No visible controls found.");
      const index = items.indexOf(lastFocused);
      const backwards = ["previous", "previous control", "पिछला"].includes(command);
      cursor = command.startsWith("first")
        ? 0
        : command.startsWith("last")
          ? items.length - 1
          : index < 0
            ? backwards
              ? items.length - 1
              : 0
            : (index + (backwards ? -1 : 1) + items.length) % items.length;
      return focusTarget(items[cursor]);
    }
    if (command === "read focused")
      return lastFocused && visible(lastFocused)
        ? report(label(lastFocused))
        : report("No page control is focused.");
    if (command === "scroll down" || command === "scroll up") {
      window.scrollBy({
        top: innerHeight * 0.75 * (command === "scroll down" ? 1 : -1),
        behavior: "instant",
      });
      return report(command === "scroll down" ? "Scrolled down." : "Scrolled up.");
    }
    if (command.startsWith("focus ")) {
      const target = findTarget(raw.trim().slice(6));
      if (target) focusTarget(target);
      return;
    }
    if (command.startsWith("click ") || command.startsWith("open ")) {
      const name = raw.trim().slice(command.startsWith("click ") ? 6 : 5);
      const target = normal(name) === "focused" ? lastFocused : findTarget(name);
      if (target) propose(target, "click");
      return;
    }
    if (command === "list options") {
      if (!(lastFocused instanceof HTMLSelectElement) || !visible(lastFocused))
        return report("Focus a dropdown first.");
      return report(
        Array.from(lastFocused.options)
          .filter((o) => !o.disabled && !o.hidden && !o.closest("optgroup[disabled]"))
          .map((o) => o.label)
          .join(". ") || "No enabled options found.",
      );
    }
    if (command.startsWith("select ")) {
      if (
        !(lastFocused instanceof HTMLSelectElement) ||
        !visible(lastFocused) ||
        lastFocused.multiple
      )
        return report("Focus a single-choice dropdown first.");
      const text = raw.trim().slice(7);
      if (matchingOptions(lastFocused, text).length !== 1)
        return report("Use the exact name of one enabled option. Say list options to hear them.");
      return propose(lastFocused, "select", text);
    }
    if (command.startsWith("type ")) {
      const target = lastFocused;
      if (
        !target ||
        !(
          (target instanceof HTMLInputElement && ["text", "search", "url"].includes(target.type)) ||
          target instanceof HTMLTextAreaElement
        ) ||
        target.readOnly
      )
        return report(
          "Focus an ordinary text field first. Password, email, payment and file fields are not supported.",
        );
      propose(target, "type", raw.trim().slice(5));
      return;
    }
    report(
      "Command not understood. Say help or use the Commands and privacy list. No action taken.",
    );
  }
  function startRecognition() {
    if (disposed || recognition || speaking || !micPermit) return;
    const API = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!API) {
      sessionActive = false;
      report(
        "Speech recognition is unavailable in this browser. Use typed commands and spoken guidance.",
      );
      return;
    }
    const r = new API();
    recognition = r;
    r.lang = $("language").value;
    r.continuous = false;
    r.interimResults = false;
    r.onstart = () => {
      if (disposed || recognition !== r) return;
      listening = true;
      $("mic").textContent = "Stop listening";
      $("status").textContent = "Listening. Say one command.";
    };
    r.onresult = (e) => {
      if (disposed || recognition !== r) return;
      commandCount += 1;
      const text = e.results[0][0].transcript;
      r.abort();
      execute(text);
    };
    r.onerror = (e) => {
      if (disposed || recognition !== r || e.error === "aborted") return;
      sessionActive = false;
      clearTimeout(resumeTimer);
      report(`Microphone error: ${e.error}. Check browser permission or type your command.`);
    };
    r.onend = () => {
      if (recognition !== r) return;
      listening = false;
      if (recognition === r) recognition = undefined;
      $("mic").textContent = "Listen";
      resumeListening();
    };
    try {
      r.start();
    } catch {
      recognition = undefined;
      sessionActive = false;
      report("Could not start microphone. Use typed commands.");
    }
  }
  function toggleMic() {
    if (listening || recognition || sessionActive) {
      stop();
      return;
    }
    if (!micPermit) {
      $("settings").open = true;
      $("consent").focus();
      report(
        "Allow microphone commands in settings, or use typed commands. Browser speech services may process audio.",
      );
      return;
    }
    stopSpeech();
    clearTimeout(sessionTimer);
    sessionActive = continuousPermit;
    sessionEnd = Date.now() + 120000;
    commandCount = 0;
    if (sessionActive)
      sessionTimer = setTimeout(() => {
        stop();
        $("status").textContent = "Two-minute listening session ended. Choose Listen to restart.";
      }, 120000);
    startRecognition();
  }
  const focusListener = (e) => {
    if (e.target instanceof HTMLElement && e.target !== host && !host.contains(e.target))
      lastFocused = e.target;
  };
  const keyListener = (e) => {
    if (!e.isTrusted) return;
    if (e.key === "Escape") {
      stop();
    }
    if (e.altKey && e.shiftKey && ["ArrowRight", "ArrowLeft"].includes(e.code)) {
      e.preventDefault();
      execute(e.code === "ArrowRight" ? "next" : "previous");
    }
    if (e.altKey && e.shiftKey && e.code === "KeyM") {
      e.preventDefault();
      toggleMic();
    }
  };
  document.addEventListener("focusin", focusListener);
  document.addEventListener("keydown", keyListener);
  $("speech").onclick = () => {
    enabled = !enabled;
    $("status").setAttribute("aria-live", enabled ? "off" : "polite");
    $("speech").setAttribute("aria-pressed", String(enabled));
    $("speech").textContent = enabled ? "Mute spoken guidance" : "Start voice guide";
    if (enabled)
      report(
        "Welcome to WebGuide. Tab moves between buttons; Enter chooses. Allow page reading before I inspect this page. Choose Listen for voice commands after allowing the microphone. Say next heading, next link, read page, or help. Every action needs confirmation. Escape stops speech and listening.",
      );
    else {
      stopSpeech();
      $("status").textContent =
        "Spoken guidance disabled. Screen reader and text controls remain available.";
      resumeListening();
    }
  };
  $("page-access").onchange = (event) => {
    if (event.isTrusted && $("page-access").checked) {
      pageAccess = true;
      allowedUrl = location.href;
      report("Page reading allowed.");
    } else stop();
  };
  $("share-context").onchange = (e) => {
    if (!requirePageAccess()) {
      $("share-context").checked = false;
      return;
    }
    consentPermit =
      e.isTrusted && $("share-context").checked && core
        ? { goal: $("goal").value, revision: core.capture().revision, time: Date.now() }
        : undefined;
  };
  $("goal").oninput = () => {
    consentPermit = undefined;
    $("share-context").checked = false;
  };
  shadow.addEventListener(
    "click",
    (event) => {
      if (!event.isTrusted || !(event.target instanceof Element)) return;
      const button = event.target.closest("button");
      trustedSubmit =
        button?.type === "submit" && button.form
          ? { form: button.form, submitter: button, time: Date.now() }
          : null;
    },
    true,
  );
  shadow.addEventListener(
    "keydown",
    (event) => {
      if (!event.isTrusted || event.key !== "Enter") return;
      const form = event.target.form;
      const submitter = form?.querySelector("button:not([type]),button[type=submit]");
      trustedSubmit = form && submitter ? { form, submitter, time: Date.now() } : null;
    },
    true,
  );
  $("goal-form").onsubmit = (e) => {
    e.preventDefault();
    if (
      !e.isTrusted ||
      !trustedSubmit ||
      trustedSubmit.form !== e.currentTarget ||
      trustedSubmit.submitter !== e.submitter ||
      Date.now() - trustedSubmit.time > 1000
    )
      return;
    trustedSubmit = null;
    void askGuidance("guide");
  };
  $("repeat-guidance").onclick = () => {
    if (guidanceResult && !guidanceStale) report(guidanceResult.message);
    else report("The page changed. Request fresh guidance.");
  };
  $("simplify-guidance").onclick = () => void askGuidance("simplify");
  $("explain-field").onclick = () => void askGuidance("explain");
  $("review-context").onclick = () => {
    if (!requirePageAccess()) return;
    if (!core) return report("Page context support unavailable.");
    const snapshot = core.capture();
    $("context-preview").hidden = false;
    $("context-preview").textContent = JSON.stringify(snapshot, null, 2);
  };
  $("disconnect-guidance").onclick = () => {
    cancelGuidance();
    $("guidance-token").value = "";
    if (extensionMode) chrome.runtime.sendMessage({ type: "WEBGUIDE_DISCONNECT" }).catch(() => {});
    report("Guidance connection cleared. Local navigation remains available.");
  };
  $("focus-step").onclick = () => {
    if (!requirePageAccess()) return;
    if (
      !guidanceResult ||
      guidanceStale ||
      !guidanceContext ||
      core.capture().revision !== guidanceContext.revision
    )
      return report("The page changed. Refresh guidance before following a step.");
    const steps = guidanceResult.steps.filter((step) => step.targetId);
    if (!steps.length) return;
    guidanceStep = (guidanceStep + 1) % steps.length;
    const step = steps[guidanceStep],
      target = core.findTarget(step.targetId);
    if (!target) return report("That step’s control is no longer available.");
    focusTarget(target);
    report(step.instruction);
  };
  $("stop").onclick = stop;
  $("mic").onclick = toggleMic;
  $("consent").onchange = (event) => {
    micPermit = event.isTrusted && $("consent").checked;
    if (!micPermit) {
      $("consent").checked = false;
      stop();
    }
  };
  $("continuous").onchange = (event) => {
    continuousPermit = event.isTrusted && $("continuous").checked;
    if (!continuousPermit) {
      $("continuous").checked = false;
      sessionActive = false;
      clearTimeout(resumeTimer);
      clearTimeout(sessionTimer);
    }
  };
  $("language").onchange = stop;
  $("read").onclick = () => execute("read page");
  $("next").onclick = () => execute("next");
  $("previous").onclick = () => execute("previous");
  $("confirm").onclick = confirm;
  $("cancel").onclick = () => {
    const target = pending?.element || lastFocused;
    cancelPending();
    if (target?.isConnected) target.focus();
    report("Action cancelled.");
  };
  $("command-form").onsubmit = (e) => {
    e.preventDefault();
    if (
      !e.isTrusted ||
      !trustedSubmit ||
      trustedSubmit.form !== e.currentTarget ||
      trustedSubmit.submitter !== e.submitter ||
      Date.now() - trustedSubmit.time > 1000
    )
      return;
    trustedSubmit = null;
    execute($("command").value);
  };
  $("close").onclick = () => {
    disposed = true;
    stop();
    contextObserver.disconnect();
    clearInterval(contextPoll);
    clearTimeout(contextTimer);
    window.removeEventListener("popstate", invalidateGuidance);
    window.removeEventListener("hashchange", invalidateGuidance);
    document.removeEventListener("focusin", focusListener);
    document.removeEventListener("keydown", keyListener);
    host.remove();
    if (lastFocused?.isConnected) lastFocused.focus();
  };
  for (const button of shadow.querySelectorAll("button")) {
    const handler = button.onclick;
    if (handler)
      button.onclick = function (event) {
        if (event.isTrusted) return handler.call(this, event);
      };
  }
  $("speech").focus();
})();

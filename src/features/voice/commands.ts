export type NavigationGroup = "control" | "heading" | "link" | "form" | "landmark";
export type NavigationDirection = "next" | "previous" | "first" | "last";
export type CaretDirection =
  "left" | "right" | "up" | "down" | "home" | "end" | "start" | "finish" | "all";
export type VoiceCommand =
  | {
      kind:
        | "repeat"
        | "simplify"
        | "explain"
        | "help"
        | "read-page"
        | "read-focused"
        | "next"
        | "previous"
        | "headings"
        | "links"
        | "scroll-down"
        | "scroll-up"
        | "confirm"
        | "cancel"
        | "stop";
    }
  | { kind: "guide" | "open" | "focus" | "click" | "type" | "choose" | "insert"; value: string }
  | { kind: "navigate"; group: NavigationGroup; direction: NavigationDirection }
  | { kind: "caret"; direction: CaretDirection; extend: boolean }
  | { kind: "unknown" };

export function normalizeName(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[\p{P}\p{S}]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase();
}
export function parseVoiceCommand(input: string): VoiceCommand {
  const text = input.trim();
  if (!text || text.length > 1000) return { kind: "unknown" };
  const guide = text.match(
    /^(?:guide me to|help me to|help me|my goal is|how do i|how can i)\s+(.+)$/i,
  );
  if (guide?.[1]) return { kind: "guide", value: guide[1].slice(0, 500) };
  const n = normalizeName(text);
  const simple: Record<string, VoiceCommand["kind"]> = {
    repeat: "repeat",
    "say again": "repeat",
    simplify: "simplify",
    "make it simpler": "simplify",
    "explain field": "explain",
    "explain fields": "explain",
    help: "help",
    "voice help": "help",
    मदद: "help",
    सहायता: "help",
    madad: "help",
    "read page": "read-page",
    "read this page": "read-page",
    "पेज पढ़ो": "read-page",
    "पृष्ठ पढ़ो": "read-page",
    "page padho": "read-page",
    "read focused": "read-focused",
    "read current": "read-focused",
    "यह पढ़ो": "read-focused",
    next: "next",
    "next control": "next",
    अगला: "next",
    agla: "next",
    back: "previous",
    previous: "previous",
    "previous control": "previous",
    पिछला: "previous",
    pichla: "previous",
    "list headings": "headings",
    headings: "headings",
    शीर्षक: "headings",
    "list links": "links",
    links: "links",
    "लिंक बताओ": "links",
    "scroll down": "scroll-down",
    नीचे: "scroll-down",
    neeche: "scroll-down",
    "scroll up": "scroll-up",
    ऊपर: "scroll-up",
    upar: "scroll-up",
    confirm: "confirm",
    "confirm action": "confirm",
    पुष्टि: "confirm",
    "हाँ पुष्टि": "confirm",
    cancel: "cancel",
    रद्द: "cancel",
    radd: "cancel",
    stop: "stop",
    "stop reading": "stop",
    रुको: "stop",
    ruko: "stop",
  };
  const command = simple[n];
  if (command) return { kind: command } as VoiceCommand;
  const navigation = n.match(
    /^(next|previous|first|last) (control|heading|link|form|field|landmark)s?$/,
  );
  if (navigation)
    return {
      kind: "navigate",
      direction: navigation[1] as NavigationDirection,
      group: (navigation[2] === "field" ? "form" : navigation[2]) as NavigationGroup,
    };
  if (n === "first" || n === "last") return { kind: "navigate", direction: n, group: "control" };
  const hindiNavigation: Record<string, [NavigationDirection, NavigationGroup]> = {
    "अगला शीर्षक": ["next", "heading"],
    "पिछला शीर्षक": ["previous", "heading"],
    "अगला लिंक": ["next", "link"],
    "पिछला लिंक": ["previous", "link"],
    "अगला फ़ील्ड": ["next", "form"],
    पहला: ["first", "control"],
    आखिरी: ["last", "control"],
  };
  const translated = hindiNavigation[n];
  if (translated) return { kind: "navigate", direction: translated[0], group: translated[1] };
  if (n === "select all" || n === "सभी चुनो")
    return { kind: "caret", direction: "all", extend: true };
  const caret = n.match(/^(cursor|caret|select) (left|right|up|down|home|end|start|finish)$/);
  if (caret)
    return { kind: "caret", direction: caret[2] as CaretDirection, extend: caret[1] === "select" };
  const caretAliases: Record<string, CaretDirection> = {
    "line start": "home",
    "line end": "end",
    "text start": "start",
    "text end": "finish",
    "कर्सर बाएं": "left",
    "कर्सर दाएं": "right",
  };
  const caretAlias = caretAliases[n];
  if (caretAlias) return { kind: "caret", direction: caretAlias, extend: false };
  const patterns: Array<["open" | "focus" | "click" | "type" | "choose" | "insert", RegExp]> = [
    ["open", /^(?:open|go to|खोलो|खोलें|kholo)\s+(.+)$/iu],
    ["focus", /^(?:focus|फोकस)\s+(.+)$/iu],
    ["click", /^(?:click|activate|क्लिक|दबाओ|dabao)\s+(.+)$/iu],
    ["type", /^(?:type|write|लिखो|likho)\s+(.+)$/iu],
    ["insert", /^(?:insert|जोड़ो|jodo)\s+(.+)$/iu],
    ["choose", /^(?:choose|select|चुनो|चुनें|chuno)\s+(.+)$/iu],
  ];
  for (const [kind, pattern] of patterns) {
    const value = text.match(pattern)?.[1]?.trim();
    if (value) return { kind, value };
  }
  return { kind: "unknown" };
}

const aliases: Record<string, string> = {
  home: "Overview",
  overview: "Overview",
  होम: "Overview",
  "मुख्य पृष्ठ": "Overview",
  "website companion": "Website companion",
  companion: "Website companion",
  "वेबसाइट साथी": "Website companion",
  explorer: "Explorer",
  एक्सप्लोरर: "Explorer",
  features: "Features",
  tutorials: "Tutorials",
  guides: "Tutorials",
  ट्यूटोरियल: "Tutorials",
  गाइड: "Tutorials",
  "saved websites": "Saved websites",
  वेबसाइट: "Saved websites",
  "run history": "Run history",
  history: "Run history",
  इतिहास: "Run history",
  profile: "Profile",
  प्रोफाइल: "Profile",
  settings: "Settings",
  सेटिंग्स: "Settings",
  faqs: "FAQs",
  faq: "FAQs",
  सवाल: "FAQs",
  "ask webguide": "Ask WebGuide",
  "ask webguide ai": "Ask WebGuide",
};
export function resolveSection(value: string): string | undefined {
  return aliases[normalizeName(value)];
}
export function isVisible(element: Element): element is HTMLElement {
  if (
    !(element instanceof HTMLElement) ||
    !element.isConnected ||
    element.closest('[hidden],[inert],[aria-hidden="true"],[data-webguide-voice]')
  )
    return false;
  const style = getComputedStyle(element);
  return (
    style.display !== "none" && style.visibility !== "hidden" && element.getClientRects().length > 0
  );
}
function authoredLabelText(element: HTMLElement): string {
  const clone = element.cloneNode(true) as HTMLElement;
  clone
    .querySelectorAll('input,textarea,select,[contenteditable],[hidden],[aria-hidden="true"]')
    .forEach((child) => child.remove());
  return clone.textContent?.trim().replace(/\s+/g, " ") ?? "";
}
export function accessibleName(element: HTMLElement): string {
  const labelledBy = element.getAttribute("aria-labelledby");
  if (labelledBy) {
    const labels = labelledBy
      .split(/\s+/)
      .map((id) => {
        const label = document.getElementById(id);
        return label ? authoredLabelText(label) : "";
      })
      .join(" ")
      .trim();
    if (labels) return labels;
  }
  const aria = element.getAttribute("aria-label")?.trim();
  if (aria) return aria;
  if (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLSelectElement
  ) {
    const labels = Array.from(element.labels ?? [])
      .map((label) => authoredLabelText(label))
      .join(" ")
      .trim();
    if (labels) return labels;
    return (
      element.getAttribute("placeholder") ||
      element.getAttribute("name") ||
      element.tagName.toLowerCase()
    );
  }
  if (element.closest("[contenteditable]"))
    return element.getAttribute("title") || "Editable content";
  return (
    authoredLabelText(element) || element.getAttribute("title") || element.tagName.toLowerCase()
  );
}
export function isSensitive(element: HTMLElement): boolean {
  if (element.closest("[contenteditable]")) return true;
  if (element instanceof HTMLInputElement && ["password", "file", "hidden"].includes(element.type))
    return true;
  const identity = `${accessibleName(element)} ${element.getAttribute("name") ?? ""} ${element.id} ${element.getAttribute("autocomplete") ?? ""}`;
  return /password|passcode|secret|token|api.?key|credit.?card|card.?number|cvv|cvc|one.?time|otp|current-password|new-password|cc-|पासवर्ड|गुप्त|टोकन/i.test(
    identity,
  );
}
export function isEnabled(element: HTMLElement) {
  return (
    !element.matches(":disabled,[aria-disabled='true']") && !element.closest("fieldset:disabled")
  );
}
export function controls(root: HTMLElement): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>(
      'button,a[href],input:not([type="hidden"]),select,textarea,summary,[role="button"],[role="link"],[tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => isVisible(element) && isEnabled(element));
}
export function resolveTarget(
  root: HTMLElement,
  query: string,
): { target?: HTMLElement; error?: string } {
  const wanted = normalizeName(query);
  const candidates = controls(root);
  const exact = candidates.filter((element) => normalizeName(accessibleName(element)) === wanted);
  // Never fall back to a broad substring: similarly named controls can have different consequences.
  if (exact.length > 1)
    return {
      error:
        "Several controls have that name. Use Next or Previous to focus the exact control, then say Click current.",
    };
  if (!exact.length)
    return {
      error:
        "No visible enabled control has that exact name. Say List links or Next to discover controls.",
    };
  const target = exact[0];
  return target ? { target } : { error: "That control is unavailable." };
}
export function canActivate(target: HTMLElement): boolean {
  if (!isVisible(target) || !isEnabled(target) || isSensitive(target)) return false;
  if (target instanceof HTMLAnchorElement) {
    try {
      return ["http:", "https:"].includes(new URL(target.href, location.href).protocol);
    } catch {
      return false;
    }
  }
  if (target instanceof HTMLInputElement)
    return ["button", "checkbox", "radio", "submit", "reset"].includes(target.type);
  return target.matches('button,summary,[role="button"],[role="link"]');
}
export function setFieldText(target: HTMLElement, value: string): boolean {
  if (!isVisible(target) || !isEnabled(target) || isSensitive(target)) return false;
  if (
    !(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) ||
    target.readOnly
  )
    return false;
  if (
    target instanceof HTMLInputElement &&
    !["text", "search", "email", "tel", "url"].includes(target.type)
  )
    return false;
  if (
    value.length > 1000 ||
    (target.hasAttribute("maxlength") && target.maxLength >= 0 && value.length > target.maxLength)
  )
    return false;
  const prototype =
    target instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(target, value);
  target.dispatchEvent(new Event("input", { bubbles: true }));
  target.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}
export function pageText(root: HTMLElement): string {
  // Text nodes of actually hidden regions are excluded using their original DOM position.
  const chunks: string[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const parent = node.parentElement;
    if (
      !parent ||
      parent.closest(
        "script,style,input,textarea,select,[contenteditable],[data-webguide-voice]",
      ) ||
      !isVisible(parent)
    )
      continue;
    const content = node.textContent?.replace(/\s+/g, " ").trim();
    if (content) chunks.push(content);
  }
  const text = chunks.join(" ");
  return text.length > 15000
    ? `${text.slice(0, 15000)}. Reading stopped at the text limit. Use your screen reader to read the remaining content.`
    : text;
}

export function resolveOption(target: HTMLElement, label: string): HTMLOptionElement | undefined {
  if (
    !(target instanceof HTMLSelectElement) ||
    !isVisible(target) ||
    !isEnabled(target) ||
    isSensitive(target) ||
    target.multiple
  )
    return undefined;
  const matches = Array.from(target.options).filter(
    (option) =>
      !option.disabled &&
      !option.closest("optgroup:disabled") &&
      normalizeName(option.label) === normalizeName(label),
  );
  return matches.length === 1 ? matches[0] : undefined;
}
export function setSelection(target: HTMLSelectElement, option: HTMLOptionElement): boolean {
  if (
    !isVisible(target) ||
    !isEnabled(target) ||
    isSensitive(target) ||
    !target.contains(option) ||
    option.disabled ||
    option.closest("optgroup:disabled")
  )
    return false;
  Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set?.call(
    target,
    option.value,
  );
  target.dispatchEvent(new Event("input", { bubbles: true }));
  target.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

export function navigationTargets(root: HTMLElement, group: NavigationGroup): HTMLElement[] {
  if (group === "control") return controls(root);
  const selectors: Record<Exclude<NavigationGroup, "control">, string> = {
    heading: 'h1,h2,h3,h4,h5,h6,[role="heading"]',
    link: 'a[href],[role="link"]',
    form: 'input:not([type="hidden"]),textarea,select,[role="textbox"],[role="combobox"]',
    landmark:
      'main,nav,aside,header,footer,[role="main"],[role="navigation"],[role="complementary"],[role="banner"],[role="contentinfo"],[role="region"],section[aria-label],section[aria-labelledby]',
  };
  return Array.from(root.querySelectorAll<HTMLElement>(selectors[group])).filter(
    (element) => isVisible(element) && isEnabled(element),
  );
}
export function navigationTarget(
  root: HTMLElement,
  current: HTMLElement | null,
  group: NavigationGroup,
  direction: NavigationDirection,
): { target?: HTMLElement; index: number; count: number } {
  const elements = navigationTargets(root, group);
  const count = elements.length;
  if (!count) return { index: -1, count: 0 };
  let index = direction === "last" ? count - 1 : 0;
  if (direction === "next" || direction === "previous") {
    const same = current ? elements.indexOf(current) : -1;
    if (same >= 0) index = direction === "next" ? (same + 1) % count : (same + count - 1) % count;
    else if (current && root.contains(current)) {
      const candidates = elements.map((element, i) => ({ element, i }));
      const relative =
        direction === "next"
          ? candidates.find(({ element }) =>
              Boolean(current.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING),
            )
          : [...candidates]
              .reverse()
              .find(({ element }) =>
                Boolean(
                  current.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_PRECEDING,
                ),
              );
      index = relative?.i ?? (direction === "next" ? 0 : count - 1);
    } else index = direction === "next" ? 0 : count - 1;
  }
  const target = elements[index];
  return target ? { target, index, count } : { index: -1, count };
}
/** Moves selection only inside the selected non-private editable field; never emits keystrokes or submits. */
export function moveCaret(
  target: HTMLElement,
  direction: CaretDirection,
  extend = false,
): { moved: boolean; position?: number; selected?: number } {
  if (
    !isVisible(target) ||
    !isEnabled(target) ||
    isSensitive(target) ||
    !(target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement) ||
    target.readOnly
  )
    return { moved: false };
  if (target instanceof HTMLInputElement && !["text", "search", "tel", "url"].includes(target.type))
    return { moved: false };
  const start = target.selectionStart,
    end = target.selectionEnd;
  if (start === null || end === null) return { moved: false };
  const value = target.value;
  if (direction === "all") {
    target.setSelectionRange(0, value.length, "forward");
    return { moved: true, position: value.length, selected: value.length };
  }
  const backwards = target.selectionDirection === "backward";
  const anchor = backwards ? end : start;
  let position = backwards ? start : end;
  if (!extend && start !== end && (direction === "left" || direction === "right"))
    position = direction === "left" ? start : end;
  else {
    const lineStart = position === 0 ? 0 : value.lastIndexOf("\n", position - 1) + 1;
    const nextBreak = value.indexOf("\n", position);
    const lineEnd = nextBreak < 0 ? value.length : nextBreak;
    switch (direction) {
      case "left":
        position = Math.max(
          0,
          position -
            (position > 1 &&
            /[\uDC00-\uDFFF]/.test(value[position - 1] ?? "") &&
            /[\uD800-\uDBFF]/.test(value[position - 2] ?? "")
              ? 2
              : 1),
        );
        break;
      case "right":
        position = Math.min(
          value.length,
          position +
            (/[\uD800-\uDBFF]/.test(value[position] ?? "") &&
            /[\uDC00-\uDFFF]/.test(value[position + 1] ?? "")
              ? 2
              : 1),
        );
        break;
      case "home":
        position = lineStart;
        break;
      case "end":
        position = lineEnd;
        break;
      case "start":
        position = 0;
        break;
      case "finish":
        position = value.length;
        break;
      case "up": {
        const previousEnd = Math.max(0, lineStart - 1);
        const previousStart = value.lastIndexOf("\n", previousEnd - 1) + 1;
        position =
          lineStart === 0 ? 0 : Math.min(previousEnd, previousStart + (position - lineStart));
        break;
      }
      case "down": {
        const nextStart = Math.min(value.length, lineEnd + 1);
        const nextEndIndex = value.indexOf("\n", nextStart);
        const nextEnd = nextEndIndex < 0 ? value.length : nextEndIndex;
        position = Math.min(nextEnd, nextStart + (position - lineStart));
        break;
      }
    }
  }
  if (extend)
    target.setSelectionRange(
      Math.min(anchor, position),
      Math.max(anchor, position),
      position < anchor ? "backward" : "forward",
    );
  else target.setSelectionRange(position, position, "none");
  return { moved: true, position, selected: extend ? Math.abs(position - anchor) : 0 };
}

export function insertFieldText(target: HTMLElement, text: string): boolean {
  if (
    !(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) ||
    target.selectionStart === null ||
    target.selectionEnd === null ||
    isSensitive(target)
  )
    return false;
  const start = target.selectionStart,
    end = target.selectionEnd;
  const result = target.value.slice(0, start) + text + target.value.slice(end);
  if (text.length > 1000 || !setFieldText(target, result)) return false;
  target.setSelectionRange(start + text.length, start + text.length);
  return true;
}

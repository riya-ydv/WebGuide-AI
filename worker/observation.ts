import type { Page } from "playwright";
import type { Observation } from "./contracts.js";
import { cleanUrl } from "./network.js";

export async function observe(page: Page, id: string): Promise<Observation> {
  const content = await page.evaluate(() => {
    const owner = window as Window & {
      __webguideRegistry?: { targets: WeakMap<Element, string>; next: number };
    };
    const registry = (owner.__webguideRegistry ??= {
      targets: new WeakMap<Element, string>(),
      next: 0,
    });
    const controls = Array.from(
      document.querySelectorAll<HTMLElement>(
        'button,a,input,select,textarea,[role="tab"],[role="switch"]',
      ),
    )
      .filter(
        (el) =>
          el.getBoundingClientRect().width > 0 &&
          el.getBoundingClientRect().height > 0 &&
          el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) &&
          !el.closest("[data-private]"),
      )
      .slice(0, 60)
      .flatMap((el, index) => {
        const type = el.getAttribute("type") || "";
        if (
          /password|hidden|file/i.test(type) ||
          /password|credit|payment|secret|token/i.test(el.getAttribute("name") || "")
        )
          return [];
        const label = (
          el.getAttribute("aria-label") ||
          (el instanceof HTMLInputElement ? el.labels?.[0]?.textContent : "") ||
          el.textContent ||
          el.getAttribute("placeholder") ||
          ""
        )
          .trim()
          .slice(0, 120);
        if (!label) return [];
        const controlId = registry.targets.get(el) ?? `control-${registry.next++}`;
        registry.targets.set(el, controlId);
        el.setAttribute("data-gf-observed", controlId);
        return [
          {
            id: controlId,
            label,
            tag: el.tagName.toLowerCase(),
            type,
            safe: el.getAttribute("data-webguide-safe") === "true",
            expected: (el.getAttribute("data-webguide-expect") || "").slice(0, 120),
          },
        ];
      });
    // Deliberately no full-page text, passwords, field values, HTML, or screenshots.
    const state = Array.from(document.querySelectorAll('[role="status"],[data-webguide-result]'))
      .filter((el) => !el.closest("[data-private]"))
      .map((el) => el.textContent?.trim().slice(0, 300) || "")
      .join(" | ")
      .slice(0, 1000);
    return { controls, state, title: document.title.slice(0, 120) };
  });
  return { id, url: cleanUrl(page.url()), observedAt: new Date().toISOString(), ...content };
}

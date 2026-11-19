import { SCHEMA_VERSION, type ElementObservation, type PageObservation } from "./types";

export function accessibleName(element: HTMLElement): string {
  const ariaLabel = element.getAttribute("aria-label")?.trim();
  if (ariaLabel) return ariaLabel.slice(0, 500);
  const labelledBy = element.getAttribute("aria-labelledby");
  if (labelledBy) {
    const name = labelledBy
      .split(/\s+/)
      .map((id) => element.ownerDocument.getElementById(id)?.textContent?.trim() ?? "")
      .filter(Boolean)
      .join(" ");
    if (name) return name.slice(0, 500);
  }
  if (
    element instanceof HTMLInputElement ||
    element instanceof HTMLSelectElement ||
    element instanceof HTMLTextAreaElement
  ) {
    const label = element.labels?.[0]?.textContent?.trim();
    if (label) return label.slice(0, 500);
    return element.name || "Field";
  }
  return (element.innerText?.trim() || element.textContent?.trim() || "Unnamed control").slice(
    0,
    500,
  );
}

export function isVisibleControl(element: HTMLElement): boolean {
  if (!element.isConnected || element.closest('[hidden], [aria-hidden="true"], [inert]'))
    return false;
  let ancestor: HTMLElement | null = element;
  while (ancestor) {
    const style = ancestor.ownerDocument.defaultView?.getComputedStyle(ancestor);
    if (style?.display === "none" || style?.visibility === "hidden") return false;
    ancestor = ancestor.parentElement;
  }
  return true;
}

export function observeTaskDesk(
  root: HTMLElement,
  id: string,
  observedAt = new Date().toISOString(),
): PageObservation {
  const pageName = root.getAttribute("data-page-name")?.trim() || "TaskDesk";
  const controls: ElementObservation[] = Array.from(
    root.querySelectorAll<HTMLElement>("button[data-explorer-safe='true'][data-explorer-id]"),
  )
    .filter(isVisibleControl)
    .slice(0, 100)
    .map((element) => {
      const formId = element.closest("form")?.id;
      return {
        id: element.dataset["explorerId"] ?? "",
        tagName: element.tagName.toLowerCase(),
        accessibleName: accessibleName(element),
        role: element.getAttribute("role") || "button",
        pageName,
        ...(formId ? { formId } : {}),
        state: [
          element.getAttribute("aria-pressed"),
          element.getAttribute("aria-checked"),
          element.getAttribute("data-explorer-state"),
        ]
          .filter((value) => value !== null)
          .join("; "),
      };
    })
    .filter((control) => control.id && control.accessibleName);
  return { schemaVersion: SCHEMA_VERSION, id, pageName, observedAt, controls };
}

/** Only explicit sandbox output and public control state; no field values or hidden text. */
export function snapshotTaskDesk(root: HTMLElement): string {
  const outputs = Array.from(root.querySelectorAll<HTMLElement>('[data-explorer-output="true"]'))
    .filter(isVisibleControl)
    .map((element) => ({
      targetId: element.dataset["explorerFor"] ?? "",
      text: (element.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 2000),
    }));
  const controls = Array.from(root.querySelectorAll<HTMLElement>("button[data-explorer-id]"))
    .filter(isVisibleControl)
    .slice(0, 100)
    .map((element) => ({
      id: element.dataset["explorerId"] ?? "",
      state:
        element.getAttribute("aria-pressed") ??
        element.getAttribute("aria-checked") ??
        element.getAttribute("data-explorer-state") ??
        "",
    }));
  return JSON.stringify({ outputs, controls });
}

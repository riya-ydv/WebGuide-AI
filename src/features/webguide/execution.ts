import { accessibleName, isVisibleControl } from "./observation";
import { decideDemoAction } from "./policy";
import type { PlannedAction, RecordedInput } from "./types";
export interface ExecutionOutcome {
  status: "executed" | "failed";
  reason?: string;
  inputs?: RecordedInput[];
}

/** Generic form handler; no feature names or feature-to-workflow lookup. */
export function executeDemoAction(target: HTMLElement, action: PlannedAction): ExecutionOutcome {
  const decision = decideDemoAction(action, target);
  if (!decision.allowed) return { status: "failed", reason: decision.reason };
  const inputs: RecordedInput[] = [];
  try {
    const form = target.closest("form[data-explorer-safe='true']");
    if (form) {
      for (const field of Array.from(
        form.querySelectorAll<HTMLInputElement | HTMLSelectElement>("input, select"),
      )) {
        if (!isVisibleControl(field) || field.disabled) continue;
        if (field instanceof HTMLSelectElement) {
          const option = field.selectedOptions[0];
          if (option)
            inputs.push({ label: accessibleName(field), value: option.label, kind: "select" });
        } else if (field.type === "text" || field.type === "search") {
          if (field.autocomplete && /password|cc-|one-time|email|tel/i.test(field.autocomplete))
            return { status: "failed", reason: "Sensitive fields are excluded from exploration." };
          if (!field.value) {
            const value =
              `Demo ${accessibleName(field).toLowerCase()} ${Date.now().toString(36)}`.slice(
                0,
                field.maxLength > 0 ? field.maxLength : 100,
              );
            const setter = Object.getOwnPropertyDescriptor(
              HTMLInputElement.prototype,
              "value",
            )?.set;
            setter?.call(field, value);
            field.dispatchEvent(new Event("input", { bubbles: true }));
            field.dispatchEvent(new Event("change", { bubbles: true }));
          }
          inputs.push({
            label: accessibleName(field),
            value: field.value.slice(0, 100),
            kind: "text",
          });
        } else if (field.type !== "hidden" && field.type !== "submit")
          return { status: "failed", reason: `Unsupported field type: ${field.type}.` };
      }
      if (form instanceof HTMLFormElement && !form.checkValidity())
        return { status: "failed", reason: "The observed form did not pass its validation." };
    }
    target.click();
    return { status: "executed", inputs };
  } catch {
    return { status: "failed", reason: "The observed demo control could not be activated." };
  }
}

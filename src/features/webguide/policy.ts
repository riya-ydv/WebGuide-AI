import { accessibleName, isVisibleControl } from "./observation";
import type { PlannedAction } from "./types";
export type PolicyDecision = { allowed: true } | { allowed: false; reason: string };
const unsafeTerms =
  /pay|purchase|checkout|send|invite|delete|remove|password|permission|publish|upload/i;

export function decideDemoAction(
  action: PlannedAction,
  target: HTMLElement | null,
): PolicyDecision {
  if (!target) return { allowed: false, reason: "The observed control is no longer present." };
  if (
    !target.closest('[data-webguide-sandbox="true"]') ||
    target.dataset["explorerSafe"] !== "true"
  )
    return {
      allowed: false,
      reason: "This control is outside the explicitly authorised disposable sandbox.",
    };
  if (
    target.dataset["explorerId"] !== action.targetId ||
    accessibleName(target) !== action.observedLabel
  )
    return {
      allowed: false,
      reason: "The target or its label changed since observation; re-observation is required.",
    };
  if (target.dataset["externalAction"] === "true" || unsafeTerms.test(action.observedLabel))
    return {
      allowed: false,
      reason: "Potentially consequential actions are blocked by the demo policy.",
    };
  if (!(target instanceof HTMLButtonElement) || target.disabled || !isVisibleControl(target))
    return { allowed: false, reason: "Only enabled, visible demo buttons can be activated." };
  const form = target.closest("form");
  if (
    form &&
    (form.dataset["explorerSafe"] !== "true" ||
      form.hasAttribute("action") ||
      form.querySelector(
        'input[type="password"], input[type="file"], input[autocomplete*="cc-"], input[autocomplete="one-time-code"]',
      ))
  )
    return { allowed: false, reason: "This form is not an eligible disposable sandbox form." };
  return { allowed: true };
}
export function canStartExternalScan(workerConnected: boolean): PolicyDecision {
  return workerConnected
    ? { allowed: true }
    : {
        allowed: false,
        reason: "Exploration worker not connected. External scans are unavailable.",
      };
}

import type { Action, Observation } from "./contracts.js";
export function policy(action: Action, observation: Observation, sandbox: boolean): string | null {
  if (action.type === "stop") return null;
  const target = observation.controls.find((c) => c.id === action.targetId);
  if (!target) return "Target was not observed";
  if (action.type === "inspect") return null;
  if (!sandbox) return "Real websites are read-only: mutations and clicks are blocked";
  if (!target.safe) return "Control is outside the explicitly authorised fixture action boundary";
  if (/password|hidden|file/i.test(target.type)) return "Sensitive input blocked";
  if (action.type === "fill" && !["input", "textarea"].includes(target.tag))
    return "Target is not a supported input";
  return null;
}

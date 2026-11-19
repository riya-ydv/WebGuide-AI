declare module "*page-assistance.js";
interface PageContext {
  url: string;
  title: string;
  revision: string;
  text: string;
  controls: Array<{
    id: string;
    name: string;
    role: string;
    type?: string;
    required?: boolean;
    description?: string;
    error?: string;
  }>;
  headings: Array<{ id: string; text: string; level: number }>;
}
interface PageGuidanceResult {
  message: string;
  steps: Array<{ instruction: string; targetId?: string }>;
  status: "guidance" | "insufficient-context";
  contextRevision: string;
}
interface Window {
  WebGuidePageAssistance: {
    capture(root?: HTMLElement): PageContext;
    findTarget(id: string, root?: HTMLElement): HTMLElement | null;
    requestGuidance(options: {
      endpoint: string;
      token: string;
      goal: string;
      mode: "guide" | "simplify" | "explain";
      language: "en" | "hi";
      previousInstruction?: string;
      context: PageContext;
      signal: AbortSignal;
    }): Promise<PageGuidanceResult>;
  };
}

import { z } from "zod";

export const WORKSPACE_KEY = "webguide-workspace-v1";
export const avatarColors = {
  blue: "#2563eb",
  violet: "#6d28d9",
  teal: "#0f766e",
  slate: "#334155",
  orange: "#c2410c",
} as const;
const identifier = z.string().trim().min(1).max(1000);
const uniqueIds = z
  .array(identifier)
  .max(2000)
  .refine((ids) => new Set(ids).size === ids.length, "Duplicate tutorial IDs are not allowed");
export const savedSiteSchema = z
  .object({
    id: identifier,
    name: z.string().trim().min(1, "Enter a website name").max(100),
    url: z
      .string()
      .trim()
      .max(2000)
      .url()
      .refine((value) => {
        try {
          const url = new URL(value);
          return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password;
        } catch {
          return false;
        }
      }, "Use an HTTP or HTTPS address without embedded credentials"),
  })
  .strict();
export const workspaceSchema = z
  .object({
    schemaVersion: z.literal(1),
    profile: z
      .object({
        displayName: z.string().trim().min(1, "Enter your display name").max(80),
        email: z
          .union([z.literal(""), z.string().trim().max(254).email("Enter a valid email address")])
          .transform((value) => value.trim()),
        role: z.string().trim().max(80),
        workspaceName: z.string().trim().min(1, "Enter a workspace name").max(80),
        avatarColor: z.enum(["blue", "violet", "teal", "slate", "orange"]),
      })
      .strict(),
    preferences: z
      .object({
        defaultInstructionMode: z.enum(["beginner", "refresher"]),
        compactLayout: z.boolean(),
        reducedMotion: z.boolean(),
      })
      .strict(),
    savedSites: z
      .array(savedSiteSchema)
      .max(100)
      .refine(
        (sites) => new Set(sites.map((site) => site.id)).size === sites.length,
        "Duplicate website IDs are not allowed",
      ),
    bookmarkedTutorialIds: uniqueIds,
    completedTutorialIds: uniqueIds,
  })
  .strict();
export type Workspace = z.infer<typeof workspaceSchema>;
export type SavedSite = z.infer<typeof savedSiteSchema>;

export function defaultWorkspace(): Workspace {
  return {
    schemaVersion: 1,
    profile: {
      displayName: "My profile",
      email: "",
      role: "",
      workspaceName: "My workspace",
      avatarColor: "blue",
    },
    preferences: { defaultInstructionMode: "beginner", compactLayout: false, reducedMotion: false },
    savedSites: [],
    bookmarkedTutorialIds: [],
    completedTutorialIds: [],
  };
}
export function validateWorkspace(raw: string): Workspace {
  if (raw.length > 512_000) throw new Error("Workspace data exceeds the 512 KB limit");
  return workspaceSchema.parse(JSON.parse(raw));
}
export function parseWorkspace(raw: string | null): Workspace {
  if (!raw) return defaultWorkspace();
  try {
    return validateWorkspace(raw);
  } catch {
    return defaultWorkspace();
  }
}

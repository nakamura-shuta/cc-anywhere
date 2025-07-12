/**
 * Maps user-friendly permission mode names to Claude Code SDK permission modes
 */
export function mapPermissionMode(
  mode: string,
): "default" | "acceptEdits" | "bypassPermissions" | "plan" {
  switch (mode) {
    case "ask":
      return "default";
    case "allow":
      return "bypassPermissions";
    case "deny":
      return "plan"; // Map deny to plan mode to prevent any operations
    case "acceptEdits":
      return "acceptEdits";
    case "bypassPermissions":
      return "bypassPermissions";
    case "plan":
      return "plan";
    default:
      return "default";
  }
}

// Permission mode constants for consistency
export const PERMISSION_MODES = {
  ASK: "ask",
  ALLOW: "allow",
  DENY: "deny",
  DEFAULT: "default",
  ACCEPT_EDITS: "acceptEdits",
  BYPASS_PERMISSIONS: "bypassPermissions",
  PLAN: "plan",
} as const;

export type PermissionMode = (typeof PERMISSION_MODES)[keyof typeof PERMISSION_MODES];

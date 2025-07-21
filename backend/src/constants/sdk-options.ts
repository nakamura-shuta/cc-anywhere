/**
 * Common constants for SDK options
 */

export const SDK_DEFAULTS = {
  MAX_TURNS: 3,
  TIMEOUT: 600000, // 10 minutes
  PERMISSION_MODE: "default" as const,
  OUTPUT_FORMAT: "text" as const,
} as const;

export const SDK_LIMITS = {
  MAX_TURNS_MIN: 1,
  MAX_TURNS_MAX: 50,
  SYSTEM_PROMPT_MAX_LENGTH: 10000,
} as const;

export const COMMON_TOOLS = {
  READ: "Read",
  WRITE: "Write",
  EDIT: "Edit",
  MULTI_EDIT: "MultiEdit",
  BASH: "Bash",
  LS: "LS",
  GLOB: "Glob",
  GREP: "Grep",
  NOTEBOOK_READ: "NotebookRead",
  NOTEBOOK_EDIT: "NotebookEdit",
  WEB_FETCH: "WebFetch",
  WEB_SEARCH: "WebSearch",
  TODO_WRITE: "TodoWrite",
} as const;

export const SAFE_TOOLS = [
  COMMON_TOOLS.READ,
  COMMON_TOOLS.LS,
  COMMON_TOOLS.GLOB,
  COMMON_TOOLS.GREP,
] as const;

export const EDIT_TOOLS = [
  COMMON_TOOLS.WRITE,
  COMMON_TOOLS.EDIT,
  COMMON_TOOLS.MULTI_EDIT,
  COMMON_TOOLS.NOTEBOOK_EDIT,
] as const;

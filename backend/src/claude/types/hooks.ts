/**
 * Hooks System Type Definitions
 *
 * Re-export SDK types and add custom types for cc-anywhere
 */

// Re-export SDK types
export type {
  HookEvent,
  HookCallback,
  HookCallbackMatcher,
  HookInput,
  HookJSONOutput,
  SyncHookJSONOutput,
  AsyncHookJSONOutput,
  PreToolUseHookInput,
  PostToolUseHookInput,
} from "@anthropic-ai/claude-agent-sdk";

/**
 * Hook configuration for ClaudeCodeOptions
 */
export interface HookConfig {
  /** Enable PreToolUse hooks */
  enablePreToolUse?: boolean;
  /** Enable PostToolUse hooks */
  enablePostToolUse?: boolean;
  /** Default tool matcher for all hooks (regex pattern) */
  toolMatcher?: string;
  // NOTE: SessionStart/SessionEnd Hooks は将来対応（Phase 1では未実装）
}

/**
 * Progress callback for hook events
 */
export interface HookProgressEvent {
  type: "hook:pre_tool_use" | "hook:post_tool_use";
  timestamp: Date;
  toolName: string;
  toolInput?: Record<string, unknown>;
  toolOutput?: unknown;
  decision?: "approve" | "block";
  error?: string;
}

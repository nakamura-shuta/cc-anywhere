/**
 * Build Hooks Utility
 *
 * Constructs hook configuration for Claude Agent SDK
 */

import type {
  HookEvent,
  HookCallbackMatcher,
  HookInput,
  HookJSONOutput,
  PreToolUseHookInput,
  PostToolUseHookInput,
} from "@anthropic-ai/claude-agent-sdk";
import type { HookConfig } from "../types/hooks.js";
import { logger } from "../../utils/logger.js";

/**
 * Progress callback type for hook events
 */
export type HookProgressCallback = (event: {
  type: "hook:pre_tool_use" | "hook:post_tool_use";
  timestamp: Date;
  toolName: string;
  toolInput?: Record<string, unknown>;
  toolOutput?: unknown;
  decision?: "approve" | "block";
  error?: string;
}) => void | Promise<void>;

/**
 * Options for building hooks
 */
export interface BuildHooksOptions {
  /** Hook configuration */
  config: HookConfig;
  /** Task ID */
  taskId?: string;
  /** Progress callback for hook events */
  onProgress?: HookProgressCallback;
}

/**
 * Build hooks object for Claude Agent SDK
 *
 * @param options - Build hooks options
 * @returns Hooks object compatible with Claude Agent SDK
 */
export function buildHooks(
  options: BuildHooksOptions,
): Partial<Record<HookEvent, HookCallbackMatcher[]>> {
  const { config, taskId, onProgress } = options;
  const hooks: Partial<Record<HookEvent, HookCallbackMatcher[]>> = {};

  // Apply default values: enable both hooks if not explicitly set
  const { enablePreToolUse = true, enablePostToolUse = true, toolMatcher } = config;

  // Build PreToolUse hook
  if (enablePreToolUse) {
    const preToolUseHook = async (
      input: HookInput,
      _toolUseID: string | undefined,
      _options: { signal: AbortSignal },
    ): Promise<HookJSONOutput> => {
      const preToolInput = input as PreToolUseHookInput;

      logger.debug("PreToolUse hook triggered", {
        toolName: preToolInput.tool_name,
        sessionId: preToolInput.session_id,
        taskId,
      });

      // Default decision: approve all tools
      const decision = "approve" as const;

      // Notify progress if callback provided
      if (onProgress) {
        await onProgress({
          type: "hook:pre_tool_use",
          timestamp: new Date(),
          toolName: preToolInput.tool_name,
          toolInput: preToolInput.tool_input as Record<string, unknown>,
          decision,
        });
      }

      return {
        continue: true,
        decision,
      };
    };

    const matcher: HookCallbackMatcher = {
      hooks: [preToolUseHook],
    };

    // Add tool matcher if specified
    if (toolMatcher) {
      matcher.matcher = toolMatcher;
    }

    hooks.PreToolUse = [matcher];
  }

  // Build PostToolUse hook
  if (enablePostToolUse) {
    const postToolUseHook = async (
      input: HookInput,
      _toolUseID: string | undefined,
      _options: { signal: AbortSignal },
    ): Promise<HookJSONOutput> => {
      const postToolInput = input as PostToolUseHookInput;

      logger.debug("PostToolUse hook triggered", {
        toolName: postToolInput.tool_name,
        sessionId: postToolInput.session_id,
        taskId,
      });

      // Notify progress if callback provided
      if (onProgress) {
        await onProgress({
          type: "hook:post_tool_use",
          timestamp: new Date(),
          toolName: postToolInput.tool_name,
          toolInput: postToolInput.tool_input as Record<string, unknown>,
          toolOutput: postToolInput.tool_response as Record<string, unknown>,
        });
      }

      return {
        continue: true,
      };
    };

    const matcher: HookCallbackMatcher = {
      hooks: [postToolUseHook],
    };

    // Add tool matcher if specified
    if (toolMatcher) {
      matcher.matcher = toolMatcher;
    }

    hooks.PostToolUse = [matcher];
  }

  return hooks;
}

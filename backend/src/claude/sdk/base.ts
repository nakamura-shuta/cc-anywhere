/**
 * Claude SDK Base
 *
 * Minimal common base for Claude SDK operations
 * Provides only 3 helper functions:
 * 1. withApiKey: Temporary API key switching
 * 2. extractSessionId: Support both sessionId/session_id formats
 * 3. createQueryOptions: Basic query options generation
 */

import { config } from "../../config/index.js";

/**
 * Base options for SDK query
 */
export interface SDKQueryOptions {
  prompt: string;
  resume?: boolean;
  sdkSessionId?: string;
  systemPrompt?: string;
  cwd?: string;
}

/**
 * Abstract base class for Claude SDK operations
 *
 * This class is intentionally minimal - it only provides 3 helper functions
 * that are truly common between Task and Chat implementations.
 *
 * Complex features (hooks, webSearch, mcpConfig, TaskTracker, etc.)
 * remain in their respective client implementations.
 */
export abstract class ClaudeSDKBase {
  /**
   * 1. Temporarily switch API key and execute function
   *
   * Parallel collision risk is acceptable as env override approach continues.
   * If avoiding collision becomes necessary in future, add a branch to pass
   * apiKey directly to queryOptions.
   *
   * @param fn Function to execute with temporary API key
   * @returns Result of the function
   */
  protected withApiKey<T>(fn: () => T): T {
    const originalApiKey = process.env.CLAUDE_API_KEY;
    process.env.CLAUDE_API_KEY = config.claude.apiKey;

    try {
      return fn();
    } finally {
      if (originalApiKey !== undefined) {
        process.env.CLAUDE_API_KEY = originalApiKey;
      } else {
        delete process.env.CLAUDE_API_KEY;
      }
    }
  }

  /**
   * 2. Extract sessionId supporting both camelCase and snake_case
   *
   * SDK returns events with inconsistent formats, so we support both.
   * (Same implementation as existing chat-executor.ts:87-89)
   *
   * @param event Event object from SDK
   * @returns Extracted session ID if present
   */
  protected extractSessionId(event: any): string | undefined {
    return event.sessionId ?? event.session_id;
  }

  /**
   * 3. Create minimal common query options
   *
   * Only generates basic options (resume, systemPrompt, cwd).
   * Complex options (hooks, webSearch, mcpConfig) are added by
   * each client implementation.
   *
   * @param prompt User prompt/instruction
   * @param opts Optional parameters
   * @returns Query options object
   */
  protected createQueryOptions(
    prompt: string,
    opts: {
      resume?: boolean;
      sdkSessionId?: string;
      systemPrompt?: string;
      cwd?: string;
    },
  ): SDKQueryOptions {
    return {
      prompt,
      resume: opts.resume ?? false,
      sdkSessionId: opts.sdkSessionId,
      systemPrompt: opts.systemPrompt,
      cwd: opts.cwd ?? process.cwd(),
    };
  }
}

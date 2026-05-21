import type {
  SDKMessage,
  SDKUserMessage,
  HookEvent,
  HookCallbackMatcher,
} from "@anthropic-ai/claude-agent-sdk";

/**
 * Subset of `SDKControlGetContextUsageResponse` exposed to strategy consumers.
 * Kept loose with `unknown` for forward compatibility — strategies may pass
 * through the raw SDK response.
 */
export interface ContextUsageSnapshot {
  totalTokens: number;
  maxTokens: number;
  percentage: number;
  model?: string;
  categories?: Array<{ name: string; tokens: number }>;
}

/**
 * Prompt type - can be a simple string or an async iterable for streaming input
 */
export type PromptInput = string | AsyncIterable<SDKUserMessage>;

/**
 * Query options for Claude Code SDK
 * This matches the expected structure from @anthropic-ai/claude-agent-sdk
 */
export interface QueryOptions {
  prompt: PromptInput;
  abortController?: AbortController;
  options?: {
    maxTurns?: number;
    cwd?: string;
    allowedTools?: string[];
    disallowedTools?: string[];
    customSystemPrompt?: string;
    permissionMode?: "default" | "acceptEdits" | "bypassPermissions" | "plan";
    executable?: "bun" | "deno" | "node";
    executableArgs?: string[];
    mcpServers?: Record<string, any>;
    // Session continuation: Use 'resume' to specify session ID for continuation
    // Reference: https://docs.claude.com/en/api/agent-sdk/sessions
    // NOTE: 'continue: true' auto-loads the LATEST session (not recommended for multi-user apps)
    resume?: string; // Session ID to resume (Claude Code SDK parameter)
    forkSession?: boolean; // Fork session (true) or continue (false). Default should be false for continuation
    // NOTE: continueFromTaskId is NOT a Claude Code SDK parameter
    // It's only used in ClaudeCodeOptions to internally resolve the session ID

    // Hooks: PreToolUse/PostToolUse callbacks
    // Reference: https://docs.claude.com/en/api/agent-sdk/typescript
    hooks?: Partial<Record<HookEvent, HookCallbackMatcher[]>>;
    /**
     * Callback invoked with a context-window usage snapshot after each
     * assistant message (throttled). Best-effort: control requests are only
     * supported in streaming-input mode, so this may never fire for string
     * prompts. Errors are silently ignored.
     */
    onContextUsage?: (usage: ContextUsageSnapshot) => void | Promise<void>;
    /** Forward subagent text/thinking blocks (SDK 0.2.119+). */
    forwardSubagentText?: boolean;
    /** Generate AI summaries on `task_progress` events (SDK 0.2.72+). */
    agentProgressSummaries?: boolean;
  };
}

/**
 * Execution mode for Claude Code SDK
 */
export type ExecutionMode = "api-key" | "bedrock";

/**
 * Configuration for strategy creation
 */
export interface StrategyConfig {
  claudeApiKey?: string;
  awsAccessKeyId?: string;
  awsSecretAccessKey?: string;
  awsRegion?: string;
  forceBedrockModel?: string;
}

/**
 * Interface for Claude Code execution strategies
 */
export interface ClaudeCodeStrategy {
  /**
   * Execute Claude Code SDK query function
   * @param options Query options
   * @returns AsyncIterable of SDK messages
   */
  executeQuery(options: QueryOptions): AsyncIterable<SDKMessage>;

  /**
   * Get the model name used by this strategy
   * @returns Model name string
   */
  getModelName(): string;

  /**
   * Check if this strategy is available (has required credentials)
   * @returns true if strategy can be used
   */
  isAvailable(): boolean;

  /**
   * Get the execution mode of this strategy
   * @returns Execution mode identifier
   */
  getExecutionMode(): ExecutionMode;
}

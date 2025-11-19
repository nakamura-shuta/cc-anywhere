import type { SDKMessage, HookEvent, HookCallbackMatcher } from "@anthropic-ai/claude-agent-sdk";

/**
 * Query options for Claude Code SDK
 * This matches the expected structure from @anthropic-ai/claude-agent-sdk
 */
export interface QueryOptions {
  prompt: string;
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

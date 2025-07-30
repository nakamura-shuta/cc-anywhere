import type { SDKMessage } from "@anthropic-ai/claude-code";

/**
 * Query options for Claude Code SDK
 * This matches the expected structure from @anthropic-ai/claude-code
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
    continue?: boolean;
    resume?: string;
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

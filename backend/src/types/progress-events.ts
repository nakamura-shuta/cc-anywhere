/**
 * Type-safe Progress Event Definitions
 *
 * Provides strongly-typed progress event interfaces using discriminated unions
 * for better type safety and IDE support.
 */

/**
 * Base structure for all progress events
 */
interface BaseProgressEvent {
  type: string;
  message: string;
}

/**
 * Todo item structure for progress events (from Claude Code SDK)
 * This is a simplified version without id and priority fields
 */
export interface ProgressTodoItem {
  content: string;
  status: "pending" | "in_progress" | "completed";
  activeForm?: string;
}

/**
 * Token usage information
 */
export interface TokenUsage {
  input: number;
  output: number;
  cached?: number;
}

/**
 * Statistics data structure
 */
export interface StatisticsData {
  totalTurns?: number;
  totalToolCalls?: number;
  tokenUsage?: TokenUsage;
  processedFiles?: number;
  createdFiles?: number;
  modifiedFiles?: number;
  [key: string]: unknown; // Allow additional properties
}

// ==================== Individual Progress Event Types ====================

/**
 * Simple log message event
 */
export interface LogProgressEvent extends BaseProgressEvent {
  type: "log";
  message: string;
  data?: never;
}

/**
 * Tool execution start event
 */
export interface ToolStartProgressEvent extends BaseProgressEvent {
  type: "tool:start";
  message: string;
  data: {
    toolId?: string;
    tool: string;
    input?: unknown;
    formattedInput?: string;
    [key: string]: unknown; // Allow additional properties
  };
}

/**
 * Tool execution end event
 */
export interface ToolEndProgressEvent extends BaseProgressEvent {
  type: "tool:end";
  message: string;
  data: {
    toolId?: string;
    tool: string;
    output?: unknown;
    error?: Error | string;
    duration?: number;
    success?: boolean;
  };
}

/**
 * Claude response event (Codex SDK)
 */
export interface ClaudeResponseProgressEvent extends BaseProgressEvent {
  type: "claude:response";
  message: string;
  data?: {
    text?: string;
    turnNumber?: number;
    maxTurns?: number;
    [key: string]: unknown; // Allow additional properties
  };
}

/**
 * Reasoning/Extended Thinking event (Codex SDK v0.52.0+)
 */
export interface ReasoningProgressEvent extends BaseProgressEvent {
  type: "reasoning";
  message: string;
  data: {
    id?: string;
    text: string;
  };
}

/**
 * TODO list update event
 */
export interface TodoUpdateProgressEvent extends BaseProgressEvent {
  type: "todo_update";
  message: string;
  data: {
    todos: ProgressTodoItem[];
  };
}

/**
 * General progress message event
 */
export interface GeneralProgressEvent extends BaseProgressEvent {
  type: "progress";
  message: string;
  data?: never;
}

/**
 * Summary message event
 */
export interface SummaryProgressEvent extends BaseProgressEvent {
  type: "summary";
  message: string;
  data?: never;
}

/**
 * Statistics update event
 */
export interface StatisticsProgressEvent extends BaseProgressEvent {
  type: "statistics";
  message: string;
  data: StatisticsData;
}

/**
 * Tool usage event
 */
export interface ToolUsageProgressEvent extends BaseProgressEvent {
  type: "tool_usage";
  message: string;
  data?: {
    tool?: string;
    status?: string;
    [key: string]: unknown;
  };
}

/**
 * PreToolUse hook event
 */
export interface HookPreToolUseProgressEvent extends BaseProgressEvent {
  type: "hook:pre_tool_use";
  message: string;
  data: {
    toolName: string;
    toolInput?: Record<string, unknown>;
    decision?: "approve" | "block";
    error?: string;
  };
}

/**
 * PostToolUse hook event
 */
export interface HookPostToolUseProgressEvent extends BaseProgressEvent {
  type: "hook:post_tool_use";
  message: string;
  data: {
    toolName: string;
    toolInput?: Record<string, unknown>;
    toolOutput?: unknown;
    error?: string;
  };
}

/**
 * Subagent task status update event (SDK v0.2.104+)
 * Emitted when a subagent's task status changes (e.g. pending → running → completed).
 */
export interface TaskUpdatedProgressEvent extends BaseProgressEvent {
  type: "task:updated";
  message: string;
  data: {
    taskId: string;
    status?: "pending" | "running" | "completed" | "failed" | "killed";
    description?: string;
    error?: string;
    isBackgrounded?: boolean;
  };
}

/**
 * Subagent started event (SDK 0.2.46+ `SDKTaskStartedMessage`).
 * Emitted when the Agent tool spawns a subagent task.
 */
export interface SubagentStartedProgressEvent extends BaseProgressEvent {
  type: "subagent:started";
  message: string;
  data: {
    taskId: string;
    toolUseId?: string;
    description: string;
    subagentType?: string;
    taskType?: string;
    prompt?: string;
  };
}

/**
 * Subagent progress event (SDK 0.2.51+ `SDKTaskProgressMessage`).
 * Emitted periodically while a subagent is running. When the parent session
 * is started with `agentProgressSummaries: true`, `summary` carries a short
 * present-tense description (e.g. "Analyzing authentication module").
 */
export interface SubagentProgressProgressEvent extends BaseProgressEvent {
  type: "subagent:progress";
  message: string;
  data: {
    taskId: string;
    toolUseId?: string;
    description: string;
    subagentType?: string;
    lastToolName?: string;
    summary?: string;
    usage?: {
      totalTokens: number;
      toolUses: number;
      durationMs: number;
    };
  };
}

/**
 * Subagent completed event (SDK 0.2.46+ `SDKTaskNotificationMessage`).
 * Emitted when a subagent settles (completed/failed/stopped).
 */
export interface SubagentCompletedProgressEvent extends BaseProgressEvent {
  type: "subagent:completed";
  message: string;
  data: {
    taskId: string;
    toolUseId?: string;
    status: "completed" | "failed" | "stopped";
    summary: string;
    usage?: {
      totalTokens: number;
      toolUses: number;
      durationMs: number;
    };
  };
}

/**
 * API retry event (Claude SDK 0.2.78+).
 * Emitted when the SDK retries a transient API error.
 */
export interface ApiRetryProgressEvent extends BaseProgressEvent {
  type: "api:retry";
  message: string;
  data: {
    attempt: number;
    maxRetries: number;
    retryDelayMs: number;
    errorStatus: number | null;
    errorMessage?: string;
  };
}

/**
 * Session status event (Claude SDK 0.2.108+).
 * Emitted when the SDK reports an in-flight status (`requesting`, `compacting`).
 */
export interface SessionStatusProgressEvent extends BaseProgressEvent {
  type: "session:status";
  message: string;
  data: {
    status: "requesting" | "compacting" | "idle";
    /** Optional permission mode reported by the SDK. */
    permissionMode?: string;
    /** Compaction outcome when status transitions out of `compacting`. */
    compactResult?: "success" | "failed";
    compactError?: string;
  };
}

/**
 * Context window usage event (Claude SDK 0.2.86+).
 * Emitted periodically during task execution so the UI can show how much of the
 * model's context window is consumed.
 */
export interface ContextUsageProgressEvent extends BaseProgressEvent {
  type: "context:usage";
  message: string;
  data: {
    totalTokens: number;
    maxTokens: number;
    percentage: number;
    model?: string;
    /** Top-level breakdown by category (system prompt, messages, MCP tools, ...). */
    categories?: Array<{ name: string; tokens: number }>;
  };
}

/**
 * Result-message metadata event (Claude SDK 0.2.32 / 0.2.95 / 0.3.144).
 * Surfaces `terminal_reason`, `stop_reason`, and `api_error_status` from the
 * end-of-turn result message so the UI can show *why* a task ended.
 */
export interface ResultMetadataProgressEvent extends BaseProgressEvent {
  type: "result:metadata";
  message: string;
  data: {
    /** result message subtype: success / error_during_execution / error_max_turns / ... */
    subtype: string;
    isError: boolean;
    /**
     * Why the query loop terminated. See SDK `TerminalReason` for full list:
     * `completed` / `aborted_tools` / `max_turns` / `blocking_limit` /
     * `prompt_too_long` / `model_error` / etc.
     */
    terminalReason?: string;
    /** Model-level stop reason (e.g. `end_turn`, `tool_use`, `max_tokens`). */
    stopReason?: string | null;
    /** HTTP status if the failure was an API error (e.g. 401, 404, 500). */
    apiErrorStatus?: number | null;
    /** Errors reported in result.errors[]. */
    errors?: string[];
    /** Permission denials reported in result.permission_denials. */
    permissionDenials?: number;
    durationMs?: number;
    numTurns?: number;
  };
}

// ==================== Union Type ====================

/**
 * Discriminated union of all progress event types
 *
 * Use type narrowing with switch/case on the `type` field:
 * ```typescript
 * function handleProgress(event: ProgressEvent) {
 *   switch (event.type) {
 *     case "tool:start":
 *       // TypeScript knows event.data.tool exists here
 *       console.log(event.data.tool);
 *       break;
 *     case "log":
 *       // TypeScript knows event.data is never here
 *       console.log(event.message);
 *       break;
 *   }
 * }
 * ```
 */
export type ProgressEvent =
  | LogProgressEvent
  | ToolStartProgressEvent
  | ToolEndProgressEvent
  | ClaudeResponseProgressEvent
  | ReasoningProgressEvent
  | TodoUpdateProgressEvent
  | GeneralProgressEvent
  | SummaryProgressEvent
  | StatisticsProgressEvent
  | ToolUsageProgressEvent
  | HookPreToolUseProgressEvent
  | HookPostToolUseProgressEvent
  | TaskUpdatedProgressEvent
  | SubagentStartedProgressEvent
  | SubagentProgressProgressEvent
  | SubagentCompletedProgressEvent
  | ApiRetryProgressEvent
  | SessionStatusProgressEvent
  | ContextUsageProgressEvent
  | ResultMetadataProgressEvent;

// ==================== Type Guards ====================

/**
 * Type guard for ToolStartProgressEvent
 */
export function isToolStartEvent(event: ProgressEvent): event is ToolStartProgressEvent {
  return event.type === "tool:start";
}

/**
 * Type guard for ToolEndProgressEvent
 */
export function isToolEndEvent(event: ProgressEvent): event is ToolEndProgressEvent {
  return event.type === "tool:end";
}

/**
 * Type guard for ClaudeResponseProgressEvent
 */
export function isClaudeResponseEvent(event: ProgressEvent): event is ClaudeResponseProgressEvent {
  return event.type === "claude:response";
}

/**
 * Type guard for ReasoningProgressEvent
 */
export function isReasoningEvent(event: ProgressEvent): event is ReasoningProgressEvent {
  return event.type === "reasoning";
}

/**
 * Type guard for TodoUpdateProgressEvent
 */
export function isTodoUpdateEvent(event: ProgressEvent): event is TodoUpdateProgressEvent {
  return event.type === "todo_update";
}

/**
 * Type guard for StatisticsProgressEvent
 */
export function isStatisticsEvent(event: ProgressEvent): event is StatisticsProgressEvent {
  return event.type === "statistics";
}

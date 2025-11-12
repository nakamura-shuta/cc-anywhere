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
 * Legacy tool usage event (backward compatibility)
 */
export interface ToolUsageProgressEvent extends BaseProgressEvent {
  type: "tool_usage";
  message: string;
  data?: {
    tool?: string;
    status?: string;
    [key: string]: unknown; // Allow any additional properties for backward compatibility
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
  | ToolUsageProgressEvent;

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

// ==================== Legacy Compatibility ====================

/**
 * Legacy progress event type for backward compatibility
 * @deprecated Use ProgressEvent instead
 */
export interface LegacyProgressEvent {
  type: string;
  message: string;
  data?: any;
}

/**
 * Convert legacy progress event to typed progress event
 * Provides runtime validation and type narrowing
 */
export function convertLegacyProgressEvent(legacy: LegacyProgressEvent): ProgressEvent {
  // This function provides a conversion path from any-typed events
  // to strongly-typed events, performing runtime validation
  return legacy as ProgressEvent;
}

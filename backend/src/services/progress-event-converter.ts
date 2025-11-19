import type {
  AgentExecutionEvent,
  AgentProgressEvent,
  AgentToolStartEvent,
  AgentToolEndEvent,
  AgentResponseEvent,
  AgentStatisticsEvent,
  AgentHookPreToolUseEvent,
  AgentHookPostToolUseEvent,
} from "../agents/types.js";
import { logger } from "../utils/logger.js";

/**
 * ProgressEventConverter: 進捗イベント変換の共通化クラス
 *
 * ClaudeとCodex executorで重複している進捗イベント変換ロジックを統合。
 * ProgressEvent → AgentExecutionEvent, Codex SDK events → AgentExecutionEvent の変換を提供。
 *
 * NOTE: このクラスは src/utils/progress-formatter.ts の ProgressFormatter（ログメッセージフォーマット用）とは
 * 異なる役割を持ちます。混同を避けるため、明示的に EventConverter という名前を使用しています。
 */
export class ProgressEventConverter {
  /**
   * Claude SDK ProgressEvent を AgentExecutionEvent に変換
   * @param progress - ProgressEvent (type, message, data を持つオブジェクト)
   * @returns AgentExecutionEvent | null - 変換されたイベント、変換不要な場合はnull
   */
  static convertProgressToEvent(progress: {
    type: string;
    message: string;
    data?: any;
  }): AgentExecutionEvent | null {
    switch (progress.type) {
      case "log":
        return {
          type: "agent:progress",
          message: progress.message,
          timestamp: new Date(),
        } as AgentProgressEvent;

      case "progress":
        return {
          type: "agent:progress",
          message: progress.message,
          data: progress.data,
          timestamp: new Date(),
        } as AgentProgressEvent;

      case "tool:start":
        return {
          type: "agent:tool:start",
          tool: progress.data?.tool || "unknown",
          toolId: progress.data?.toolId,
          input: progress.data?.input,
          timestamp: new Date(),
        } as AgentToolStartEvent;

      case "tool:end":
        return {
          type: "agent:tool:end",
          tool: progress.data?.tool || "unknown",
          toolId: progress.data?.toolId,
          output: progress.data?.output,
          error: progress.data?.error,
          duration: progress.data?.duration,
          success: !progress.data?.error,
          timestamp: new Date(),
        } as AgentToolEndEvent;

      case "claude:response":
        return {
          type: "agent:response",
          text: progress.message || progress.data?.text || "",
          turnNumber: progress.data?.turnNumber,
          timestamp: new Date(),
        } as AgentResponseEvent;

      case "statistics":
        return {
          type: "agent:statistics",
          totalTurns: progress.data?.totalTurns || 0,
          totalToolCalls: progress.data?.totalToolCalls || 0,
          toolStats: progress.data?.toolStats || {},
          elapsedTime: progress.data?.elapsedTime || 0,
          tokenUsage: progress.data?.tokenUsage,
          timestamp: new Date(),
        } as AgentStatisticsEvent;

      case "todo_update":
      case "tool_usage":
      case "summary":
        // These event types are Claude-specific and don't map directly
        // They can be logged but not converted to standard AgentExecutionEvent
        return {
          type: "agent:progress",
          message: progress.message,
          data: progress.data,
          timestamp: new Date(),
        } as AgentProgressEvent;

      case "hook:pre_tool_use":
        return {
          type: "agent:hook:pre_tool_use",
          toolName: progress.data?.toolName || "unknown",
          toolInput: progress.data?.toolInput,
          decision: progress.data?.decision,
          error: progress.data?.error,
          timestamp: new Date(),
        } as AgentHookPreToolUseEvent;

      case "hook:post_tool_use":
        return {
          type: "agent:hook:post_tool_use",
          toolName: progress.data?.toolName || "unknown",
          toolInput: progress.data?.toolInput,
          toolOutput: progress.data?.toolOutput,
          error: progress.data?.error,
          timestamp: new Date(),
        } as AgentHookPostToolUseEvent;

      default:
        // Unknown event type - treat as progress
        logger.debug("Unknown progress event type", { type: progress.type });
        return {
          type: "agent:progress",
          message: progress.message,
          timestamp: new Date(),
        } as AgentProgressEvent;
    }
  }

  /**
   * Codex SDK イベントを AgentExecutionEvent に変換
   * Phase 0検証結果に基づくイベント変換ロジック
   * @param codexEvent - Codex SDK のイベントオブジェクト
   * @returns AgentExecutionEvent | null - 変換されたイベント、変換不要な場合はnull
   */
  static convertCodexEvent(codexEvent: any): AgentExecutionEvent | null {
    switch (codexEvent.type) {
      case "thread.started":
        return {
          type: "agent:progress",
          message: "Thread started",
          timestamp: new Date(),
        };

      case "turn.started":
        return {
          type: "agent:progress",
          message: "Turn started",
          timestamp: new Date(),
        };

      case "item.started":
        if (codexEvent.item.type === "command_execution") {
          return {
            type: "agent:tool:start",
            tool: "Bash",
            toolId: codexEvent.item.id,
            input: { command: codexEvent.item.command },
            timestamp: new Date(),
          };
        }
        break;

      case "item.completed":
        if (codexEvent.item.type === "command_execution") {
          return {
            type: "agent:tool:end",
            tool: "Bash",
            toolId: codexEvent.item.id,
            output: codexEvent.item.aggregated_output,
            success: codexEvent.item.exit_code === 0,
            duration: 0, // TODO: Calculate duration
            timestamp: new Date(),
          };
        } else if (codexEvent.item.type === "reasoning") {
          // Codex SDK v0.52.0+ reasoning item
          return {
            type: "agent:reasoning",
            id: codexEvent.item.id,
            text: codexEvent.item.text,
            timestamp: new Date(),
          };
        } else if (codexEvent.item.type === "agent_message") {
          return {
            type: "agent:response",
            text: codexEvent.item.text,
            timestamp: new Date(),
          };
        }
        break;

      case "turn.completed":
        return {
          type: "agent:statistics",
          totalTurns: 1, // TODO: Track turn count
          totalToolCalls: 0, // TODO: Track tool calls
          toolStats: {},
          elapsedTime: 0,
          tokenUsage: codexEvent.usage
            ? {
                input: codexEvent.usage.input_tokens || 0,
                output: codexEvent.usage.output_tokens || 0,
                cached: codexEvent.usage.cached_input_tokens || 0,
              }
            : undefined,
          timestamp: new Date(),
        };

      case "turn.failed":
        logger.warn("Turn failed", { error: codexEvent.error });
        return {
          type: "agent:progress",
          message: `Turn failed: ${codexEvent.error || "Unknown error"}`,
          timestamp: new Date(),
        };
    }

    return null;
  }
}

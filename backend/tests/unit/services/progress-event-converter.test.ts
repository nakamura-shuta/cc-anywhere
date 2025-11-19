import { describe, it, expect } from "vitest";
import { ProgressEventConverter } from "../../../src/services/progress-event-converter.js";
import type {
  AgentProgressEvent,
  AgentToolStartEvent,
  AgentToolEndEvent,
  AgentResponseEvent,
  AgentStatisticsEvent,
  AgentHookPreToolUseEvent,
  AgentHookPostToolUseEvent,
} from "../../../src/agents/types.js";

describe("ProgressEventConverter", () => {
  describe("convertProgressToEvent", () => {
    it("should convert log type progress event", () => {
      const progress = {
        type: "log",
        message: "Processing task",
      };

      const result = ProgressEventConverter.convertProgressToEvent(progress);

      expect(result).toMatchObject({
        type: "agent:progress",
        message: "Processing task",
      });
      expect(result?.timestamp).toBeInstanceOf(Date);
    });

    it("should convert tool:start progress event", () => {
      const progress = {
        type: "tool:start",
        message: "",
        data: {
          tool: "bash",
          input: { command: "ls -la" },
        },
      };

      const result = ProgressEventConverter.convertProgressToEvent(progress) as AgentToolStartEvent;

      expect(result).toMatchObject({
        type: "agent:tool:start",
        tool: "bash",
        input: { command: "ls -la" },
      });
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it("should convert tool:end progress event", () => {
      const progress = {
        type: "tool:end",
        message: "",
        data: {
          tool: "bash",
          output: "file1\nfile2",
        },
      };

      const result = ProgressEventConverter.convertProgressToEvent(progress) as AgentToolEndEvent;

      expect(result).toMatchObject({
        type: "agent:tool:end",
        tool: "bash",
        output: "file1\nfile2",
      });
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it("should convert claude:response progress event", () => {
      const progress = {
        type: "claude:response",
        message: "Task completed successfully",
      };

      const result = ProgressEventConverter.convertProgressToEvent(progress) as AgentResponseEvent;

      expect(result).toMatchObject({
        type: "agent:response",
        text: "Task completed successfully",
      });
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it("should convert statistics progress event", () => {
      const progress = {
        type: "statistics",
        message: "",
        data: {
          totalTurns: 5,
          totalToolCalls: 10,
          toolStats: { bash: 5, read: 5 },
          elapsedTime: 1000,
          tokenUsage: {
            inputTokens: 100,
            outputTokens: 50,
          },
        },
      };

      const result = ProgressEventConverter.convertProgressToEvent(
        progress,
      ) as AgentStatisticsEvent;

      expect(result).toMatchObject({
        type: "agent:statistics",
        totalTurns: 5,
        totalToolCalls: 10,
        toolStats: { bash: 5, read: 5 },
        elapsedTime: 1000,
        tokenUsage: {
          inputTokens: 100,
          outputTokens: 50,
        },
      });
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it("should convert unknown progress event type to agent:progress", () => {
      const progress = {
        type: "unknown",
        message: "test",
      };

      const result = ProgressEventConverter.convertProgressToEvent(progress);

      expect(result).toMatchObject({
        type: "agent:progress",
        message: "test",
      });
      expect(result?.timestamp).toBeInstanceOf(Date);
    });

    it("should handle progress events with missing data gracefully", () => {
      const progress = {
        type: "tool:start",
        message: "",
      };

      const result = ProgressEventConverter.convertProgressToEvent(progress) as AgentToolStartEvent;

      expect(result).toMatchObject({
        type: "agent:tool:start",
        tool: "unknown", // Falls back to "unknown" when data.tool is missing
        input: undefined,
      });
    });

    it("should convert hook:pre_tool_use progress event", () => {
      const progress = {
        type: "hook:pre_tool_use",
        message: "Tool: Bash",
        data: {
          toolName: "Bash",
          toolInput: { command: "ls -la" },
          decision: "approve",
        },
      };

      const result = ProgressEventConverter.convertProgressToEvent(
        progress,
      ) as AgentHookPreToolUseEvent;

      expect(result).toMatchObject({
        type: "agent:hook:pre_tool_use",
        toolName: "Bash",
        toolInput: { command: "ls -la" },
        decision: "approve",
      });
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it("should convert hook:pre_tool_use with block decision", () => {
      const progress = {
        type: "hook:pre_tool_use",
        message: "Tool: Write",
        data: {
          toolName: "Write",
          toolInput: { path: "/etc/passwd" },
          decision: "block",
          error: "Blocked by security policy",
        },
      };

      const result = ProgressEventConverter.convertProgressToEvent(
        progress,
      ) as AgentHookPreToolUseEvent;

      expect(result).toMatchObject({
        type: "agent:hook:pre_tool_use",
        toolName: "Write",
        decision: "block",
        error: "Blocked by security policy",
      });
    });

    it("should convert hook:post_tool_use progress event", () => {
      const progress = {
        type: "hook:post_tool_use",
        message: "Tool: Bash",
        data: {
          toolName: "Bash",
          toolInput: { command: "echo hello" },
          toolOutput: "hello\n",
        },
      };

      const result = ProgressEventConverter.convertProgressToEvent(
        progress,
      ) as AgentHookPostToolUseEvent;

      expect(result).toMatchObject({
        type: "agent:hook:post_tool_use",
        toolName: "Bash",
        toolInput: { command: "echo hello" },
        toolOutput: "hello\n",
      });
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it("should convert hook:post_tool_use with error", () => {
      const progress = {
        type: "hook:post_tool_use",
        message: "Tool: Read",
        data: {
          toolName: "Read",
          toolInput: { path: "/nonexistent" },
          error: "File not found",
        },
      };

      const result = ProgressEventConverter.convertProgressToEvent(
        progress,
      ) as AgentHookPostToolUseEvent;

      expect(result).toMatchObject({
        type: "agent:hook:post_tool_use",
        toolName: "Read",
        error: "File not found",
      });
    });

    it("should handle hook events with missing data gracefully", () => {
      const progress = {
        type: "hook:pre_tool_use",
        message: "",
      };

      const result = ProgressEventConverter.convertProgressToEvent(
        progress,
      ) as AgentHookPreToolUseEvent;

      expect(result).toMatchObject({
        type: "agent:hook:pre_tool_use",
        toolName: "unknown",
      });
    });
  });

  describe("convertCodexEvent", () => {
    it("should convert thread.started event", () => {
      const codexEvent = {
        type: "thread.started",
        thread_id: "thread_123",
      };

      const result = ProgressEventConverter.convertCodexEvent(codexEvent) as AgentProgressEvent;

      expect(result).toMatchObject({
        type: "agent:progress",
        message: "Thread started",
      });
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it("should convert item.started with command_execution", () => {
      const codexEvent = {
        type: "item.started",
        item: {
          type: "command_execution",
          command: { program: "bash", args: ["-c", "echo hello"] },
        },
      };

      const result = ProgressEventConverter.convertCodexEvent(codexEvent) as AgentToolStartEvent;

      expect(result).toMatchObject({
        type: "agent:tool:start",
        tool: "Bash",
      });
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it("should convert item.completed with command_execution", () => {
      const codexEvent = {
        type: "item.completed",
        item: {
          type: "command_execution",
          id: "cmd_123",
          aggregated_output: "hello",
          exit_code: 0,
        },
      };

      const result = ProgressEventConverter.convertCodexEvent(codexEvent) as AgentToolEndEvent;

      expect(result).toMatchObject({
        type: "agent:tool:end",
        tool: "Bash",
        output: "hello",
        success: true,
      });
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it("should convert item.completed with agent_message", () => {
      const codexEvent = {
        type: "item.completed",
        item: {
          type: "agent_message",
          text: "Analysis complete",
        },
      };

      const result = ProgressEventConverter.convertCodexEvent(codexEvent) as AgentResponseEvent;

      expect(result).toMatchObject({
        type: "agent:response",
        text: "Analysis complete",
      });
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it("should convert turn.completed event", () => {
      const codexEvent = {
        type: "turn.completed",
        usage: {
          input_tokens: 200,
          output_tokens: 100,
        },
      };

      const result = ProgressEventConverter.convertCodexEvent(codexEvent) as AgentStatisticsEvent;

      expect(result).toMatchObject({
        type: "agent:statistics",
        totalTurns: 1,
        totalToolCalls: 0,
      });
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it("should convert turn.failed event", () => {
      const codexEvent = {
        type: "turn.failed",
        error: "Connection timeout",
      };

      const result = ProgressEventConverter.convertCodexEvent(codexEvent) as AgentProgressEvent;

      expect(result).toMatchObject({
        type: "agent:progress",
        message: "Turn failed: Connection timeout",
      });
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it("should return null for unknown codex event type", () => {
      const codexEvent = {
        type: "unknown.event",
      };

      const result = ProgressEventConverter.convertCodexEvent(codexEvent);

      expect(result).toBeNull();
    });
  });
});

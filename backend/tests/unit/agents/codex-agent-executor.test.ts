/**
 * CodexAgentExecutor unit tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type {
  AgentTaskRequest,
  AgentExecutionEvent,
  AgentExecutionOptions,
} from "../../../src/agents/types.js";

// Mock Codex SDK
const mockCodex = {
  startThread: vi.fn(),
};

const mockThread = {
  runStreamed: vi.fn(),
};

vi.mock("@openai/codex-sdk", () => ({
  Codex: vi.fn(() => mockCodex),
}));

// Import after mocking
const { CodexAgentExecutor } = await import("../../../src/agents/codex-agent-executor.js");

describe("CodexAgentExecutor", () => {
  let executor: any;

  beforeEach(() => {
    vi.clearAllMocks();
    executor = new CodexAgentExecutor();
    mockCodex.startThread.mockReturnValue(mockThread);
  });

  describe("getExecutorType", () => {
    it("should return 'codex'", () => {
      expect(executor.getExecutorType()).toBe("codex");
    });
  });

  describe("isAvailable", () => {
    it("should return true when OPENAI_API_KEY is configured", async () => {
      // Import config and check if apiKey exists
      const { config } = await import("../../../src/config/index.js");
      const hasApiKey = !!config.openai.apiKey;

      expect(executor.isAvailable()).toBe(hasApiKey);
    });

    it("should check config.openai.apiKey", async () => {
      // Verify that isAvailable checks the config
      const { config } = await import("../../../src/config/index.js");

      // The result should match whether apiKey is set
      const result = executor.isAvailable();
      const expected = !!config.openai.apiKey;

      expect(result).toBe(expected);
    });
  });

  describe("executeTask", () => {
    it("should emit agent:start event", async () => {
      const request: AgentTaskRequest = {
        instruction: "echo hello",
      };

      const options: AgentExecutionOptions = {
        taskId: "test-task-1",
      };

      // Mock streaming response with async iterator
      const mockEvents = [
        { type: "thread.started" },
        { type: "turn.completed", usage: { input_tokens: 100, output_tokens: 50 } },
      ];

      const asyncIterator = (async function* () {
        for (const event of mockEvents) {
          yield event;
        }
      })();

      mockThread.runStreamed.mockResolvedValue({
        events: asyncIterator,
      });

      const events: AgentExecutionEvent[] = [];
      for await (const event of executor.executeTask(request, options)) {
        events.push(event);
      }

      expect(events[0]).toMatchObject({
        type: "agent:start",
        executor: "codex",
      });
    });

    it("should use workspace-write sandbox mode by default", async () => {
      const request: AgentTaskRequest = {
        instruction: "create test.ts",
      };

      const options: AgentExecutionOptions = {
        taskId: "test-task-2",
      };

      const asyncIterator2 = (async function* () {
        yield { type: "turn.completed", usage: {} };
      })();

      mockThread.runStreamed.mockResolvedValue({
        events: asyncIterator2,
      });

      // Collect all events
      const events: AgentExecutionEvent[] = [];
      for await (const event of executor.executeTask(request, options)) {
        events.push(event);
      }

      expect(mockCodex.startThread).toHaveBeenCalledWith({
        skipGitRepoCheck: true,
        sandboxMode: "workspace-write",
      });
    });

    it("should respect custom codex options", async () => {
      const request: AgentTaskRequest = {
        instruction: "test instruction",
        options: {
          codex: {
            sandboxMode: "read-only",
            skipGitRepoCheck: false,
            maxTurns: 10,
          },
        },
      };

      const options: AgentExecutionOptions = {
        taskId: "test-task-3",
      };

      const asyncIterator2 = (async function* () {
        yield { type: "turn.completed", usage: {} };
      })();

      mockThread.runStreamed.mockResolvedValue({
        events: asyncIterator2,
      });

      const events: AgentExecutionEvent[] = [];
      for await (const event of executor.executeTask(request, options)) {
        events.push(event);
      }

      expect(mockCodex.startThread).toHaveBeenCalledWith({
        skipGitRepoCheck: false,
        sandboxMode: "read-only",
      });
    });

    it("should convert codex events to agent events", async () => {
      const request: AgentTaskRequest = {
        instruction: "echo test",
      };

      const options: AgentExecutionOptions = {
        taskId: "test-task-4",
      };

      const mockEvents = [
        { type: "thread.started" },
        {
          type: "item.started",
          item: {
            id: "item-1",
            type: "command_execution",
            command: "echo test",
          },
        },
        {
          type: "item.completed",
          item: {
            id: "item-1",
            type: "command_execution",
            command: "echo test",
            aggregated_output: "test\n",
            exit_code: 0,
          },
        },
        {
          type: "turn.completed",
          usage: {
            input_tokens: 100,
            output_tokens: 50,
            cached_input_tokens: 0,
          },
        },
      ];

      const asyncIterator3 = (async function* () {
        for (const event of mockEvents) {
          yield event;
        }
      })();

      mockThread.runStreamed.mockResolvedValue({
        events: asyncIterator3,
      });

      const events: AgentExecutionEvent[] = [];
      for await (const event of executor.executeTask(request, options)) {
        events.push(event);
      }

      // Check start event
      expect(events[0]).toMatchObject({
        type: "agent:start",
        executor: "codex",
      });

      // Check tool start event
      const toolStartEvent = events.find((e) => e.type === "agent:tool:start");
      expect(toolStartEvent).toMatchObject({
        type: "agent:tool:start",
        tool: "Bash",
        toolId: "item-1",
      });

      // Check tool end event
      const toolEndEvent = events.find((e) => e.type === "agent:tool:end");
      expect(toolEndEvent).toMatchObject({
        type: "agent:tool:end",
        tool: "Bash",
        toolId: "item-1",
        success: true,
      });

      // Check statistics event
      const statsEvent = events.find((e) => e.type === "agent:statistics");
      expect(statsEvent).toMatchObject({
        type: "agent:statistics",
        tokenUsage: {
          input: 100,
          output: 50,
          cached: 0,
        },
      });

      // Check completed event
      const completedEvent = events.find((e) => e.type === "agent:completed");
      expect(completedEvent).toBeDefined();
    });

    it("should handle agent message events", async () => {
      const request: AgentTaskRequest = {
        instruction: "explain this code",
      };

      const options: AgentExecutionOptions = {
        taskId: "test-task-5",
      };

      const mockEvents = [
        { type: "thread.started" },
        {
          type: "item.completed",
          item: {
            id: "item-1",
            type: "agent_message",
            text: "This is a response from the agent",
          },
        },
        {
          type: "turn.completed",
          usage: { input_tokens: 50, output_tokens: 100 },
        },
      ];

      const asyncIterator4 = (async function* () {
        for (const event of mockEvents) {
          yield event;
        }
      })();

      mockThread.runStreamed.mockResolvedValue({
        events: asyncIterator4,
      });

      const events: AgentExecutionEvent[] = [];
      for await (const event of executor.executeTask(request, options)) {
        events.push(event);
      }

      const responseEvent = events.find((e) => e.type === "agent:response");
      expect(responseEvent).toMatchObject({
        type: "agent:response",
        text: "This is a response from the agent",
      });
    });

    it("should emit failed event on error", async () => {
      const request: AgentTaskRequest = {
        instruction: "failing task",
      };

      const options: AgentExecutionOptions = {
        taskId: "test-task-6",
      };

      mockThread.runStreamed.mockRejectedValue(new Error("Codex execution failed"));

      const events: AgentExecutionEvent[] = [];
      for await (const event of executor.executeTask(request, options)) {
        events.push(event);
      }

      const failedEvent = events.find((e) => e.type === "agent:failed");
      expect(failedEvent).toBeDefined();
      expect((failedEvent as any).error.message).toBe("Codex execution failed");
    });

    it("should handle turn.failed event", async () => {
      const request: AgentTaskRequest = {
        instruction: "task that fails",
      };

      const options: AgentExecutionOptions = {
        taskId: "test-task-7",
      };

      const mockEvents = [
        { type: "thread.started" },
        {
          type: "turn.failed",
          error: "Task execution failed",
        },
      ];

      const asyncIterator5 = (async function* () {
        for (const event of mockEvents) {
          yield event;
        }
      })();

      mockThread.runStreamed.mockResolvedValue({
        events: asyncIterator5,
      });

      const events: AgentExecutionEvent[] = [];
      for await (const event of executor.executeTask(request, options)) {
        events.push(event);
      }

      // Should still complete (not fail) since the error is handled
      const completedEvent = events.find((e) => e.type === "agent:completed");
      expect(completedEvent).toBeDefined();
    });
  });

  describe("cancelTask", () => {
    it("should cancel a running task", async () => {
      const taskId = "test-task-cancel";

      // Start a task
      const request: AgentTaskRequest = {
        instruction: "long running task",
      };

      const options: AgentExecutionOptions = {
        taskId,
      };

      // Mock a long-running stream
      const returnFn = vi.fn().mockResolvedValue({ done: true, value: undefined });

      const asyncIterator6 = (async function* () {
        yield { type: "thread.started" };
        // Simulate long-running task
        await new Promise((resolve) => setTimeout(resolve, 100));
        yield { type: "turn.completed", usage: {} };
      })();

      // Add return method to the iterator
      (asyncIterator6 as any).return = returnFn;

      mockThread.runStreamed.mockResolvedValue({
        events: asyncIterator6,
      });

      // Start execution (don't await)
      const executionPromise = (async () => {
        const events: AgentExecutionEvent[] = [];
        try {
          for await (const event of executor.executeTask(request, options)) {
            events.push(event);
          }
        } catch (e) {
          // Expect cancellation error
        }
        return events;
      })();

      // Cancel after a short delay
      await new Promise((resolve) => setTimeout(resolve, 20));
      await executor.cancelTask(taskId);

      // Wait for execution to finish
      await executionPromise;

      // Verify the iterator.return was called
      expect(returnFn).toHaveBeenCalled();
    });

    it("should handle cancelling non-existent task", async () => {
      await expect(executor.cancelTask("non-existent-task")).resolves.toBeUndefined();
    });
  });
});

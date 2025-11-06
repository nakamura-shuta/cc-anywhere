/**
 * ClaudeAgentExecutor Unit Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { ClaudeAgentExecutor } from "../../../src/agents/claude-agent-executor.js";
import type { AgentTaskRequest, AgentExecutionEvent } from "../../../src/agents/types.js";
import { EXECUTOR_TYPES } from "../../../src/agents/types.js";

// Mock dependencies
vi.mock("../../../src/utils/logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("../../../src/config/index.js", () => ({
  config: {
    claude: {
      apiKey: "test-api-key",
    },
  },
}));

// Mock Claude Code SDK
const mockExecuteTask = vi.fn();
const mockGetCurrentMode = vi.fn().mockReturnValue("agent-sdk");
const mockGetModelName = vi.fn().mockReturnValue("claude-sonnet-4");

vi.mock("../../../src/claude/shared-instance.js", () => ({
  getSharedClaudeClient: vi.fn(() => ({
    executeTask: mockExecuteTask,
    getCurrentMode: mockGetCurrentMode,
    getModelName: mockGetModelName,
  })),
}));

describe("ClaudeAgentExecutor", () => {
  let executor: ClaudeAgentExecutor;

  beforeEach(() => {
    executor = new ClaudeAgentExecutor();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("getExecutorType", () => {
    it("should return 'claude' executor type", () => {
      expect(executor.getExecutorType()).toBe(EXECUTOR_TYPES.CLAUDE);
    });
  });

  describe("isAvailable", () => {
    it("should return true when API key is configured", () => {
      expect(executor.isAvailable()).toBe(true);
    });
  });

  describe("executeTask", () => {
    it("should yield agent:start event at the beginning", async () => {
      const request: AgentTaskRequest = {
        instruction: "Test instruction",
      };

      mockExecuteTask.mockResolvedValue({
        success: true,
        messages: [],
        sessionId: "test-session",
        tracker: {
          getTodos: () => [],
        },
      });

      const events: AgentExecutionEvent[] = [];
      for await (const event of executor.executeTask(request, {})) {
        events.push(event);
      }

      expect(events[0]).toMatchObject({
        type: "agent:start",
        executor: EXECUTOR_TYPES.CLAUDE,
      });
      expect(events[0].timestamp).toBeInstanceOf(Date);
    });

    it("should yield agent:completed event on successful execution", async () => {
      const request: AgentTaskRequest = {
        instruction: "Test instruction",
      };

      const mockResult = {
        success: true,
        messages: [{ role: "assistant", content: "Test output" }],
        sessionId: "test-session",
        tracker: {
          getTodos: () => [],
        },
      };

      mockExecuteTask.mockResolvedValue(mockResult);

      const events: AgentExecutionEvent[] = [];
      for await (const event of executor.executeTask(request, {})) {
        events.push(event);
      }

      const completedEvent = events.find((e) => e.type === "agent:completed");
      expect(completedEvent).toBeDefined();
      expect(completedEvent).toMatchObject({
        type: "agent:completed",
        output: mockResult.messages,
        sessionId: mockResult.sessionId,
      });
      // Duration should be calculated, not from mock result
      expect((completedEvent as any).duration).toBeGreaterThanOrEqual(0);
    });

    it("should yield agent:failed event on execution error", async () => {
      const request: AgentTaskRequest = {
        instruction: "Test instruction",
      };

      const testError = new Error("Execution failed");
      mockExecuteTask.mockRejectedValue(testError);

      const events: AgentExecutionEvent[] = [];
      for await (const event of executor.executeTask(request, {})) {
        events.push(event);
      }

      const failedEvent = events.find((e) => e.type === "agent:failed");
      expect(failedEvent).toBeDefined();
      expect(failedEvent).toMatchObject({
        type: "agent:failed",
        error: testError,
      });
    });

    it("should pass abort controller to Claude client", async () => {
      const request: AgentTaskRequest = {
        instruction: "Test instruction",
      };

      const abortController = new AbortController();

      mockExecuteTask.mockResolvedValue({
        success: true,
        messages: [],
        tracker: { getTodos: () => [] },
      });

      const events: AgentExecutionEvent[] = [];
      for await (const event of executor.executeTask(request, { abortController })) {
        events.push(event);
      }

      expect(mockExecuteTask).toHaveBeenCalled();
      const callArgs = mockExecuteTask.mock.calls[0];
      expect(callArgs[1]).toHaveProperty("abortController", abortController);
    });

    it("should handle progress events from Claude client", async () => {
      const request: AgentTaskRequest = {
        instruction: "Test instruction",
      };

      // Mock SDK execution that calls onProgress
      mockExecuteTask.mockImplementation(async (_prompt: string, options: any) => {
        // Simulate progress events
        if (options.onProgress) {
          await options.onProgress({ type: "log", message: "Starting..." });
          await options.onProgress({ type: "tool:start", tool: "Read", input: "file.txt" });
          await options.onProgress({ type: "tool:end", tool: "Read", success: true });
        }

        return {
          success: true,
          messages: [],
          tracker: { getTodos: () => [] },
        };
      });

      const events: AgentExecutionEvent[] = [];
      for await (const event of executor.executeTask(request, {})) {
        events.push(event);
      }

      // Should have: start, progress events, completed
      expect(events.length).toBeGreaterThan(2);
      expect(events.some((e) => e.type === "agent:progress")).toBe(true);
      expect(events.some((e) => e.type === "agent:tool:start")).toBe(true);
      expect(events.some((e) => e.type === "agent:tool:end")).toBe(true);
    });

    it("should pass working directory to Claude client", async () => {
      const request: AgentTaskRequest = {
        instruction: "Test instruction",
        context: {
          workingDirectory: "/test/path",
        },
      };

      mockExecuteTask.mockResolvedValue({
        success: true,
        messages: [],
        tracker: { getTodos: () => [] },
      });

      const events: AgentExecutionEvent[] = [];
      for await (const event of executor.executeTask(request, {})) {
        events.push(event);
      }

      expect(mockExecuteTask).toHaveBeenCalled();
      const callArgs = mockExecuteTask.mock.calls[0];
      expect(callArgs[1]).toHaveProperty("cwd", "/test/path");
    });

    it("should pass Claude-specific options to client", async () => {
      const request: AgentTaskRequest = {
        instruction: "Test instruction",
        options: {
          claude: {
            maxTurns: 10,
            permissionMode: "bypassPermissions",
            allowedTools: ["Read", "Write"],
            verbose: true,
          },
        },
      };

      mockExecuteTask.mockResolvedValue({
        success: true,
        messages: [],
        tracker: { getTodos: () => [] },
      });

      const events: AgentExecutionEvent[] = [];
      for await (const event of executor.executeTask(request, {})) {
        events.push(event);
      }

      expect(mockExecuteTask).toHaveBeenCalled();
      const callArgs = mockExecuteTask.mock.calls[0];
      const options = callArgs[1];
      expect(options).toMatchObject({
        maxTurns: 10,
        allowedTools: ["Read", "Write"],
        verbose: true,
      });
    });
  });

  describe("cancelTask", () => {
    it("should cancel running task by task ID", async () => {
      const taskId = "test-task-123";
      const request: AgentTaskRequest = {
        instruction: "Long running task",
      };

      // Mock execution that respects abort signal
      mockExecuteTask.mockImplementation((prompt: string, options: any) => {
        return new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            resolve({ success: true, messages: [], tracker: { getTodos: () => [] } });
          }, 1000);

          // Listen for abort signal
          if (options.abortController) {
            options.abortController.signal.addEventListener("abort", () => {
              clearTimeout(timeout);
              reject(new Error("Task cancelled"));
            });
          }
        });
      });

      // Start task execution
      const executionPromise = (async () => {
        const events: AgentExecutionEvent[] = [];
        try {
          for await (const event of executor.executeTask(request, { taskId })) {
            events.push(event);
          }
        } catch (error) {
          // Execution may throw on cancellation
        }
        return events;
      })();

      // Wait a bit, then cancel
      await new Promise((resolve) => setTimeout(resolve, 50));
      await executor.cancelTask(taskId);

      // Wait for execution to complete
      const events = await executionPromise;

      // Should have start event and failed event due to cancellation
      expect(events.length).toBeGreaterThan(0);
      expect(events[0].type).toBe("agent:start");
      const failedEvent = events.find((e) => e.type === "agent:failed");
      expect(failedEvent).toBeDefined();
    });

    it("should log warning if task not found for cancellation", async () => {
      const { logger } = await import("../../../src/utils/logger.js");

      await executor.cancelTask("non-existent-task");

      // BaseExecutorHelper logs with different format
      expect(logger.debug).toHaveBeenCalledWith(
        "Task not found for cancellation: non-existent-task",
        expect.objectContaining({ prefix: "task" }),
      );
    });
  });
});

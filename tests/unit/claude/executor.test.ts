import { describe, it, expect, beforeEach, vi } from "vitest";
import { TaskExecutorImpl } from "../../../src/claude/executor";
import { ClaudeCodeClient } from "../../../src/claude/claude-code-client";
import type { TaskRequest } from "../../../src/claude/types";

vi.mock("../../../src/claude/claude-code-client");
vi.mock("fs", () => ({
  existsSync: vi.fn(() => true),
}));

describe("TaskExecutor", () => {
  let executor: TaskExecutorImpl;
  let mockCodeClient: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockCodeClient = {
      executeTask: vi.fn(),
      formatMessagesAsString: vi.fn(),
    };

    vi.mocked(ClaudeCodeClient).mockImplementation(() => mockCodeClient);

    executor = new TaskExecutorImpl();
  });

  describe("execute", () => {
    it("should execute a simple task successfully with Claude Code", async () => {
      const task: TaskRequest = {
        instruction: "Calculate 2 + 2",
      };

      const mockMessages = [{ type: "assistant", content: "The answer is 4" }] as any;

      mockCodeClient.executeTask.mockImplementationOnce(async () => {
        // Simulate some async work
        await new Promise((resolve) => setTimeout(resolve, 10));
        return {
          messages: mockMessages,
          success: true,
        };
      });
      mockCodeClient.formatMessagesAsString.mockReturnValueOnce("The answer is 4");

      const result = await executor.execute(task);

      expect(result.success).toBe(true);
      expect(result.output).toBe("The answer is 4");
      expect(result.error).toBeUndefined();
      expect(result.logs).toContain("Task started: Calculate 2 + 2");
      expect(result.logs).toContain("Received 1 messages from Claude Code");
      expect(result.logs).toContain("Task completed successfully");
      expect(result.duration).toBeGreaterThan(0);
    });

    it("should pass context as cwd option for Claude Code SDK", async () => {
      const task: TaskRequest = {
        instruction: "Analyze this code",
        context: {
          workingDirectory: "/project",
          files: ["src/index.ts", "src/utils.ts"],
        },
      };

      mockCodeClient.executeTask.mockResolvedValueOnce({
        messages: [{ type: "assistant", content: "Analysis complete" }] as any,
        success: true,
      });
      mockCodeClient.formatMessagesAsString.mockReturnValueOnce("Analysis complete");

      await executor.execute(task);

      // When using Claude Code SDK, context is passed as cwd option, not in prompt
      expect(mockCodeClient.executeTask).toHaveBeenCalledWith(
        "Analyze this code", // Prompt should not include context
        expect.objectContaining({
          cwd: "/project",
        }),
      );
    });

    it("should handle execution errors", async () => {
      const task: TaskRequest = {
        instruction: "Do something",
      };

      const error = new Error("Claude API error");
      mockCodeClient.executeTask.mockResolvedValueOnce({
        messages: [],
        success: false,
        error,
      });

      const result = await executor.execute(task);

      expect(result.success).toBe(false);
      expect(result.output).toBeUndefined();
      expect(result.error).toBe(error);
      expect(result.logs).toContain("Task started: Do something");
      expect(result.logs).toContain("Task failed: Claude API error");
    });

    it("should respect timeout option", async () => {
      const task: TaskRequest = {
        instruction: "Long running task",
        options: {
          timeout: 100,
          async: false,
        },
      };

      // Simulate timeout by throwing AbortError
      mockCodeClient.executeTask.mockRejectedValueOnce(
        Object.assign(new Error("The operation was aborted"), { name: "AbortError" }),
      );

      const result = await executor.execute(task);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain("timed out");
    });

    it("should pass web search options to Claude Code client", async () => {
      const task: TaskRequest = {
        instruction: "Search for latest news",
        options: {
          sdk: {
            enableWebSearch: true,
            webSearchConfig: {
              maxResults: 5,
            },
          },
        },
      };

      mockCodeClient.executeTask.mockResolvedValueOnce({
        messages: [{ type: "assistant", content: "Search results..." }] as any,
        success: true,
      });
      mockCodeClient.formatMessagesAsString.mockReturnValueOnce("Search results...");

      await executor.execute(task);

      expect(mockCodeClient.executeTask).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          enableWebSearch: true,
          webSearchConfig: {
            maxResults: 5,
          },
        }),
      );
    });
  });

  describe("cancel", () => {
    it("should cancel a running task", async () => {
      // For now, this is a placeholder
      await expect(executor.cancel("task-123")).resolves.not.toThrow();
    });
  });
});

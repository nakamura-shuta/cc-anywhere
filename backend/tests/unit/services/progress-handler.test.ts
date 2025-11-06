import { describe, it, expect, beforeEach, vi } from "vitest";
import { ProgressHandler, type ProgressData } from "../../../src/services/progress-handler.js";
import { logger } from "../../../src/utils/logger.js";

// Mock dependencies
vi.mock("../../../src/utils/logger", () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
  },
}));

describe("ProgressHandler", () => {
  let handler: ProgressHandler;
  let mockBroadcaster: any;
  let mockRepository: any;
  let progressData: ProgressData;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock broadcaster
    mockBroadcaster = {
      task: vi.fn(),
      global: vi.fn(),
    };

    // Mock repository
    mockRepository = {
      updateProgressData: vi.fn().mockResolvedValue(undefined),
    };

    // Initialize progress data
    progressData = {
      currentTurn: 0,
      maxTurns: undefined,
      toolUsageCount: {},
      statistics: {
        totalToolCalls: 0,
        processedFiles: 0,
        createdFiles: 0,
        modifiedFiles: 0,
        totalExecutions: 0,
      },
      todos: [],
      toolExecutions: [],
      claudeResponses: [],
    };

    handler = new ProgressHandler("test-task-123", mockBroadcaster, mockRepository);
  });

  describe("handleProgress - log event", () => {
    it("should handle log progress event", async () => {
      const progress = {
        type: "log",
        message: "This is a log message",
      };

      const logMessage = await handler.handleProgress(progress, progressData);

      expect(logMessage).toBe("This is a log message");
      expect(mockBroadcaster.task).toHaveBeenCalledWith(
        "test-task-123",
        "task:log",
        expect.objectContaining({
          message: "This is a log message",
          timestamp: expect.any(Number),
        }),
      );
    });
  });

  describe("handleProgress - tool_usage event", () => {
    it("should handle tool_usage progress event", async () => {
      const progress = {
        type: "tool_usage",
        message: "Tool usage message",
      };

      const logMessage = await handler.handleProgress(progress, progressData);

      expect(logMessage).toBe("Tool usage message");
      expect(mockBroadcaster.task).toHaveBeenCalledWith(
        "test-task-123",
        "task:tool_usage",
        expect.objectContaining({
          message: "Tool usage message",
          timestamp: expect.any(Number),
        }),
      );
    });
  });

  describe("handleProgress - progress event", () => {
    it("should handle general progress event", async () => {
      const progress = {
        type: "progress",
        message: "Progress message",
      };

      const logMessage = await handler.handleProgress(progress, progressData);

      expect(logMessage).toBe("Progress message");
      expect(mockBroadcaster.task).toHaveBeenCalledWith(
        "test-task-123",
        "task:progress",
        expect.objectContaining({
          message: "Progress message",
          timestamp: expect.any(Number),
        }),
      );
    });
  });

  describe("handleProgress - summary event", () => {
    it("should handle summary progress event", async () => {
      const progress = {
        type: "summary",
        message: "Summary message",
      };

      const logMessage = await handler.handleProgress(progress, progressData);

      expect(logMessage).toBe("Summary message");
      expect(mockBroadcaster.task).toHaveBeenCalledWith(
        "test-task-123",
        "task:summary",
        expect.objectContaining({
          message: "Summary message",
          timestamp: expect.any(Number),
        }),
      );
    });
  });

  describe("handleProgress - todo_update event", () => {
    it("should handle todo update with todos data", async () => {
      const progress = {
        type: "todo_update",
        message: "TODO updated",
        data: {
          todos: [
            { content: "Task 1", status: "completed" },
            { content: "Task 2", status: "in_progress" },
            { content: "Task 3", status: "pending" },
          ],
        },
      };

      const logMessage = await handler.handleProgress(progress, progressData);

      expect(logMessage).toContain("📝 TODO更新");
      expect(logMessage).toContain("✅ Task 1");
      expect(logMessage).toContain("⏳ Task 2");
      expect(logMessage).toContain("⏳ Task 3");
      expect(progressData.todos).toHaveLength(3);
      expect(mockRepository.updateProgressData).toHaveBeenCalledWith("test-task-123", progressData);
      expect(mockBroadcaster.task).toHaveBeenCalledWith(
        "test-task-123",
        "task:todo_update",
        expect.objectContaining({
          todos: progress.data.todos,
          timestamp: expect.any(Number),
        }),
      );
    });

    it("should handle todo update with empty todos", async () => {
      const progress = {
        type: "todo_update",
        message: "TODO updated",
        data: {
          todos: [],
        },
      };

      const logMessage = await handler.handleProgress(progress, progressData);

      expect(logMessage).toContain("📝 TODO更新");
      expect(progressData.todos).toHaveLength(0);
    });

    it("should handle database error gracefully", async () => {
      mockRepository.updateProgressData.mockRejectedValueOnce(new Error("DB error"));

      const progress = {
        type: "todo_update",
        message: "TODO updated",
        data: {
          todos: [{ content: "Task 1", status: "completed" }],
        },
      };

      const logMessage = await handler.handleProgress(progress, progressData);

      expect(logMessage).toContain("📝 TODO更新");
      // Should not throw error
      expect(mockRepository.updateProgressData).toHaveBeenCalled();
    });
  });

  describe("handleProgress - tool:start event", () => {
    it("should handle tool start event", async () => {
      const progress = {
        type: "tool:start",
        message: "Tool started",
        data: {
          tool: "Read",
          toolId: "read-123",
          input: { file: "test.txt" },
          formattedInput: "Reading test.txt",
        },
      };

      const logMessage = await handler.handleProgress(progress, progressData);

      expect(logMessage).toContain("Read");
      expect(logMessage).toContain("Reading test.txt");
      expect(progressData.toolUsageCount["Read"]).toBe(1);
      expect(progressData.toolExecutions).toHaveLength(1);
      expect(progressData.toolExecutions[0]).toMatchObject({
        type: "start",
        tool: "Read",
        args: progress.data.input,
      });
      expect(mockRepository.updateProgressData).toHaveBeenCalled();
      expect(mockBroadcaster.task).toHaveBeenCalledWith(
        "test-task-123",
        "task:tool:start",
        expect.objectContaining({
          tool: "Read",
          toolId: "read-123",
          input: progress.data.input,
          formattedInput: "Reading test.txt",
        }),
      );
    });

    it("should increment tool usage count for repeated tools", async () => {
      const progress1 = {
        type: "tool:start",
        message: "Tool started",
        data: { tool: "Read", input: {} },
      };

      const progress2 = {
        type: "tool:start",
        message: "Tool started",
        data: { tool: "Read", input: {} },
      };

      await handler.handleProgress(progress1, progressData);
      await handler.handleProgress(progress2, progressData);

      expect(progressData.toolUsageCount["Read"]).toBe(2);
      expect(progressData.toolExecutions).toHaveLength(2);
    });
  });

  describe("handleProgress - tool:end event", () => {
    it("should handle successful tool end event", async () => {
      const progress = {
        type: "tool:end",
        message: "Tool ended",
        data: {
          tool: "Read",
          toolId: "read-123",
          output: "File content",
          duration: 1500,
          error: null,
        },
      };

      const logMessage = await handler.handleProgress(progress, progressData);

      expect(logMessage).toContain("✅ 成功");
      expect(logMessage).toContain("Read");
      expect(progressData.toolExecutions).toHaveLength(1);
      expect(progressData.toolExecutions[0]).toMatchObject({
        type: "end",
        tool: "Read",
        duration: 1500,
        success: true,
        result: "File content",
      });
      expect(mockRepository.updateProgressData).toHaveBeenCalled();
    });

    it("should handle failed tool end event", async () => {
      const progress = {
        type: "tool:end",
        message: "Tool ended",
        data: {
          tool: "Write",
          toolId: "write-123",
          output: null,
          duration: 500,
          error: new Error("Write failed"),
        },
      };

      const logMessage = await handler.handleProgress(progress, progressData);

      expect(logMessage).toContain("❌ エラー");
      expect(logMessage).toContain("Write");
      expect(progressData.toolExecutions).toHaveLength(1);
      expect(progressData.toolExecutions[0]).toMatchObject({
        type: "end",
        tool: "Write",
        duration: 500,
        success: false,
      });
    });
  });

  describe("handleProgress - claude:response event", () => {
    it("should handle claude response event with turn number", async () => {
      const progress = {
        type: "claude:response",
        message: "This is Claude's response",
        data: {
          text: "This is Claude's response",
          turnNumber: 5,
        },
      };

      const logMessage = await handler.handleProgress(progress, progressData);

      expect(logMessage).toContain("(Turn 5)");
      expect(logMessage).toContain("This is Claude's response");
      expect(progressData.claudeResponses).toHaveLength(1);
      expect(progressData.claudeResponses[0]).toMatchObject({
        turnNumber: 5,
        text: "This is Claude's response",
      });
      expect(mockRepository.updateProgressData).toHaveBeenCalled();
      expect(mockBroadcaster.task).toHaveBeenCalledWith(
        "test-task-123",
        "task:claude_response",
        expect.objectContaining({
          text: "This is Claude's response",
          turnNumber: 5,
        }),
      );
    });

    it("should handle claude response without turn number", async () => {
      const progress = {
        type: "claude:response",
        message: "Response without turn",
        data: {
          text: "Response without turn",
        },
      };

      const logMessage = await handler.handleProgress(progress, progressData);

      expect(logMessage).not.toContain("(Turn");
      expect(logMessage).toContain("Response without turn");
      expect(progressData.claudeResponses).toHaveLength(1);
    });

    it("should truncate long responses in log message", async () => {
      const longText = "a".repeat(200);
      const progress = {
        type: "claude:response",
        message: longText,
        data: {
          text: longText,
          turnNumber: 1,
        },
      };

      const logMessage = await handler.handleProgress(progress, progressData);

      expect(logMessage).toContain("...");
      expect(logMessage.length).toBeLessThan(longText.length + 100);
      // Full text should be stored in progressData
      expect(progressData.claudeResponses[0].text).toBe(longText);
    });
  });

  describe("handleProgress - statistics event", () => {
    it("should handle statistics event with all fields", async () => {
      const progress = {
        type: "statistics",
        message: "Statistics",
        data: {
          totalTurns: 10,
          totalToolCalls: 25,
          toolStats: { Read: 10, Write: 5, Edit: 10 },
          elapsedTime: 30000,
          tokenUsage: {
            input: 1000,
            output: 500,
            cached: 200,
          },
        },
      };

      const logMessage = await handler.handleProgress(progress, progressData);

      expect(logMessage).toContain("📊 統計情報");
      expect(logMessage).toContain("総ターン数: 10");
      expect(logMessage).toContain("総ツール呼び出し: 25");
      expect(logMessage).toContain("1000 input + 500 output");
      expect(progressData.statistics).toMatchObject({
        totalTurns: 10,
        totalToolCalls: 25,
        toolStats: { Read: 10, Write: 5, Edit: 10 },
        elapsedTime: 30000,
        tokenUsage: {
          input: 1000,
          output: 500,
          cached: 200,
        },
      });
      expect(mockRepository.updateProgressData).toHaveBeenCalled();
    });

    it("should handle statistics event with partial fields", async () => {
      const progress = {
        type: "statistics",
        message: "Statistics",
        data: {
          totalTurns: 5,
        },
      };

      const logMessage = await handler.handleProgress(progress, progressData);

      expect(logMessage).toContain("📊 統計情報");
      expect(logMessage).toContain("総ターン数: 5");
      expect(progressData.statistics.totalTurns).toBe(5);
    });
  });

  describe("handleProgress - unknown event", () => {
    it("should handle unknown event type gracefully", async () => {
      const progress = {
        type: "unknown_event_type",
        message: "Unknown event",
      };

      const logMessage = await handler.handleProgress(progress, progressData);

      expect(logMessage).toBe("Unknown event");
      expect(logger.debug).toHaveBeenCalledWith(
        "Unknown progress event type",
        expect.objectContaining({
          type: "unknown_event_type",
          taskId: "test-task-123",
        }),
      );
      expect(mockBroadcaster.task).toHaveBeenCalledWith(
        "test-task-123",
        "task:progress",
        expect.objectContaining({
          message: "Unknown event",
        }),
      );
    });

    it("should handle unknown event with empty message", async () => {
      const progress = {
        type: "custom_event",
        message: "",
      };

      const logMessage = await handler.handleProgress(progress, progressData);

      expect(logMessage).toBe("");
    });
  });

  describe("broadcaster and repository optionality", () => {
    it("should work without broadcaster", async () => {
      const handlerNoBroadcaster = new ProgressHandler("test-task", undefined, mockRepository);
      const progress = {
        type: "log",
        message: "Test message",
      };

      const logMessage = await handlerNoBroadcaster.handleProgress(progress, progressData);

      expect(logMessage).toBe("Test message");
      // Should not throw error
    });

    it("should work without repository", async () => {
      const handlerNoRepository = new ProgressHandler("test-task", mockBroadcaster, undefined);
      const progress = {
        type: "todo_update",
        message: "TODO updated",
        data: {
          todos: [{ content: "Task 1", status: "completed" }],
        },
      };

      const logMessage = await handlerNoRepository.handleProgress(progress, progressData);

      expect(logMessage).toContain("📝 TODO更新");
      expect(progressData.todos).toHaveLength(1);
      // Should not throw error
    });

    it("should work without both broadcaster and repository", async () => {
      const handlerMinimal = new ProgressHandler("test-task", undefined, undefined);
      const progress = {
        type: "progress",
        message: "Minimal progress",
      };

      const logMessage = await handlerMinimal.handleProgress(progress, progressData);

      expect(logMessage).toBe("Minimal progress");
      // Should not throw error
    });
  });
});

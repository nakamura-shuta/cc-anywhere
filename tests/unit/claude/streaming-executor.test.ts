import { describe, it, expect, beforeEach, vi } from "vitest";
import { StreamingClaudeExecutor } from "../../../src/claude/streaming-executor";
import { ClaudeCodeClient } from "../../../src/claude/claude-code-client";
import { StreamingTaskExecutor } from "../../../src/services/streaming-task-executor";
import type { TaskRequest } from "../../../src/claude/types";

vi.mock("../../../src/claude/claude-code-client");
vi.mock("../../../src/services/streaming-task-executor");

describe("StreamingClaudeExecutor", () => {
  let executor: StreamingClaudeExecutor;
  let mockClaudeClient: ClaudeCodeClient;
  let mockStreamingExecutor: StreamingTaskExecutor;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClaudeClient = new ClaudeCodeClient();
    executor = new StreamingClaudeExecutor(mockClaudeClient);
  });

  describe("executeWithStreaming", () => {
    const mockTask: TaskRequest = {
      instruction: "Test task",
      context: {
        workingDirectory: "/test/dir",
      },
      options: {
        sdk: {
          maxTurns: 5,
        },
      },
    };

    it("should create streaming executor with correct parameters", async () => {
      const taskId = "task-123";
      const sessionId = "session-456";

      const mockGenerator = async function* () {
        yield { type: "user", message: { role: "user", content: "test" } };
      };

      vi.mocked(StreamingTaskExecutor).mockImplementation(() => {
        mockStreamingExecutor = {
          setInitialPrompt: vi.fn(),
          generateUserMessages: vi.fn().mockReturnValue(mockGenerator()),
          getMessageCount: vi.fn().mockReturnValue(1),
          isCompleted: vi.fn().mockReturnValue(true),
          markCompleted: vi.fn(),
          addUserInstruction: vi.fn(),
          setAbortController: vi.fn(),
        } as any;
        return mockStreamingExecutor;
      });

      vi.mocked(mockClaudeClient.executeTask).mockResolvedValue({
        messages: [],
        success: true,
      });

      await executor.executeWithStreaming(mockTask, taskId, sessionId);

      expect(StreamingTaskExecutor).toHaveBeenCalledWith(taskId, sessionId);
      expect(mockStreamingExecutor.setInitialPrompt).toHaveBeenCalledWith(mockTask.instruction);
    });

    it("should use streaming input with claude client", async () => {
      const mockGenerator = async function* () {
        yield { type: "user", message: { role: "user", content: "test" } };
      };

      vi.mocked(StreamingTaskExecutor).mockImplementation(
        () =>
          ({
            setInitialPrompt: vi.fn(),
            generateUserMessages: vi.fn().mockReturnValue(mockGenerator()),
            getMessageCount: vi.fn().mockReturnValue(1),
            isCompleted: vi.fn().mockReturnValue(true),
            markCompleted: vi.fn(),
            setAbortController: vi.fn(),
          }) as any,
      );

      vi.mocked(mockClaudeClient.executeTask).mockResolvedValue({
        messages: [],
        success: true,
      });

      await executor.executeWithStreaming(mockTask, "task-123", "session-123");

      expect(mockClaudeClient.executeTask).toHaveBeenCalledWith(
        expect.any(Object), // AsyncIterable
        expect.objectContaining({
          maxTurns: 5,
        }),
      );
    });

    it("should handle abort controller", async () => {
      const abortController = new AbortController();
      const taskWithAbort = {
        ...mockTask,
        options: {
          ...mockTask.options,
          abortController,
        },
      };

      const mockSetAbortController = vi.fn();
      vi.mocked(StreamingTaskExecutor).mockImplementation(
        () =>
          ({
            setInitialPrompt: vi.fn(),
            generateUserMessages: vi.fn().mockReturnValue((async function* () {})()),
            getMessageCount: vi.fn().mockReturnValue(0),
            isCompleted: vi.fn().mockReturnValue(true),
            markCompleted: vi.fn(),
            setAbortController: mockSetAbortController,
          }) as any,
      );

      vi.mocked(mockClaudeClient.executeTask).mockResolvedValue({
        messages: [],
        success: true,
      });

      await executor.executeWithStreaming(taskWithAbort, "task-123", "session-123");

      expect(mockSetAbortController).toHaveBeenCalledWith(abortController);
    });

    it("should return streaming executor in result", async () => {
      const mockStreamingExecutorInstance = {
        setInitialPrompt: vi.fn(),
        generateUserMessages: vi.fn().mockReturnValue((async function* () {})()),
        getMessageCount: vi.fn().mockReturnValue(0),
        isCompleted: vi.fn().mockReturnValue(true),
        markCompleted: vi.fn(),
      };

      vi.mocked(StreamingTaskExecutor).mockImplementation(
        () => mockStreamingExecutorInstance as any,
      );

      vi.mocked(mockClaudeClient.executeTask).mockResolvedValue({
        messages: [],
        success: true,
      });

      const result = await executor.executeWithStreaming(mockTask, "task-123", "session-123");

      expect(result.streamingExecutor).toBe(mockStreamingExecutorInstance);
    });

    it("should handle errors", async () => {
      const error = new Error("Test error");

      vi.mocked(StreamingTaskExecutor).mockImplementation(
        () =>
          ({
            setInitialPrompt: vi.fn(),
            generateUserMessages: vi.fn().mockImplementation(async function* () {
              throw error;
            }),
            getMessageCount: vi.fn().mockReturnValue(0),
            isCompleted: vi.fn().mockReturnValue(false),
            markCompleted: vi.fn(),
            setAbortController: vi.fn(),
          }) as any,
      );

      vi.mocked(mockClaudeClient.executeTask).mockRejectedValue(error);

      const result = await executor.executeWithStreaming(mockTask, "task-123", "session-123");

      expect(result.success).toBe(false);
      expect(result.error).toBe(error);
    });
  });
});

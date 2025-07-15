import { describe, it, expect, beforeEach, vi } from "vitest";
import { StreamingTaskExecutor } from "../../../src/services/streaming-task-executor";

describe("StreamingTaskExecutor", () => {
  let executor: StreamingTaskExecutor;
  const mockSessionId = "test-session-123";
  const mockTaskId = "task-123";

  beforeEach(() => {
    vi.clearAllMocks();
    executor = new StreamingTaskExecutor(mockTaskId, mockSessionId);
  });

  describe("initialization", () => {
    it("should initialize with correct taskId and sessionId", () => {
      expect(executor.getTaskId()).toBe(mockTaskId);
      expect(executor.getSessionId()).toBe(mockSessionId);
    });

    it("should start with empty message queue", () => {
      expect(executor.getQueueSize()).toBe(0);
    });

    it("should not be completed initially", () => {
      expect(executor.isCompleted()).toBe(false);
    });
  });

  describe("message queue management", () => {
    it("should add messages to queue", () => {
      executor.addUserInstruction("First instruction");
      executor.addUserInstruction("Second instruction");

      expect(executor.getQueueSize()).toBe(2);
    });

    it("should limit queue size", () => {
      // デフォルトの最大キューサイズは10
      for (let i = 0; i < 15; i++) {
        executor.addUserInstruction(`Instruction ${i}`);
      }

      expect(executor.getQueueSize()).toBe(10);
    });

    it("should clear queue", () => {
      executor.addUserInstruction("Test instruction");
      executor.clearQueue();

      expect(executor.getQueueSize()).toBe(0);
    });
  });

  describe("generateUserMessages", () => {
    it("should yield initial prompt first", async () => {
      const initialPrompt = "Initial task instruction";
      executor.setInitialPrompt(initialPrompt);

      const generator = executor.generateUserMessages();
      const firstMessage = await generator.next();

      expect(firstMessage.done).toBe(false);
      expect(firstMessage.value).toMatchObject({
        type: "user",
        message: {
          role: "user",
          content: initialPrompt,
        },
        session_id: mockSessionId,
      });
    });

    it("should yield queued messages", async () => {
      executor.setInitialPrompt("Start");
      executor.addUserInstruction("Additional instruction");

      const generator = executor.generateUserMessages();

      // Skip initial prompt
      await generator.next();

      // Get queued message
      const secondMessage = await generator.next();

      expect(secondMessage.done).toBe(false);
      expect(secondMessage.value?.message.content).toBe("Additional instruction");
    });

    it("should complete when marked as completed", async () => {
      executor.setInitialPrompt("Start");
      executor.markCompleted();

      const generator = executor.generateUserMessages();

      // Get initial prompt
      await generator.next();

      // Should complete after initial prompt
      const result = await generator.next();
      expect(result.done).toBe(true);
    });

    it("should handle timeout", async () => {
      executor.setInitialPrompt("Start");
      executor.setMaxWaitTime(100); // 100ms timeout

      const generator = executor.generateUserMessages();
      await generator.next(); // Initial prompt

      const startTime = Date.now();
      const result = await generator.next();
      const elapsed = Date.now() - startTime;

      expect(result.done).toBe(true);
      expect(elapsed).toBeGreaterThanOrEqual(90); // Allow some margin
      expect(elapsed).toBeLessThan(200);
    });
  });

  describe("createUserMessage", () => {
    it("should create properly formatted SDKUserMessage", () => {
      const content = "Test message";
      const message = executor.createUserMessage(content);

      expect(message).toMatchObject({
        type: "user",
        message: {
          role: "user",
          content: content,
        },
        parent_tool_use_id: null,
        session_id: mockSessionId,
      });
    });
  });

  describe("abort handling", () => {
    it("should support abort controller", () => {
      const abortController = new AbortController();
      executor.setAbortController(abortController);

      expect(executor.getAbortController()).toBe(abortController);
    });

    it("should stop generating messages when aborted", async () => {
      const abortController = new AbortController();
      executor.setAbortController(abortController);
      executor.setInitialPrompt("Start");

      const generator = executor.generateUserMessages();
      await generator.next(); // Initial prompt

      // Abort
      abortController.abort();

      const result = await generator.next();
      expect(result.done).toBe(true);
    });
  });

  describe("statistics", () => {
    it("should track message count", async () => {
      executor.setInitialPrompt("Start");
      executor.addUserInstruction("Instruction 1");
      executor.addUserInstruction("Instruction 2");

      const generator = executor.generateUserMessages();
      await generator.next(); // Initial
      await generator.next(); // Instruction 1

      // Mark completed to stop generation
      executor.markCompleted();
      await generator.next(); // This should complete the generator

      expect(executor.getMessageCount()).toBe(2); // Initial + Instruction 1
    });

    it("should track execution time", async () => {
      executor.setInitialPrompt("Start");
      const startTime = executor.getStartTime();

      expect(startTime).toBeInstanceOf(Date);
      expect(startTime.getTime()).toBeLessThanOrEqual(Date.now());
    });
  });
});

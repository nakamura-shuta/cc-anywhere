/**
 * GeminiAgentExecutor unit tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type {
  AgentTaskRequest,
  AgentExecutionOptions,
  AgentExecutionEvent,
} from "../../../src/agents/types.js";

// Mock config
const mockConfig = {
  gemini: {
    apiKey: "test-gemini-key",
  },
  logging: {
    level: "debug",
  },
};

vi.mock("../../../src/config/index.js", () => ({
  config: mockConfig,
}));

// Mock logger
vi.mock("../../../src/utils/logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock Gemini SDK
const mockGenerateContent = vi.fn();
const mockGenerateContentStream = vi.fn();

const mockGoogleGenAI = vi.fn(() => ({
  models: {
    generateContent: mockGenerateContent,
    generateContentStream: mockGenerateContentStream,
  },
}));

vi.mock("@google/genai", () => ({
  GoogleGenAI: mockGoogleGenAI,
}));

// Import after mocking
const { GeminiAgentExecutor } = await import("../../../src/agents/gemini-agent-executor.js");
const { EXECUTOR_TYPES } = await import("../../../src/agents/types.js");

describe("GeminiAgentExecutor", () => {
  let executor: InstanceType<typeof GeminiAgentExecutor>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockConfig.gemini.apiKey = "test-gemini-key";
    executor = new GeminiAgentExecutor();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("getExecutorType", () => {
    it("should return 'gemini'", () => {
      expect(executor.getExecutorType()).toBe(EXECUTOR_TYPES.GEMINI);
      expect(executor.getExecutorType()).toBe("gemini");
    });
  });

  describe("isAvailable", () => {
    it("should return true when API key is configured", () => {
      expect(executor.isAvailable()).toBe(true);
    });

    it("should return false when API key is not configured", () => {
      mockConfig.gemini.apiKey = "";
      const executorWithoutKey = new GeminiAgentExecutor();
      expect(executorWithoutKey.isAvailable()).toBe(false);
    });

    it("should return false when gemini config is undefined", () => {
      (mockConfig as any).gemini = undefined;
      const executorWithoutConfig = new GeminiAgentExecutor();
      expect(executorWithoutConfig.isAvailable()).toBe(false);
      // Restore
      mockConfig.gemini = { apiKey: "test-gemini-key" };
    });
  });

  describe("executeTask", () => {
    it("should emit start event at the beginning", async () => {
      mockGenerateContent.mockResolvedValue({
        text: "Test response",
        usageMetadata: {
          promptTokenCount: 10,
          candidatesTokenCount: 20,
        },
      });

      const request: AgentTaskRequest = {
        instruction: "Test instruction",
        options: {
          gemini: {
            streaming: false,
          },
        },
      };

      const options: AgentExecutionOptions = {
        taskId: "test-task-1",
      };

      const events: AgentExecutionEvent[] = [];
      const iterator = executor.executeTask(request, options);

      for await (const event of { [Symbol.asyncIterator]: () => iterator }) {
        events.push(event);
      }

      expect(events[0]).toEqual({
        type: "agent:start",
        executor: "gemini",
        timestamp: expect.any(Date),
      });
    });

    it("should emit completed event with output on success", async () => {
      mockGenerateContent.mockResolvedValue({
        text: "Test response",
        usageMetadata: {
          promptTokenCount: 10,
          candidatesTokenCount: 20,
        },
      });

      const request: AgentTaskRequest = {
        instruction: "Test instruction",
        options: {
          gemini: {
            streaming: false,
          },
        },
      };

      const options: AgentExecutionOptions = {
        taskId: "test-task-2",
      };

      const events: AgentExecutionEvent[] = [];
      const iterator = executor.executeTask(request, options);

      for await (const event of { [Symbol.asyncIterator]: () => iterator }) {
        events.push(event);
      }

      const completedEvent = events.find((e) => e.type === "agent:completed");
      expect(completedEvent).toBeDefined();
      expect(completedEvent).toMatchObject({
        type: "agent:completed",
        output: "Test response",
        duration: expect.any(Number),
        timestamp: expect.any(Date),
      });
    });

    it("should emit failed event on error", async () => {
      const testError = new Error("Test error");
      mockGenerateContent.mockRejectedValue(testError);

      const request: AgentTaskRequest = {
        instruction: "Test instruction",
        options: {
          gemini: {
            streaming: false,
          },
        },
      };

      const options: AgentExecutionOptions = {
        taskId: "test-task-3",
      };

      const events: AgentExecutionEvent[] = [];
      const iterator = executor.executeTask(request, options);

      for await (const event of { [Symbol.asyncIterator]: () => iterator }) {
        events.push(event);
      }

      const failedEvent = events.find((e) => e.type === "agent:failed");
      expect(failedEvent).toBeDefined();
      expect(failedEvent).toMatchObject({
        type: "agent:failed",
        error: expect.any(Error),
        timestamp: expect.any(Date),
      });
    });

    it("should use default model when not specified", async () => {
      mockGenerateContent.mockResolvedValue({
        text: "Test response",
      });

      const request: AgentTaskRequest = {
        instruction: "Test instruction",
        options: {
          gemini: {
            streaming: false,
          },
        },
      };

      const options: AgentExecutionOptions = {
        taskId: "test-task-4",
      };

      const iterator = executor.executeTask(request, options);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _ of { [Symbol.asyncIterator]: () => iterator }) {
        // Consume all events
      }

      expect(mockGenerateContent).toHaveBeenCalledWith({
        model: "gemini-3-pro-preview",
        contents: [{ role: "user", parts: [{ text: "Test instruction" }] }],
      });
    });

    it("should use custom model when specified", async () => {
      mockGenerateContent.mockResolvedValue({
        text: "Test response",
      });

      const request: AgentTaskRequest = {
        instruction: "Test instruction",
        options: {
          gemini: {
            model: "gemini-2.5-pro",
            streaming: false,
          },
        },
      };

      const options: AgentExecutionOptions = {
        taskId: "test-task-5",
      };

      const iterator = executor.executeTask(request, options);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _ of { [Symbol.asyncIterator]: () => iterator }) {
        // Consume all events
      }

      expect(mockGenerateContent).toHaveBeenCalledWith({
        model: "gemini-2.5-pro",
        contents: [{ role: "user", parts: [{ text: "Test instruction" }] }],
      });
    });

    it("should enable Google Search tool when requested", async () => {
      mockGenerateContent.mockResolvedValue({
        text: "Test response with search",
      });

      const request: AgentTaskRequest = {
        instruction: "Search for something",
        options: {
          gemini: {
            enableGoogleSearch: true,
            streaming: false,
          },
        },
      };

      const options: AgentExecutionOptions = {
        taskId: "test-task-6",
      };

      const iterator = executor.executeTask(request, options);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _ of { [Symbol.asyncIterator]: () => iterator }) {
        // Consume all events
      }

      expect(mockGenerateContent).toHaveBeenCalledWith({
        model: "gemini-3-pro-preview",
        contents: [{ role: "user", parts: [{ text: "Search for something" }] }],
        config: {
          tools: [{ googleSearch: {} }],
        },
      });
    });

    it("should enable Code Execution tool when requested", async () => {
      mockGenerateContent.mockResolvedValue({
        text: "Test response with code",
      });

      const request: AgentTaskRequest = {
        instruction: "Execute some code",
        options: {
          gemini: {
            enableCodeExecution: true,
            streaming: false,
          },
        },
      };

      const options: AgentExecutionOptions = {
        taskId: "test-task-7",
      };

      const iterator = executor.executeTask(request, options);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _ of { [Symbol.asyncIterator]: () => iterator }) {
        // Consume all events
      }

      expect(mockGenerateContent).toHaveBeenCalledWith({
        model: "gemini-3-pro-preview",
        contents: [{ role: "user", parts: [{ text: "Execute some code" }] }],
        config: {
          tools: [{ codeExecution: {} }],
        },
      });
    });

    it("should enable both tools when requested", async () => {
      mockGenerateContent.mockResolvedValue({
        text: "Test response",
      });

      const request: AgentTaskRequest = {
        instruction: "Test both tools",
        options: {
          gemini: {
            enableCodeExecution: true,
            enableGoogleSearch: true,
            streaming: false,
          },
        },
      };

      const options: AgentExecutionOptions = {
        taskId: "test-task-8",
      };

      const iterator = executor.executeTask(request, options);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _ of { [Symbol.asyncIterator]: () => iterator }) {
        // Consume all events
      }

      expect(mockGenerateContent).toHaveBeenCalledWith({
        model: "gemini-3-pro-preview",
        contents: [{ role: "user", parts: [{ text: "Test both tools" }] }],
        config: {
          tools: [{ codeExecution: {} }, { googleSearch: {} }],
        },
      });
    });

    it("should set thinking budget when specified", async () => {
      mockGenerateContent.mockResolvedValue({
        text: "Test response with thinking",
      });

      const request: AgentTaskRequest = {
        instruction: "Think about this",
        options: {
          gemini: {
            thinkingBudget: 1024,
            streaming: false,
          },
        },
      };

      const options: AgentExecutionOptions = {
        taskId: "test-task-9",
      };

      const iterator = executor.executeTask(request, options);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _ of { [Symbol.asyncIterator]: () => iterator }) {
        // Consume all events
      }

      expect(mockGenerateContent).toHaveBeenCalledWith({
        model: "gemini-3-pro-preview",
        contents: [{ role: "user", parts: [{ text: "Think about this" }] }],
        config: {
          generationConfig: {
            thinkingConfig: {
              thinkingBudget: 1024,
            },
          },
        },
      });
    });

    it("should set system prompt when specified", async () => {
      mockGenerateContent.mockResolvedValue({
        text: "Test response",
      });

      const request: AgentTaskRequest = {
        instruction: "Test instruction",
        options: {
          gemini: {
            systemPrompt: "You are a helpful assistant.",
            streaming: false,
          },
        },
      };

      const options: AgentExecutionOptions = {
        taskId: "test-task-10",
      };

      const iterator = executor.executeTask(request, options);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _ of { [Symbol.asyncIterator]: () => iterator }) {
        // Consume all events
      }

      expect(mockGenerateContent).toHaveBeenCalledWith({
        model: "gemini-3-pro-preview",
        contents: [{ role: "user", parts: [{ text: "Test instruction" }] }],
        config: {
          systemInstruction: "You are a helpful assistant.",
        },
      });
    });

    it("should emit statistics event with token usage", async () => {
      mockGenerateContent.mockResolvedValue({
        text: "Test response",
        usageMetadata: {
          promptTokenCount: 10,
          candidatesTokenCount: 20,
          thoughtsTokenCount: 100,
        },
      });

      const request: AgentTaskRequest = {
        instruction: "Test instruction",
        options: {
          gemini: {
            streaming: false,
          },
        },
      };

      const options: AgentExecutionOptions = {
        taskId: "test-task-11",
      };

      const events: AgentExecutionEvent[] = [];
      const iterator = executor.executeTask(request, options);

      for await (const event of { [Symbol.asyncIterator]: () => iterator }) {
        events.push(event);
      }

      const statsEvent = events.find((e) => e.type === "agent:statistics");
      expect(statsEvent).toBeDefined();
      expect(statsEvent).toMatchObject({
        type: "agent:statistics",
        totalTurns: 1,
        totalToolCalls: 0,
        tokenUsage: {
          input: 10,
          output: 20,
        },
        timestamp: expect.any(Date),
      });
    });

    it("should use streaming mode by default", async () => {
      // Mock async iterator for streaming
      const mockAsyncIterator = {
        async *[Symbol.asyncIterator]() {
          yield { text: "chunk1" };
          yield { text: "chunk2" };
        },
      };

      mockGenerateContentStream.mockResolvedValue(mockAsyncIterator);

      const request: AgentTaskRequest = {
        instruction: "Test streaming",
        // No streaming option specified - should default to true
      };

      const options: AgentExecutionOptions = {
        taskId: "test-task-12",
      };

      const events: AgentExecutionEvent[] = [];
      const iterator = executor.executeTask(request, options);

      for await (const event of { [Symbol.asyncIterator]: () => iterator }) {
        events.push(event);
      }

      expect(mockGenerateContentStream).toHaveBeenCalled();
      expect(mockGenerateContent).not.toHaveBeenCalled();
    });
  });

  describe("cancelTask", () => {
    it("should cancel a running task", async () => {
      // Create a long-running task by using a delayed stream
      const mockAsyncIterator = {
        async *[Symbol.asyncIterator]() {
          yield { text: "chunk1" };
          // This would normally continue
          await new Promise((resolve) => setTimeout(resolve, 1000));
          yield { text: "chunk2" };
        },
      };

      mockGenerateContentStream.mockResolvedValue(mockAsyncIterator);

      const request: AgentTaskRequest = {
        instruction: "Long running task",
      };

      const options: AgentExecutionOptions = {
        taskId: "test-cancel-task",
      };

      // Start the task
      const iterator = executor.executeTask(request, options);

      // Get first event (start event)
      await iterator.next();

      // Cancel the task
      await executor.cancelTask("test-cancel-task");

      // The task should be cancelled
      // Note: In real implementation, this would cause the task to emit a failed event
    });

    it("should handle cancellation of non-existent task gracefully", async () => {
      // Should not throw
      await expect(executor.cancelTask("non-existent-task")).resolves.not.toThrow();
    });
  });
});

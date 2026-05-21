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
const mockInteractionsCreate = vi.fn();

const mockGoogleGenAI = vi.fn(() => ({
  models: {
    generateContent: mockGenerateContent,
    generateContentStream: mockGenerateContentStream,
  },
  interactions: {
    create: mockInteractionsCreate,
  },
}));

vi.mock("@google/genai", () => ({
  GoogleGenAI: mockGoogleGenAI,
}));

// Import after mocking
const { GeminiAgentExecutor, __test_toInteractionsJsonSchema } =
  await import("../../../src/agents/gemini-agent-executor.js");
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
      // New API structure with candidates and parts
      mockGenerateContent.mockResolvedValue({
        candidates: [
          {
            content: {
              parts: [{ text: "Test response" }],
            },
          },
        ],
        usageMetadata: {
          promptTokenCount: 10,
          candidatesTokenCount: 20,
        },
      });

      const request: AgentTaskRequest = {
        instruction: "Test instruction",
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

    it("should always use generateContent (not streaming)", async () => {
      // New implementation always uses non-streaming generateContent
      mockGenerateContent.mockResolvedValue({
        candidates: [
          {
            content: {
              parts: [{ text: "Response text" }],
            },
          },
        ],
        usageMetadata: {
          promptTokenCount: 10,
          candidatesTokenCount: 20,
        },
      });

      const request: AgentTaskRequest = {
        instruction: "Test non-streaming",
      };

      const options: AgentExecutionOptions = {
        taskId: "test-task-12",
      };

      const events: AgentExecutionEvent[] = [];
      const iterator = executor.executeTask(request, options);

      for await (const event of { [Symbol.asyncIterator]: () => iterator }) {
        events.push(event);
      }

      expect(mockGenerateContent).toHaveBeenCalled();
      expect(mockGenerateContentStream).not.toHaveBeenCalled();
    });
  });

  describe("cancelTask", () => {
    it("should cancel a running task", async () => {
      // Create a delayed task
      mockGenerateContent.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  candidates: [{ content: { parts: [{ text: "Response" }] } }],
                }),
              1000,
            ),
          ),
      );

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

  // F8: Opt-in Interactions API path (GEMINI_USE_INTERACTIONS_API=1)
  describe("executeTaskWithInteractionsApi (opt-in)", () => {
    const ORIGINAL_FLAG = process.env.GEMINI_USE_INTERACTIONS_API;

    beforeEach(() => {
      process.env.GEMINI_USE_INTERACTIONS_API = "1";
      mockInteractionsCreate.mockReset();
    });

    afterEach(() => {
      if (ORIGINAL_FLAG !== undefined) process.env.GEMINI_USE_INTERACTIONS_API = ORIGINAL_FLAG;
      else delete process.env.GEMINI_USE_INTERACTIONS_API;
    });

    async function collect(iter: AsyncIterator<AgentExecutionEvent>) {
      const out: AgentExecutionEvent[] = [];
      while (true) {
        const r = await iter.next();
        if (r.done) break;
        out.push(r.value);
      }
      return out;
    }

    it("extracts text from ModelOutputStep.content array", async () => {
      mockInteractionsCreate.mockResolvedValue({
        id: "int-1",
        steps: [
          {
            type: "model_output",
            content: [
              { type: "text", text: "Hello " },
              { type: "text", text: "world" },
            ],
          },
        ],
        usage: { total_input_tokens: 5, total_output_tokens: 2 },
      });

      const events = await collect(
        executor.executeTask({ instruction: "ping" }, { taskId: "t-1" }),
      );

      const response = events.find((e) => e.type === "agent:response") as
        | { type: "agent:response"; text: string }
        | undefined;
      expect(response?.text).toBe("Hello world");
      const completed = events.find((e) => e.type === "agent:completed") as
        | { type: "agent:completed"; output: string }
        | undefined;
      expect(completed?.output).toBe("Hello world");
      const stats = events.find((e) => e.type === "agent:statistics") as
        | { type: "agent:statistics"; tokenUsage: { input: number; output: number } }
        | undefined;
      expect(stats?.tokenUsage).toEqual({ input: 5, output: 2 });
    });

    it("places tools at top-level (NOT under environment) and includes file functions when enabled", async () => {
      mockInteractionsCreate.mockResolvedValue({
        id: "int-2",
        steps: [{ type: "model_output", content: [{ type: "text", text: "ok" }] }],
        usage: { total_input_tokens: 1, total_output_tokens: 1 },
      });

      await collect(
        executor.executeTask(
          {
            instruction: "go",
            options: {
              gemini: {
                enableGoogleSearch: true,
                enableCodeExecution: true,
                enableFileOperations: true,
                systemPrompt: "be terse",
              },
            },
          },
          { taskId: "t-2" },
        ),
      );

      expect(mockInteractionsCreate).toHaveBeenCalledTimes(1);
      const params = mockInteractionsCreate.mock.calls[0]?.[0] as {
        tools?: Array<{ type?: string; name?: string }>;
        environment?: unknown;
        system_instruction?: string;
        generation_config?: unknown;
      };

      // tools is top-level, not under environment
      expect(Array.isArray(params.tools)).toBe(true);
      expect(params.environment).toBeUndefined();
      // includes server-side tool flags
      expect(params.tools?.some((t) => t.type === "google_search")).toBe(true);
      expect(params.tools?.some((t) => t.type === "code_execution")).toBe(true);
      // file ops surfaced as { type: 'function', name: 'createFile', ... }
      expect(params.tools?.some((t) => t.type === "function" && t.name === "createFile")).toBe(
        true,
      );

      // system_instruction is top-level, not nested under generation_config
      expect(params.system_instruction).toBe("be terse");
      expect(params.generation_config).toBeUndefined();
    });

    it("converts FILE_TOOL_DECLARATIONS schema from UPPERCASE to JSON Schema lowercase", async () => {
      mockInteractionsCreate.mockResolvedValue({
        id: "int-schema",
        steps: [{ type: "model_output", content: [{ type: "text", text: "ok" }] }],
        usage: { total_input_tokens: 1, total_output_tokens: 1 },
      });

      await collect(
        executor.executeTask(
          {
            instruction: "go",
            options: { gemini: { enableFileOperations: true } },
          },
          { taskId: "t-schema" },
        ),
      );

      const params = mockInteractionsCreate.mock.calls[0]?.[0] as {
        tools?: Array<{
          type?: string;
          name?: string;
          parameters?: { type?: string; properties?: Record<string, { type?: string }> };
        }>;
      };
      const createFile = params.tools?.find((t) => t.name === "createFile");
      expect(createFile?.parameters?.type).toBe("object"); // not "OBJECT"
      // Nested property types should also be lowercased
      const props = createFile?.parameters?.properties ?? {};
      const propTypes = Object.values(props).map((p) => p.type);
      // sanity: at least one nested property exists and is lowercase
      expect(propTypes.length).toBeGreaterThan(0);
      for (const t of propTypes) {
        if (typeof t === "string") expect(t).toBe(t.toLowerCase());
      }
    });

    it("extracts text from ThoughtStep.summary (not .content)", async () => {
      mockInteractionsCreate.mockResolvedValue({
        id: "int-thought",
        steps: [
          {
            type: "thought",
            summary: [
              { type: "text", text: "Considering the request..." },
              { type: "text", text: " choosing tools." },
            ],
          },
          { type: "model_output", content: [{ type: "text", text: "ok" }] },
        ],
        usage: { total_input_tokens: 1, total_output_tokens: 1 },
      });

      const events = await collect(
        executor.executeTask({ instruction: "ping" }, { taskId: "t-thought" }),
      );
      const thought = events.find(
        (e) =>
          e.type === "agent:progress" && /\[thinking\]/.test((e as { message: string }).message),
      ) as { message: string } | undefined;
      expect(thought).toBeDefined();
      expect(thought?.message).toContain("Considering the request");
      expect(thought?.message).toContain("choosing tools");
    });

    it("toInteractionsJsonSchema converts nested types correctly", () => {
      const input = {
        type: "OBJECT",
        properties: {
          path: { type: "STRING", description: "path" },
          tags: { type: "ARRAY", items: { type: "STRING" } },
          nested: {
            type: "OBJECT",
            properties: { flag: { type: "BOOLEAN" } },
          },
        },
        required: ["path"],
      };
      const result = __test_toInteractionsJsonSchema(input) as {
        type: string;
        properties: Record<string, { type: string; items?: { type: string }; properties?: any }>;
        required: string[];
      };
      expect(result.type).toBe("object");
      expect(result.properties.path.type).toBe("string");
      expect(result.properties.tags.type).toBe("array");
      expect(result.properties.tags.items?.type).toBe("string");
      expect(result.properties.nested.type).toBe("object");
      expect(result.properties.nested.properties?.flag.type).toBe("boolean");
      expect(result.required).toEqual(["path"]); // non-schema fields preserved
    });

    it("round-trips function calls via previous_interaction_id + function_result input", async () => {
      // First call: model asks to call createFile
      mockInteractionsCreate.mockResolvedValueOnce({
        id: "int-a",
        steps: [
          {
            type: "function_call",
            id: "call-1",
            name: "createFile",
            arguments: { path: "/tmp/note.txt", content: "hi" },
          },
        ],
        usage: { total_input_tokens: 4, total_output_tokens: 3 },
      });
      // Second call: model returns final text after seeing tool result
      mockInteractionsCreate.mockResolvedValueOnce({
        id: "int-b",
        steps: [{ type: "model_output", content: [{ type: "text", text: "done" }] }],
        usage: { total_input_tokens: 1, total_output_tokens: 1 },
      });

      const events = await collect(
        executor.executeTask(
          {
            instruction: "write a file",
            context: { workingDirectory: "/tmp", files: [] },
            options: { gemini: { enableFileOperations: true } },
          },
          { taskId: "t-3" },
        ),
      );

      expect(mockInteractionsCreate).toHaveBeenCalledTimes(2);

      // Second call must chain via previous_interaction_id and send function_result input
      const secondParams = mockInteractionsCreate.mock.calls[1]?.[0] as {
        previous_interaction_id?: string;
        input?: Array<{ type?: string; call_id?: string; name?: string; is_error?: boolean }>;
      };
      expect(secondParams.previous_interaction_id).toBe("int-a");
      expect(Array.isArray(secondParams.input)).toBe(true);
      expect(secondParams.input?.[0]).toMatchObject({
        type: "function_result",
        call_id: "call-1",
        name: "createFile",
      });

      // Tool start / end events emitted for the local execution
      const start = events.find(
        (e) => e.type === "agent:tool:start" && (e as { tool: string }).tool === "createFile",
      );
      const end = events.find(
        (e) => e.type === "agent:tool:end" && (e as { tool: string }).tool === "createFile",
      );
      expect(start).toBeDefined();
      expect(end).toBeDefined();

      // Final agent:completed surfaces "done"
      const completed = events.find((e) => e.type === "agent:completed") as
        | { type: "agent:completed"; output: string }
        | undefined;
      expect(completed?.output).toBe("done");
    });
  });
});

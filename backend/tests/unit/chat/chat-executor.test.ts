import { describe, it, expect, vi, beforeEach } from "vitest";
import { ClaudeChatExecutor, createChatExecutor } from "../../../src/chat/chat-executor";
import type { ChatStreamEvent, ChatExecutorOptions } from "../../../src/chat/types";

// Mock the Claude SDK
vi.mock("@anthropic-ai/claude-agent-sdk", () => ({
  query: vi.fn(),
}));

describe("ChatExecutor", () => {
  describe("ClaudeChatExecutor", () => {
    let executor: ClaudeChatExecutor;
    let mockEvents: ChatStreamEvent[];
    let onEvent: (event: ChatStreamEvent) => void;

    const defaultOptions: ChatExecutorOptions = {
      sessionId: "session-123",
      characterId: "default",
      systemPrompt: "You are a helpful assistant.",
      executor: "claude",
    };

    beforeEach(() => {
      vi.clearAllMocks();
      executor = new ClaudeChatExecutor();
      mockEvents = [];
      onEvent = (event) => mockEvents.push(event);
    });

    it("should emit start event when execution begins", async () => {
      const { query } = await import("@anthropic-ai/claude-agent-sdk");
      (query as any).mockReturnValue({
        async *[Symbol.asyncIterator]() {
          yield { type: "assistant", message: { content: [{ type: "text", text: "Hello" }] } };
        },
      });

      await executor.execute("Hello", defaultOptions, onEvent);

      const startEvent = mockEvents.find((e) => e.type === "start");
      expect(startEvent).toBeDefined();
      expect(startEvent?.data.sessionId).toBe("session-123");
      expect(startEvent?.data.messageId).toBeDefined();
    });

    it("should emit text events for text responses", async () => {
      const { query } = await import("@anthropic-ai/claude-agent-sdk");
      (query as any).mockReturnValue({
        async *[Symbol.asyncIterator]() {
          yield { type: "assistant", message: { content: [{ type: "text", text: "Hello " }] } };
          yield { type: "assistant", message: { content: [{ type: "text", text: "World!" }] } };
        },
      });

      const result = await executor.execute("Hello", defaultOptions, onEvent);

      const textEvents = mockEvents.filter((e) => e.type === "text");
      expect(textEvents).toHaveLength(2);
      expect(textEvents[0].data.text).toBe("Hello ");
      expect(textEvents[1].data.text).toBe("World!");
      expect(result.content).toBe("Hello World!");
    });

    it("should emit done event when execution completes", async () => {
      const { query } = await import("@anthropic-ai/claude-agent-sdk");
      (query as any).mockReturnValue({
        async *[Symbol.asyncIterator]() {
          yield { type: "assistant", message: { content: [{ type: "text", text: "Done" }] } };
        },
      });

      await executor.execute("Hello", defaultOptions, onEvent);

      const doneEvent = mockEvents.find((e) => e.type === "done");
      expect(doneEvent).toBeDefined();
      expect(doneEvent?.data.sessionId).toBe("session-123");
    });

    it("should emit error event on failure", async () => {
      const { query } = await import("@anthropic-ai/claude-agent-sdk");
      (query as any).mockReturnValue({
        async *[Symbol.asyncIterator]() {
          throw new Error("API Error");
        },
      });

      await expect(executor.execute("Hello", defaultOptions, onEvent)).rejects.toThrow(
        "API Error",
      );

      const errorEvent = mockEvents.find((e) => e.type === "error");
      expect(errorEvent).toBeDefined();
      expect(errorEvent?.data.error).toBe("API Error");
    });

    it("should handle tool use events", async () => {
      const { query } = await import("@anthropic-ai/claude-agent-sdk");
      (query as any).mockReturnValue({
        async *[Symbol.asyncIterator]() {
          yield {
            type: "assistant",
            message: {
              content: [
                { type: "tool_use", name: "read_file", input: { path: "/test.txt" } },
              ],
            },
          };
          yield { type: "assistant", message: { content: [{ type: "text", text: "Read the file" }] } };
        },
      });

      await executor.execute("Read file", defaultOptions, onEvent);

      const toolUseEvent = mockEvents.find((e) => e.type === "tool_use");
      expect(toolUseEvent).toBeDefined();
      expect(toolUseEvent?.data.tool).toBe("read_file");
    });

    it("should pass working directory to SDK", async () => {
      const { query } = await import("@anthropic-ai/claude-agent-sdk");
      (query as any).mockReturnValue({
        async *[Symbol.asyncIterator]() {
          yield { type: "assistant", message: { content: [{ type: "text", text: "Done" }] } };
        },
      });

      await executor.execute("Hello", {
        ...defaultOptions,
        workingDirectory: "/test/dir",
      }, onEvent);

      expect(query).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            cwd: "/test/dir",
          }),
        }),
      );
    });

    it("should resume session with SDK session ID", async () => {
      const { query } = await import("@anthropic-ai/claude-agent-sdk");
      (query as any).mockReturnValue({
        async *[Symbol.asyncIterator]() {
          yield { type: "assistant", message: { content: [{ type: "text", text: "Continued" }] } };
        },
      });

      await executor.execute("Continue", {
        ...defaultOptions,
        sdkSessionId: "sdk-session-123",
      }, onEvent);

      expect(query).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            resume: "sdk-session-123",
          }),
        }),
      );
    });
  });

  describe("createChatExecutor", () => {
    it("should create ClaudeChatExecutor for claude type", () => {
      const executor = createChatExecutor("claude");
      expect(executor).toBeInstanceOf(ClaudeChatExecutor);
    });

    it("should create ClaudeChatExecutor for unknown type (default)", () => {
      const executor = createChatExecutor("unknown");
      expect(executor).toBeInstanceOf(ClaudeChatExecutor);
    });
  });
});

import { describe, it, expect, beforeEach, vi } from "vitest";
import { ClaudeCodeClient } from "../../../src/claude/claude-code-client";
import { unstable_v2_createSession, type SDKMessage } from "@anthropic-ai/claude-agent-sdk";

const mockSend = vi.fn().mockResolvedValue(undefined);

function createMockSession(messages: any[], opts?: { throwOnStream?: Error }) {
  return {
    get sessionId() { return "test-session"; },
    send: mockSend,
    stream: vi.fn().mockReturnValue((async function* () {
      for (const msg of messages) {
        yield msg;
      }
      if (opts?.throwOnStream) throw opts.throwOnStream;
    })()),
    close: vi.fn(),
    [Symbol.asyncDispose]: vi.fn(),
  };
}

vi.mock("@anthropic-ai/claude-agent-sdk", () => ({
  unstable_v2_createSession: vi.fn(),
  unstable_v2_resumeSession: vi.fn(),
}));

const mockCreateSession = vi.mocked(unstable_v2_createSession);

describe("ClaudeCodeClient", () => {
  let client: ClaudeCodeClient;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = "test-api-key";
    client = new ClaudeCodeClient();
  });

  describe("initialization", () => {
    it("should initialize successfully with API key", () => {
      expect(() => new ClaudeCodeClient()).not.toThrow();
    });
  });

  describe("executeTask", () => {
    it("should execute task successfully", async () => {
      const mockMessages = [
        { type: "assistant", message: "Hello", parent_tool_use_id: null, session_id: "test-session" },
        { type: "assistant", message: "Done", parent_tool_use_id: null, session_id: "test-session" },
      ];
      mockCreateSession.mockReturnValue(createMockSession(mockMessages) as any);

      const result = await client.executeTask("Test task");

      expect(result.success).toBe(true);
      expect(result.messages).toHaveLength(2);
      expect(mockSend).toHaveBeenCalledWith("Test task");
    });

    it("should handle errors during stream", async () => {
      const error = new Error("API Error");
      mockCreateSession.mockReturnValue(createMockSession([], { throwOnStream: error }) as any);

      const result = await client.executeTask("Failing task");

      expect(result.success).toBe(false);
      expect(result.error).toBe(error);
    });

    it("should collect messages before error", async () => {
      const messages = [
        { type: "assistant", message: "Starting...", parent_tool_use_id: null, session_id: "test-session" },
      ];
      mockCreateSession.mockReturnValue(createMockSession(messages, { throwOnStream: new Error("Mid-error") }) as any);

      const result = await client.executeTask("Partial execution");

      expect(result.success).toBe(false);
      expect(result.messages).toHaveLength(1);
      expect(result.error?.message).toBe("Mid-error");
    });

    it("should extract session ID from system message", async () => {
      const messages = [
        { type: "system", session_id: "extracted-session-id" },
        { type: "assistant", message: "Done", parent_tool_use_id: null },
      ];
      mockCreateSession.mockReturnValue(createMockSession(messages) as any);

      const result = await client.executeTask("Test");

      expect(result.sessionId).toBe("extracted-session-id");
    });
  });

  describe("formatMessagesAsString", () => {
    it("should format assistant messages", () => {
      const messages = [
        {
          type: "assistant",
          message: {
            content: [{ type: "text", text: "First message" }],
          },
        },
        {
          type: "assistant",
          message: {
            content: [{ type: "text", text: "Second message" }],
          },
        },
      ] as any as SDKMessage[];

      const result = client.formatMessagesAsString(messages);
      expect(result).toContain("First message");
      expect(result).toContain("Second message");
    });

    it("should return empty string for no messages", () => {
      const result = client.formatMessagesAsString([]);
      expect(result).toBe("");
    });

    it("should handle messages with tool_use content", () => {
      const messages = [
        {
          type: "assistant",
          message: {
            content: [
              { type: "text", text: "Let me check" },
              { type: "tool_use", name: "Read", input: { file: "test.ts" } },
            ],
          },
        },
      ] as any as SDKMessage[];

      const result = client.formatMessagesAsString(messages);
      expect(result).toContain("Let me check");
    });
  });
});

import { describe, it, expect } from "vitest";
import { ConversationFormatter } from "../../../src/utils/conversation-formatter";
import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";

describe("ConversationFormatter", () => {
  describe("extractConversationFromMessages", () => {
    it("should extract user and assistant messages", () => {
      const messages: SDKMessage[] = [
        {
          type: "user",
          message: { content: "What is the weather today?" },
        } as any,
        {
          type: "assistant",
          message: {
            content: [{ type: "text", text: "I'd be happy to help with weather information." }],
          },
        } as any,
      ];

      const result = ConversationFormatter.extractConversationFromMessages(messages);

      expect(result).toContain("User: What is the weather today?");
      expect(result).toContain("Assistant: I'd be happy to help with weather information.");
    });

    it("should handle tool usage in assistant messages", () => {
      const messages: SDKMessage[] = [
        {
          type: "assistant",
          message: {
            content: [
              { type: "text", text: "Let me check the weather for you." },
              { type: "tool_use", name: "WebSearch", input: { query: "weather today" } },
            ],
          },
        } as any,
      ];

      const result = ConversationFormatter.extractConversationFromMessages(messages);

      expect(result).toContain("Let me check the weather for you.");
      expect(result).toContain("[Used tool: WebSearch]");
    });

    it("should handle empty messages array", () => {
      const result = ConversationFormatter.extractConversationFromMessages([]);
      expect(result).toBe("");
    });

    it("should ignore messages without content", () => {
      const messages: SDKMessage[] = [
        { type: "user" } as any,
        { type: "assistant", message: {} } as any,
        { type: "result", subtype: "success" } as any,
      ];

      const result = ConversationFormatter.extractConversationFromMessages(messages);
      expect(result).toBe("");
    });
  });

  describe("formatForSystemPrompt", () => {
    it("should format conversation for system prompt", () => {
      const messages: SDKMessage[] = [
        {
          type: "user",
          message: { content: "Calculate 5 + 3" },
        } as any,
        {
          type: "assistant",
          message: {
            content: [{ type: "text", text: "5 + 3 equals 8." }],
          },
        } as any,
      ];

      const result = ConversationFormatter.formatForSystemPrompt(messages);

      expect(result).toContain("Previous conversation:");
      expect(result).toContain("User: Calculate 5 + 3");
      expect(result).toContain("Assistant: 5 + 3 equals 8.");
      expect(result).toContain("Please continue from the above conversation");
    });

    it("should return empty string for no messages", () => {
      const result = ConversationFormatter.formatForSystemPrompt([]);
      expect(result).toBe("");
    });
  });

  describe("extractLastAssistantResponse", () => {
    it("should extract the last assistant response", () => {
      const messages: SDKMessage[] = [
        {
          type: "assistant",
          message: {
            content: [{ type: "text", text: "First response" }],
          },
        } as any,
        {
          type: "user",
          message: { content: "Another question" },
        } as any,
        {
          type: "assistant",
          message: {
            content: [{ type: "text", text: "Final response" }],
          },
        } as any,
      ];

      const result = ConversationFormatter.extractLastAssistantResponse(messages);
      expect(result).toBe("Final response");
    });

    it("should return null if no assistant messages", () => {
      const messages: SDKMessage[] = [
        {
          type: "user",
          message: { content: "Question" },
        } as any,
      ];

      const result = ConversationFormatter.extractLastAssistantResponse(messages);
      expect(result).toBeNull();
    });
  });

  describe("extractToolUsageSummary", () => {
    it("should extract unique tool names", () => {
      const messages: SDKMessage[] = [
        {
          type: "assistant",
          message: {
            content: [
              { type: "tool_use", name: "WebSearch", input: {} },
              { type: "tool_use", name: "Read", input: {} },
            ],
          },
        } as any,
        {
          type: "assistant",
          message: {
            content: [
              { type: "tool_use", name: "WebSearch", input: {} }, // Duplicate
              { type: "tool_use", name: "Write", input: {} },
            ],
          },
        } as any,
      ];

      const result = ConversationFormatter.extractToolUsageSummary(messages);
      expect(result).toEqual(["WebSearch", "Read", "Write"]);
    });

    it("should return empty array if no tools used", () => {
      const messages: SDKMessage[] = [
        {
          type: "assistant",
          message: {
            content: [{ type: "text", text: "Just text" }],
          },
        } as any,
      ];

      const result = ConversationFormatter.extractToolUsageSummary(messages);
      expect(result).toEqual([]);
    });
  });
});

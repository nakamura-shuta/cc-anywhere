import { describe, it, expect, vi } from "vitest";
import { createChatExecutor } from "../../../src/chat/chat-executor";
import { ChatSDKClient } from "../../../src/chat/chat-sdk-client";
import { ChatSessionService } from "../../../src/claude/session/chat-session-service";

vi.mock("@anthropic-ai/claude-agent-sdk", () => ({
  unstable_v2_createSession: vi.fn(),
  unstable_v2_resumeSession: vi.fn(),
  forkSession: vi.fn(),
}));

describe("ChatExecutor", () => {
  describe("createChatExecutor", () => {
    it("should create ChatSDKClient with service", () => {
      const service = new ChatSessionService();
      const executor = createChatExecutor("claude", service);
      expect(executor).toBeInstanceOf(ChatSDKClient);
    });

    it("should create ChatSDKClient for any executor type", () => {
      const service = new ChatSessionService();
      const executor = createChatExecutor("unknown", service);
      expect(executor).toBeInstanceOf(ChatSDKClient);
    });
  });
});

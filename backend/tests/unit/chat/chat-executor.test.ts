import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createChatExecutor } from "../../../src/chat/chat-executor";
import { ChatSDKClient } from "../../../src/chat/chat-sdk-client";
import { ChatSDKClientV1 } from "../../../src/chat/chat-sdk-client-v1";
import { ChatSessionService } from "../../../src/claude/session/chat-session-service";

// Mock SDK to avoid import errors
vi.mock("@anthropic-ai/claude-agent-sdk", () => ({
  unstable_v2_createSession: vi.fn(),
  unstable_v2_resumeSession: vi.fn(),
  forkSession: vi.fn(),
  query: vi.fn(),
}));

describe("ChatExecutor", () => {
  describe("createChatExecutor", () => {
    let originalMode: string | undefined;

    beforeEach(() => {
      originalMode = process.env.CHAT_SESSION_MODE;
    });

    afterEach(() => {
      if (originalMode !== undefined) {
        process.env.CHAT_SESSION_MODE = originalMode;
      } else {
        delete process.env.CHAT_SESSION_MODE;
      }
    });

    it("should create ChatSDKClient (V2) for claude type with service", () => {
      process.env.CHAT_SESSION_MODE = "v2";
      const service = new ChatSessionService();
      const executor = createChatExecutor("claude", service);
      expect(executor).toBeInstanceOf(ChatSDKClient);
    });

    it("should create ChatSDKClientV1 for claude type in v1 mode", () => {
      process.env.CHAT_SESSION_MODE = "v1";
      const executor = createChatExecutor("claude");
      expect(executor).toBeInstanceOf(ChatSDKClientV1);
    });

    it("should default to V2 mode", () => {
      delete process.env.CHAT_SESSION_MODE;
      const service = new ChatSessionService();
      const executor = createChatExecutor("claude", service);
      expect(executor).toBeInstanceOf(ChatSDKClient);
    });

    it("should throw if V2 mode without service", () => {
      process.env.CHAT_SESSION_MODE = "v2";
      expect(() => createChatExecutor("claude")).toThrow("ChatSessionService is required");
    });

    it("should create V1 executor for unknown type in v1 mode", () => {
      process.env.CHAT_SESSION_MODE = "v1";
      const executor = createChatExecutor("unknown");
      expect(executor).toBeInstanceOf(ChatSDKClientV1);
    });
  });
});

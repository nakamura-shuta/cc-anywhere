import { describe, it, expect, vi } from "vitest";
import { createChatExecutor } from "../../../src/chat/chat-executor";
import { ChatSDKClient } from "../../../src/chat/chat-sdk-client";
import { V2SessionRuntime } from "../../../src/session/v2-session-runtime";

vi.mock("@anthropic-ai/claude-agent-sdk", () => ({
  unstable_v2_createSession: vi.fn(),
  unstable_v2_resumeSession: vi.fn(),
  forkSession: vi.fn(),
  getSessionInfo: vi.fn(),
  getSessionMessages: vi.fn(),
  listSessions: vi.fn(),
  renameSession: vi.fn(),
  tagSession: vi.fn(),
}));

describe("ChatExecutor", () => {
  describe("createChatExecutor", () => {
    it("should create ChatSDKClient with runtime", () => {
      const runtime = new V2SessionRuntime();
      const executor = createChatExecutor("claude", runtime);
      expect(executor).toBeInstanceOf(ChatSDKClient);
    });

    it("should create ChatSDKClient for any executor type", () => {
      const runtime = new V2SessionRuntime();
      const executor = createChatExecutor("unknown", runtime);
      expect(executor).toBeInstanceOf(ChatSDKClient);
    });
  });
});

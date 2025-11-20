import { describe, it, expect } from "vitest";
import { createChatExecutor } from "../../../src/chat/chat-executor";
import { ChatSDKClient } from "../../../src/chat/chat-sdk-client";

describe("ChatExecutor", () => {
  describe("createChatExecutor", () => {
    it("should create ChatSDKClient for claude type", () => {
      const executor = createChatExecutor("claude");
      expect(executor).toBeInstanceOf(ChatSDKClient);
    });

    it("should create ChatSDKClient for unknown type (default)", () => {
      const executor = createChatExecutor("unknown");
      expect(executor).toBeInstanceOf(ChatSDKClient);
    });
  });
});

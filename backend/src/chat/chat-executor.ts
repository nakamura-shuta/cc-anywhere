/**
 * Chat executor factory
 *
 * Creates the appropriate chat executor based on executor type and session mode.
 * Supports V2 (ChatSessionService) and V1 (legacy query()) modes via CHAT_SESSION_MODE env.
 */

import { ChatSDKClient } from "./chat-sdk-client.js";
import { ChatSDKClientV1 } from "./chat-sdk-client-v1.js";
import { ChatSessionService } from "../claude/session/chat-session-service.js";
import type { IChatExecutor } from "./types.js";

/**
 * Chat executor factory
 *
 * @param executorType - "claude" | "codex" etc.
 * @param chatSessionService - Shared ChatSessionService singleton (required for V2 mode)
 */
export function createChatExecutor(
  executorType: string,
  chatSessionService?: ChatSessionService,
): IChatExecutor {
  const sessionMode = process.env.CHAT_SESSION_MODE || "v2";

  switch (executorType) {
    case "claude":
      if (sessionMode === "v1") {
        return new ChatSDKClientV1();
      }
      if (!chatSessionService) {
        throw new Error("ChatSessionService is required for V2 mode");
      }
      return new ChatSDKClient(chatSessionService);
    default:
      if (sessionMode === "v1") {
        return new ChatSDKClientV1();
      }
      if (!chatSessionService) {
        throw new Error("ChatSessionService is required for V2 mode");
      }
      return new ChatSDKClient(chatSessionService);
  }
}

/**
 * Chat executor factory
 *
 * This file now serves as a simple factory that returns ChatSDKClient.
 * The legacy ClaudeChatExecutor has been removed after successful validation
 * of the unified SDK implementation.
 */

import { ChatSDKClient } from "./chat-sdk-client.js";
import type { IChatExecutor } from "./types.js";

/**
 * Chat executor factory
 *
 * Creates the appropriate chat executor based on executor type.
 * Currently only supports Claude via ChatSDKClient.
 */
export function createChatExecutor(executorType: string): IChatExecutor {
  switch (executorType) {
    case "claude":
      return new ChatSDKClient();
    // TODO: Add codex executor support
    // case "codex":
    //   return new CodexChatExecutor();
    default:
      return new ChatSDKClient();
  }
}

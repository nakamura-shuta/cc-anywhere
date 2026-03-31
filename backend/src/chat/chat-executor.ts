/**
 * Chat executor factory
 */

import { ChatSDKClient } from "./chat-sdk-client.js";
import { ChatSessionService } from "../claude/session/chat-session-service.js";
import type { IChatExecutor } from "./types.js";

export function createChatExecutor(
  _executorType: string,
  chatSessionService: ChatSessionService,
): IChatExecutor {
  return new ChatSDKClient(chatSessionService);
}

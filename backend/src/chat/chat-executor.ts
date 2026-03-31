/**
 * Chat executor factory
 */

import { ChatSDKClient } from "./chat-sdk-client.js";
import type { V2SessionRuntime } from "../session/v2-session-runtime.js";
import type { IChatExecutor } from "./types.js";

export function createChatExecutor(
  _executorType: string,
  runtime: V2SessionRuntime,
): IChatExecutor {
  return new ChatSDKClient(runtime);
}

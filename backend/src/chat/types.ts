/**
 * Types for chat functionality
 */

import type { ExecutorType } from "../agents/types.js";

/**
 * Agent character definition
 */
export interface AgentCharacter {
  id: string;
  name: string;
  model: ExecutorType;
  avatar: string;
  description: string;
  systemPrompt: string;
  isBuiltIn: boolean;
}

/**
 * Chat stream event types
 */
export type ChatStreamEventType = "start" | "text" | "tool_use" | "tool_result" | "done" | "error";

/**
 * Chat stream event
 */
export interface ChatStreamEvent {
  type: ChatStreamEventType;
  data: {
    text?: string;
    tool?: string;
    toolInput?: unknown;
    toolOutput?: unknown;
    error?: string;
    sessionId?: string;
    messageId?: string;
    sdkSessionId?: string;
  };
  timestamp: string;
}

/**
 * Chat executor options
 */
export interface ChatExecutorOptions {
  sessionId: string;
  characterId: string;
  systemPrompt: string;
  workingDirectory?: string;
  executor: ExecutorType;
  sdkSessionId?: string;
}

/**
 * Chat executor result
 */
export interface ChatExecutorResult {
  messageId: string;
  content: string;
  sdkSessionId?: string;
}

/**
 * Chat executor interface
 */
export interface IChatExecutor {
  /**
   * Execute chat message and return result with streaming support
   */
  execute(
    message: string,
    options: ChatExecutorOptions,
    onEvent: (event: ChatStreamEvent) => void,
  ): Promise<ChatExecutorResult>;
}

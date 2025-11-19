/**
 * Chat executor for handling chat interactions with Claude Code SDK
 */

import { v4 as uuidv4 } from "uuid";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { logger } from "../utils/logger.js";
import { config } from "../config/index.js";
import type {
  IChatExecutor,
  ChatExecutorOptions,
  ChatExecutorResult,
  ChatStreamEvent,
} from "./types.js";
import type { QueryOptions } from "../claude/strategies/claude-code-strategy.interface.js";

/**
 * Claude-based chat executor
 */
export class ClaudeChatExecutor implements IChatExecutor {
  async execute(
    message: string,
    options: ChatExecutorOptions,
    onEvent: (event: ChatStreamEvent) => void,
  ): Promise<ChatExecutorResult> {
    const messageId = uuidv4();

    // Emit start event
    onEvent({
      type: "start",
      data: {
        sessionId: options.sessionId,
        messageId,
      },
      timestamp: new Date().toISOString(),
    });

    try {
      // Set API key in environment
      const originalApiKey = process.env.CLAUDE_API_KEY;
      process.env.CLAUDE_API_KEY = config.claude.apiKey;

      // Prepare query options
      const queryOptions: QueryOptions = {
        prompt: message,
        abortController: new AbortController(),
        options: {
          maxTurns: 10,
          customSystemPrompt: options.systemPrompt,
          permissionMode: "bypassPermissions",
          cwd: options.workingDirectory,
          resume: options.sdkSessionId,
        },
      };

      // Collect response text
      let fullText = "";
      let sdkSessionId: string | undefined;

      // Process with streaming using query
      for await (const event of query(queryOptions)) {
        // Capture SDK session ID from init event
        if (event.type === "system" && "sessionId" in event) {
          sdkSessionId = event.sessionId as string;
        }

        // Handle assistant message events
        if (event.type === "assistant" && event.message) {
          // Process content blocks
          for (const content of event.message.content || []) {
            if (content.type === "text") {
              fullText += content.text;
              onEvent({
                type: "text",
                data: { text: content.text },
                timestamp: new Date().toISOString(),
              });
            } else if (content.type === "tool_use") {
              onEvent({
                type: "tool_use",
                data: {
                  tool: content.name,
                  toolInput: content.input,
                },
                timestamp: new Date().toISOString(),
              });
            }
          }
        }

        // Handle result events
        if (event.type === "result") {
          // Capture session ID from result if not already captured
          if (!sdkSessionId && "sessionId" in event) {
            sdkSessionId = event.sessionId as string;
          }
        }
      }

      // Emit done event
      onEvent({
        type: "done",
        data: {
          sessionId: options.sessionId,
          messageId,
          sdkSessionId,
        },
        timestamp: new Date().toISOString(),
      });

      // Restore original API key
      if (originalApiKey !== undefined) {
        process.env.CLAUDE_API_KEY = originalApiKey;
      } else {
        delete process.env.CLAUDE_API_KEY;
      }

      return {
        messageId,
        content: fullText,
        sdkSessionId,
      };
    } catch (error) {
      // Restore original API key on error
      const originalApiKey = process.env.CLAUDE_API_KEY;
      if (originalApiKey !== undefined) {
        process.env.CLAUDE_API_KEY = originalApiKey;
      } else {
        delete process.env.CLAUDE_API_KEY;
      }
      const errorMessage = error instanceof Error ? error.message : String(error);

      logger.error("Chat execution failed", {
        sessionId: options.sessionId,
        error: errorMessage,
      });

      // Emit error event
      onEvent({
        type: "error",
        data: {
          error: errorMessage,
          sessionId: options.sessionId,
          messageId,
        },
        timestamp: new Date().toISOString(),
      });

      throw error;
    }
  }
}

/**
 * Chat executor factory
 */
export function createChatExecutor(executorType: string): IChatExecutor {
  switch (executorType) {
    case "claude":
      return new ClaudeChatExecutor();
    // TODO: Add codex executor support
    // case "codex":
    //   return new CodexChatExecutor();
    default:
      return new ClaudeChatExecutor();
  }
}

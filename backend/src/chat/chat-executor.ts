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

/**
 * Helper to create timestamped events
 */
function createEvent<T extends ChatStreamEvent["type"]>(
  type: T,
  data: ChatStreamEvent["data"],
): ChatStreamEvent {
  return {
    type,
    data,
    timestamp: new Date().toISOString(),
  } as ChatStreamEvent;
}

/**
 * Helper to manage API key environment variable
 */
function withApiKey<T>(fn: () => T): T {
  const originalApiKey = process.env.CLAUDE_API_KEY;
  process.env.CLAUDE_API_KEY = config.claude.apiKey;

  try {
    return fn();
  } finally {
    if (originalApiKey !== undefined) {
      process.env.CLAUDE_API_KEY = originalApiKey;
    } else {
      delete process.env.CLAUDE_API_KEY;
    }
  }
}

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

    onEvent(
      createEvent("start", {
        sessionId: options.sessionId,
        messageId,
      }),
    );

    return withApiKey(async () => {
      try {
        const queryOptions = {
          prompt: message,
          stream: true,
          abortController: new AbortController(),
          options: {
            maxTurns: 10,
            includePartialMessages: true,
            customSystemPrompt: options.systemPrompt,
            permissionMode: "bypassPermissions" as const,
            cwd: options.workingDirectory,
            resume: options.sdkSessionId,
          },
        };

        let fullText = "";
        let sdkSessionId: string | undefined;

        for await (const event of query(queryOptions)) {
          // Log all events for debugging
          logger.debug("SDK event received", {
            type: event.type,
            event: JSON.stringify(event).substring(0, 500),
          });

          // Capture SDK session ID
          if (event.type === "system" && "sessionId" in event) {
            sdkSessionId = event.sessionId as string;
          }

          // Handle stream_event for streaming text deltas
          if (event.type === "stream_event") {
            const streamEvent = event as any;
            // Check for text delta in the stream event
            if (
              streamEvent.event?.type === "content_block_delta" &&
              streamEvent.event?.delta?.type === "text_delta" &&
              streamEvent.event?.delta?.text
            ) {
              const text = streamEvent.event.delta.text;
              fullText += text;
              onEvent(createEvent("text", { text }));
            }
          }

          // Process assistant messages - stream each text block
          if (event.type === "assistant" && event.message) {
            for (const content of event.message.content || []) {
              if (content.type === "text") {
                // Send text events for assistant messages
                const newText = content.text;
                if (newText) {
                  // Each assistant event contains the text to add
                  fullText += newText;
                  onEvent(createEvent("text", { text: newText }));
                }
              } else if (content.type === "tool_use") {
                onEvent(
                  createEvent("tool_use", {
                    tool: content.name,
                    toolInput: content.input,
                  }),
                );
              }
            }
          }

          // Capture session ID from result if not already captured
          if (event.type === "result" && !sdkSessionId && "sessionId" in event) {
            sdkSessionId = event.sessionId as string;
          }
        }

        onEvent(
          createEvent("done", {
            sessionId: options.sessionId,
            messageId,
            sdkSessionId,
          }),
        );

        return {
          messageId,
          content: fullText,
          sdkSessionId,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        logger.error("Chat execution failed", {
          sessionId: options.sessionId,
          error: errorMessage,
        });

        onEvent(
          createEvent("error", {
            error: errorMessage,
            sessionId: options.sessionId,
            messageId,
          }),
        );

        throw error;
      }
    });
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

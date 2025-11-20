/**
 * Chat SDK Client
 *
 * Thin wrapper around Claude SDK for chat-specific operations
 * Extends ClaudeSDKBase with minimal chat-specific logic
 */

import { v4 as uuidv4 } from "uuid";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { logger } from "../utils/logger.js";
import { ClaudeSDKBase } from "../claude/sdk/base.js";
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
 * Chat SDK Client implementation using unified SDK base
 *
 * Responsibilities:
 * - WebSocket-specific streaming
 * - Minimal event normalization (3 types: session, text_delta, tool_use)
 * - Other events (reasoning, todo, etc.) are passed through transparently
 */
export class ChatSDKClient extends ClaudeSDKBase implements IChatExecutor {
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

    return this.withApiKey(async () => {
      try {
        // Use createQueryOptions for basic options
        const baseOptions = this.createQueryOptions(message, {
          resume: !!options.sdkSessionId,
          sdkSessionId: options.sdkSessionId,
          systemPrompt: options.systemPrompt,
          cwd: options.workingDirectory,
        });

        // Add chat-specific options
        const queryOptions = {
          prompt: baseOptions.prompt,
          stream: true,
          abortController: new AbortController(),
          options: {
            maxTurns: 10,
            includePartialMessages: true,
            customSystemPrompt: baseOptions.systemPrompt,
            permissionMode: "bypassPermissions" as const,
            cwd: baseOptions.cwd,
            resume: baseOptions.sdkSessionId,
          },
        };

        let fullText = "";
        let sdkSessionId: string | undefined;

        for await (const event of query(queryOptions)) {
          // Minimal event normalization (3 types only)

          // 1. session: Extract sessionId (both formats supported)
          if (event.type === "system") {
            sdkSessionId = this.extractSessionId(event);
          }

          // 2. text_delta: Text streaming
          if (event.type === "stream_event") {
            const streamEvent = event as any;
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

          // Process assistant messages
          if (event.type === "assistant" && event.message) {
            for (const content of event.message.content || []) {
              if (content.type === "text") {
                const newText = content.text;
                if (newText) {
                  fullText += newText;
                  onEvent(createEvent("text", { text: newText }));
                }
              } else if (content.type === "tool_use") {
                // 3. tool_use: Tool execution
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
          if (event.type === "result" && !sdkSessionId) {
            sdkSessionId = this.extractSessionId(event);
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

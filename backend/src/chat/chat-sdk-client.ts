/**
 * Chat SDK Client (V2)
 *
 * Uses ChatSessionService (V2 Session API) for session lifecycle management.
 * Replaces query()-based implementation with send()/stream() pattern.
 */

import { v4 as uuidv4 } from "uuid";
import { logger } from "../utils/logger.js";
import type { V2SessionRuntime, ManagedSession } from "../session/v2-session-runtime.js";
import type {
  IChatExecutor,
  ChatExecutorOptions,
  ChatExecutorResult,
  ChatStreamEvent,
} from "./types.js";
import { config } from "../config/index.js";

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
 * Chat SDK Client implementation using V2 Session API
 *
 * Responsibilities:
 * - WebSocket-specific streaming via V2 send()/stream()
 * - Minimal event normalization (3 types: session, text_delta, tool_use)
 * - Draft session materialization handling
 * - Session detach/terminate lifecycle
 */
export class ChatSDKClient implements IChatExecutor {
  private service: V2SessionRuntime;
  private currentManaged: ManagedSession | null = null;

  constructor(service: V2SessionRuntime) {
    this.service = service;
  }

  async execute(
    message: string,
    options: ChatExecutorOptions,
    onEvent: (event: ChatStreamEvent) => void | Promise<void>,
  ): Promise<ChatExecutorResult> {
    const messageId = uuidv4();

    await onEvent(
      createEvent("start", {
        sessionId: options.sessionId,
        messageId,
      }),
    );

    // Set API key in env for SDK
    const originalApiKey = process.env.CLAUDE_API_KEY;
    process.env.CLAUDE_API_KEY = config.claude.apiKey;

    try {
      // resume or create
      if (options.sdkSessionId) {
        this.currentManaged = await this.service.resumeSession(options.sdkSessionId, {
          cwd: options.workingDirectory,
          systemPrompt: options.systemPrompt,
          permissionMode: "bypassPermissions" as any,
        });
      } else {
        this.currentManaged = await this.service.createSession({
          cwd: options.workingDirectory,
          systemPrompt: options.systemPrompt,
          permissionMode: "bypassPermissions" as any,
        });
      }

      let fullText = "";
      let resultSessionId: string | null = this.currentManaged.sdkSessionId;
      let hasStreamEvents = false;

      for await (const event of this.service.sendAndStream(
        this.currentManaged,
        message,
        {
          onMaterialized: async (id) => {
            resultSessionId = id;
            await onEvent(
              createEvent("done", {
                sdkSessionId: id,
                sessionId: options.sessionId,
                messageId: "__session_materialized__",
              }),
            );
          },
          onStateChanged: async (state) => {
            await onEvent(createEvent("session_state", { state }));
          },
        },
      )) {
        // Minimal event normalization (same 3 types as V1)

        // 1. session: Extract sessionId
        if (event.type === "system") {
          const sid = (event as any).sessionId ?? (event as any).session_id;
          if (sid && !resultSessionId) {
            resultSessionId = sid;
          }
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
            await onEvent(createEvent("text", { text }));
            hasStreamEvents = true;
          }
        }

        // Process assistant messages
        if (event.type === "assistant" && (event as any).message) {
          for (const content of (event as any).message.content || []) {
            if (content.type === "text" && !hasStreamEvents) {
              const newText = content.text;
              if (newText) {
                fullText += newText;
                await onEvent(createEvent("text", { text: newText }));
              }
            } else if (content.type === "tool_use") {
              await onEvent(
                createEvent("tool_use", {
                  tool: content.name,
                  toolInput: content.input,
                }),
              );
            }
          }
        }

        // Capture session ID from result
        if (event.type === "result" && !resultSessionId) {
          const sid = (event as any).sessionId ?? (event as any).session_id;
          if (sid) resultSessionId = sid;
        }
      }

      await onEvent(
        createEvent("done", {
          sessionId: options.sessionId,
          messageId,
          sdkSessionId: resultSessionId || undefined,
        }),
      );

      return {
        messageId,
        content: fullText,
        sdkSessionId: resultSessionId || undefined,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      logger.error("Chat execution failed", {
        sessionId: options.sessionId,
        error: errorMessage,
      });

      await onEvent(
        createEvent("error", {
          error: errorMessage,
          sessionId: options.sessionId,
          messageId,
        }),
      );

      throw error;
    } finally {
      // Restore API key
      if (originalApiKey !== undefined) {
        process.env.CLAUDE_API_KEY = originalApiKey;
      } else {
        delete process.env.CLAUDE_API_KEY;
      }
    }
  }

  /**
   * WS 切断時: pool から外すだけ。セッションは resume 可能な状態を維持。
   */
  detach(): void {
    if (this.currentManaged) {
      this.service.detach(this.currentManaged);
      this.currentManaged = null;
    }
  }

  /**
   * 明示的終了: セッションを完全に close。resume 不可になる。
   */
  terminate(): void {
    if (this.currentManaged) {
      this.service.terminate(this.currentManaged);
      this.currentManaged = null;
    }
  }
}

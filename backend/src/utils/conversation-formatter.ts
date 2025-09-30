import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";

/**
 * Format SDK messages into a human-readable conversation format
 */
export class ConversationFormatter {
  /**
   * Extract conversation text from SDK messages
   */
  static extractConversationFromMessages(messages: SDKMessage[]): string {
    const conversationParts: string[] = [];

    for (const message of messages) {
      const content = this.extractMessageContent(message);
      if (content) {
        conversationParts.push(content);
      }
    }

    return conversationParts.join("\n\n");
  }

  /**
   * Extract text content from a single SDK message
   */
  private static extractMessageContent(message: SDKMessage): string | null {
    try {
      switch (message.type) {
        case "user": {
          const userMsg = message as any;
          if (userMsg.message?.content) {
            return `User: ${userMsg.message.content}`;
          }
          break;
        }

        case "assistant": {
          const assistantMsg = message as any;
          if (assistantMsg.message?.content) {
            const textParts: string[] = [];

            // Handle content array
            if (Array.isArray(assistantMsg.message.content)) {
              for (const content of assistantMsg.message.content) {
                if (content.type === "text" && content.text) {
                  textParts.push(content.text);
                } else if (content.type === "tool_use") {
                  // Include tool usage information
                  textParts.push(`[Used tool: ${content.name}]`);
                }
              }
            }

            if (textParts.length > 0) {
              return `Assistant: ${textParts.join("\n")}`;
            }
          }
          break;
        }

        case "result": {
          const resultMsg = message as any;
          if (resultMsg.result && resultMsg.subtype === "tool_result") {
            return `[Tool result: ${resultMsg.tool_name}]`;
          }
          break;
        }

        default:
          // Ignore other message types
          break;
      }
    } catch (error) {
      // Silently ignore parsing errors
    }

    return null;
  }

  /**
   * Format conversation history for system prompt
   */
  static formatForSystemPrompt(messages: SDKMessage[]): string {
    const conversation = this.extractConversationFromMessages(messages);

    if (!conversation) {
      return "";
    }

    return `Previous conversation:
${conversation}

Please continue from the above conversation, maintaining context and remembering what was discussed.`;
  }

  /**
   * Extract the last assistant response from messages
   */
  static extractLastAssistantResponse(messages: SDKMessage[]): string | null {
    // Iterate from the end to find the last assistant message
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      if (message && message.type === "assistant") {
        const content = this.extractMessageContent(message);
        if (content) {
          // Remove "Assistant: " prefix
          return content.replace(/^Assistant:\s*/, "");
        }
      }
    }

    return null;
  }

  /**
   * Extract tool usage summary from messages
   */
  static extractToolUsageSummary(messages: SDKMessage[]): string[] {
    const toolsUsed: string[] = [];

    for (const message of messages) {
      if (message.type === "assistant") {
        const assistantMsg = message as any;
        if (assistantMsg.message?.content && Array.isArray(assistantMsg.message.content)) {
          for (const content of assistantMsg.message.content) {
            if (content.type === "tool_use" && content.name) {
              if (!toolsUsed.includes(content.name)) {
                toolsUsed.push(content.name);
              }
            }
          }
        }
      }
    }

    return toolsUsed;
  }
}

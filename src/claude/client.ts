import Anthropic from "@anthropic-ai/sdk";
import { logger } from "../utils/logger";
import { config } from "../config";

export class ClaudeClient {
  private client: Anthropic;

  constructor() {
    if (!config.claude.apiKey) {
      throw new Error("CLAUDE_API_KEY environment variable is required");
    }

    this.client = new Anthropic({
      apiKey: config.claude.apiKey,
    });
  }

  async sendMessage(message: string, systemPrompt?: string): Promise<string> {
    try {
      logger.debug("Sending message to Claude API", {
        messageLength: message.length,
        hasSystemPrompt: !!systemPrompt,
      });

      const response = await this.client.messages.create({
        model: "claude-3-opus-20240229",
        messages: [
          {
            role: "user",
            content: message,
          },
        ],
        ...(systemPrompt && { system: systemPrompt }),
        max_tokens: 4096,
      });

      // Extract text from the response
      const textContent = response.content
        .filter((content) => content.type === "text")
        .map((content) => (content as { text: string }).text)
        .join("\n");

      logger.debug("Received response from Claude API", {
        responseLength: textContent.length,
        stopReason: response.stop_reason,
        usage: response.usage,
      });

      return textContent;
    } catch (error) {
      logger.error("Error calling Claude API", { error });
      throw error;
    }
  }
}

import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { query } from "@anthropic-ai/claude-agent-sdk";
import type {
  ClaudeCodeStrategy,
  ExecutionMode,
  QueryOptions,
} from "./claude-code-strategy.interface";
import { logger } from "../../utils/logger";

export class ApiKeyStrategy implements ClaudeCodeStrategy {
  constructor(private apiKey: string) {
    if (!apiKey) {
      throw new Error("API key is required for ApiKeyStrategy");
    }
  }

  async *executeQuery(options: QueryOptions): AsyncIterable<SDKMessage> {
    // Store original environment variables
    const originalApiKey = process.env.CLAUDE_API_KEY;
    const originalBedrockMode = process.env.CLAUDE_CODE_USE_BEDROCK;

    try {
      // Set API key in environment
      process.env.CLAUDE_API_KEY = this.apiKey;

      // Explicitly disable Bedrock mode
      delete process.env.CLAUDE_CODE_USE_BEDROCK;

      logger.debug("Executing query with API key strategy", {
        hasApiKey: !!this.apiKey,
        mode: this.getExecutionMode(),
      });

      // Execute query
      for await (const message of query(options)) {
        yield message;
      }
    } finally {
      // Restore original environment variables
      if (originalApiKey !== undefined) {
        process.env.CLAUDE_API_KEY = originalApiKey;
      } else {
        delete process.env.CLAUDE_API_KEY;
      }

      if (originalBedrockMode !== undefined) {
        process.env.CLAUDE_CODE_USE_BEDROCK = originalBedrockMode;
      }
    }
  }

  getModelName(): string {
    // Default model for API key mode
    return "claude-opus-4-20250514";
  }

  isAvailable(): boolean {
    return !!this.apiKey;
  }

  getExecutionMode(): ExecutionMode {
    return "api-key";
  }
}

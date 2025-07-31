import type { SDKMessage } from "@anthropic-ai/claude-code";
import { query } from "@anthropic-ai/claude-code";
import type {
  ClaudeCodeStrategy,
  ExecutionMode,
  QueryOptions,
} from "./claude-code-strategy.interface";
import { logger } from "../../utils/logger";
import { BedrockRegionError, BedrockAuthError } from "../errors";

export class BedrockStrategy implements ClaudeCodeStrategy {
  constructor(
    private awsAccessKeyId: string,
    private awsSecretAccessKey: string,
    private awsRegion: string,
    private modelId?: string,
  ) {
    if (!awsAccessKeyId || !awsSecretAccessKey || !awsRegion) {
      throw new Error(
        "AWS credentials (access key, secret key, and region) are required for BedrockStrategy",
      );
    }

    // Validate region - Claude models are only available in us-east-1
    if (awsRegion !== "us-east-1") {
      throw new BedrockRegionError(awsRegion);
    }
  }

  async *executeQuery(options: QueryOptions): AsyncIterable<SDKMessage> {
    // Store original environment variables
    const originalEnv = {
      CLAUDE_CODE_USE_BEDROCK: process.env.CLAUDE_CODE_USE_BEDROCK,
      AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
      AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
      AWS_REGION: process.env.AWS_REGION,
      CLAUDE_API_KEY: process.env.CLAUDE_API_KEY,
    };

    try {
      // Enable Bedrock mode
      process.env.CLAUDE_CODE_USE_BEDROCK = "1";
      process.env.AWS_ACCESS_KEY_ID = this.awsAccessKeyId;
      process.env.AWS_SECRET_ACCESS_KEY = this.awsSecretAccessKey;
      process.env.AWS_REGION = this.awsRegion;

      // Remove API key (not needed for Bedrock mode)
      delete process.env.CLAUDE_API_KEY;

      logger.debug("Executing query with Bedrock strategy", {
        region: this.awsRegion,
        mode: this.getExecutionMode(),
      });

      // Execute query
      for await (const message of query(options)) {
        yield message;
      }
    } catch (error) {
      // Enhance error messages for common Bedrock issues
      if (error instanceof Error) {
        if (
          error.message.includes("UnrecognizedClientException") ||
          error.message.includes("InvalidSignatureException")
        ) {
          throw new BedrockAuthError(
            "Invalid AWS credentials. Please check your access key and secret key.",
          );
        }
        if (error.message.includes("AccessDeniedException")) {
          throw new BedrockAuthError(
            "AWS credentials do not have permission to access Bedrock. Please check IAM policies.",
          );
        }
      }
      throw error;
    } finally {
      // Restore original environment variables
      Object.entries(originalEnv).forEach(([key, value]) => {
        if (value !== undefined) {
          process.env[key] = value;
        } else {
          delete process.env[key];
        }
      });
    }
  }

  getModelName(): string {
    // Use model ID from environment variable or default
    return this.modelId || "us.anthropic.claude-opus-4-20250514-v1:0";
  }

  isAvailable(): boolean {
    return !!(this.awsAccessKeyId && this.awsSecretAccessKey && this.awsRegion);
  }

  getExecutionMode(): ExecutionMode {
    return "bedrock";
  }
}

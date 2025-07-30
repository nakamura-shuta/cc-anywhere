import type { ClaudeCodeStrategy, ExecutionMode } from "./strategies";
import { ApiKeyStrategy, BedrockStrategy } from "./strategies";
import { ClaudeCodeClient } from "./claude-code-client";
import { config } from "../config";
import { logger } from "../utils/logger";

export interface FactoryConfig {
  claudeApiKey?: string;
  awsAccessKeyId?: string;
  awsSecretAccessKey?: string;
  awsRegion?: string;
  forceExecutionMode?: ExecutionMode;
}

export class ClaudeCodeClientFactory {
  /**
   * Create a new ClaudeCodeClient instance
   * @param factoryConfig Optional configuration overrides
   * @returns ClaudeCodeClient instance
   */
  static create(factoryConfig?: FactoryConfig): ClaudeCodeClient {
    const mergedConfig = {
      ...config,
      claude: {
        ...config.claude,
        apiKey: factoryConfig?.claudeApiKey || config.claude.apiKey,
      },
      aws: {
        accessKeyId: factoryConfig?.awsAccessKeyId || config.aws?.accessKeyId,
        secretAccessKey: factoryConfig?.awsSecretAccessKey || config.aws?.secretAccessKey,
        region: factoryConfig?.awsRegion || config.aws?.region,
      },
      forceExecutionMode: factoryConfig?.forceExecutionMode || config.forceExecutionMode,
    };

    return new ClaudeCodeClient(mergedConfig);
  }

  /**
   * Create a strategy based on execution mode
   * @param mode Execution mode
   * @param factoryConfig Configuration for the strategy
   * @returns ClaudeCodeStrategy implementation
   */
  static createStrategy(mode: ExecutionMode, factoryConfig?: FactoryConfig): ClaudeCodeStrategy {
    logger.debug("Creating strategy", { mode });

    switch (mode) {
      case "api-key": {
        const apiKey = factoryConfig?.claudeApiKey || config.claude.apiKey;
        if (!apiKey) {
          throw new Error("API key is required for api-key mode");
        }
        return new ApiKeyStrategy(apiKey);
      }

      case "bedrock": {
        const accessKeyId = factoryConfig?.awsAccessKeyId || config.aws?.accessKeyId;
        const secretAccessKey = factoryConfig?.awsSecretAccessKey || config.aws?.secretAccessKey;
        const region = factoryConfig?.awsRegion || config.aws?.region || "us-east-1";

        if (!accessKeyId || !secretAccessKey) {
          throw new Error(
            "AWS credentials (access key and secret key) are required for bedrock mode",
          );
        }

        return new BedrockStrategy(accessKeyId, secretAccessKey, region);
      }

      default:
        throw new Error(`Unknown execution mode: ${mode}`);
    }
  }

  /**
   * Determine the best execution mode based on available credentials
   * @param factoryConfig Configuration to check
   * @returns Determined execution mode
   */
  static determineExecutionMode(factoryConfig?: FactoryConfig): ExecutionMode {
    const mergedConfig = {
      claudeApiKey: factoryConfig?.claudeApiKey || config.claude.apiKey,
      awsAccessKeyId: factoryConfig?.awsAccessKeyId || config.aws?.accessKeyId,
      awsSecretAccessKey: factoryConfig?.awsSecretAccessKey || config.aws?.secretAccessKey,
      awsRegion: factoryConfig?.awsRegion || config.aws?.region,
      forceExecutionMode: factoryConfig?.forceExecutionMode || config.forceExecutionMode,
    };

    // If execution mode is forced, use it
    if (mergedConfig.forceExecutionMode) {
      logger.info("Using forced execution mode", { mode: mergedConfig.forceExecutionMode });
      return mergedConfig.forceExecutionMode;
    }

    // API key takes priority
    if (mergedConfig.claudeApiKey) {
      logger.info("API key detected, using api-key mode");
      return "api-key";
    }

    // Check for Bedrock credentials
    if (mergedConfig.awsAccessKeyId && mergedConfig.awsSecretAccessKey) {
      logger.info("AWS credentials detected, using bedrock mode");
      return "bedrock";
    }

    throw new Error(
      "No valid credentials found for Claude Code execution. Please provide either CLAUDE_API_KEY or AWS credentials (AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY).",
    );
  }
}

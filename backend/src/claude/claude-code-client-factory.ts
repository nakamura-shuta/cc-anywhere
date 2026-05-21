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
        // Access keys are optional — when both are omitted, the AWS SDK default
        // credential chain (SSO / instance profile / AWS_PROFILE) is used.
        // But supplying ONE without the other is a configuration mistake: the SDK
        // sees it as incomplete static credentials and refuses to fall through.
        const accessKeyId = factoryConfig?.awsAccessKeyId || config.aws?.accessKeyId;
        const secretAccessKey = factoryConfig?.awsSecretAccessKey || config.aws?.secretAccessKey;
        if (!!accessKeyId !== !!secretAccessKey) {
          throw new Error(
            "Incomplete AWS credentials: set BOTH AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY, " +
              "or leave both unset to use the default credential chain (SSO / AWS_PROFILE).",
          );
        }
        const region =
          factoryConfig?.awsRegion ||
          config.aws?.region ||
          process.env.AWS_REGION ||
          process.env.AWS_DEFAULT_REGION ||
          "us-east-1";

        const modelId = config.bedrockModelId;
        return new BedrockStrategy(accessKeyId, secretAccessKey, region, modelId);
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

    // Bedrock auto-detect: only trigger on signals that actually carry / locate credentials.
    // - explicit access key + secret key pair (BOTH)
    // - AWS_PROFILE (resolves SSO / instance / .aws/credentials chain by name)
    // - AWS_BEARER_TOKEN_BEDROCK (Bedrock-specific bearer auth)
    // AWS_REGION / AWS_DEFAULT_REGION / AWS_SESSION_TOKEN alone are NOT credentials and
    // can be set in shells unrelated to AWS auth — relying on them produces false positives.
    // Default profile / instance profile users should opt in via FORCE_EXECUTION_MODE=bedrock.
    const hasExplicitAwsKeys = !!mergedConfig.awsAccessKeyId && !!mergedConfig.awsSecretAccessKey;
    const hasAwsContext = !!process.env.AWS_PROFILE || !!process.env.AWS_BEARER_TOKEN_BEDROCK;
    if (hasExplicitAwsKeys || hasAwsContext) {
      logger.info("AWS context detected, using bedrock mode", {
        hasExplicitAwsKeys,
        hasAwsProfile: !!process.env.AWS_PROFILE,
        hasBearerToken: !!process.env.AWS_BEARER_TOKEN_BEDROCK,
      });
      return "bedrock";
    }

    throw new Error(
      "No valid credentials found for Claude Code execution. Please set CLAUDE_API_KEY, " +
        "or for Bedrock: explicit AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY, AWS_PROFILE, " +
        "or AWS_BEARER_TOKEN_BEDROCK. For default profile / instance profile auth, set " +
        "FORCE_EXECUTION_MODE=bedrock explicitly.",
    );
  }
}

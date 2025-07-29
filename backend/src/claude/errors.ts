/**
 * Base error class for Bedrock-specific errors
 */
export class BedrockError extends Error {
  constructor(
    message: string,
    public code: string,
    public region?: string,
  ) {
    super(message);
    this.name = "BedrockError";
  }
}

/**
 * Error thrown when an unsupported region is used for Bedrock
 */
export class BedrockRegionError extends BedrockError {
  constructor(region: string) {
    super(
      `Region '${region}' is not supported for Claude models. Please use us-east-1.`,
      "UNSUPPORTED_REGION",
      region,
    );
    this.name = "BedrockRegionError";
  }
}

/**
 * Error thrown for Bedrock authentication issues
 */
export class BedrockAuthError extends BedrockError {
  constructor(message: string) {
    super(message, "AUTH_ERROR");
    this.name = "BedrockAuthError";
  }
}

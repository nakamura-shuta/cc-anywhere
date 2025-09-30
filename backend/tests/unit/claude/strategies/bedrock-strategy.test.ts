import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { BedrockStrategy } from "../../../../src/claude/strategies/bedrock-strategy";
import { BedrockRegionError, BedrockAuthError } from "../../../../src/claude/errors";
import { query } from "@anthropic-ai/claude-agent-sdk";

// Mock the Claude Code SDK
vi.mock("@anthropic-ai/claude-agent-sdk", () => ({
  query: vi.fn(),
}));

// Mock logger
vi.mock("../../../../src/utils/logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("BedrockStrategy", () => {
  let originalEnv: Record<string, string | undefined>;

  beforeEach(() => {
    // Save original environment variables
    originalEnv = {
      CLAUDE_CODE_USE_BEDROCK: process.env.CLAUDE_CODE_USE_BEDROCK,
      AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
      AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
      AWS_REGION: process.env.AWS_REGION,
      CLAUDE_API_KEY: process.env.CLAUDE_API_KEY,
    };
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore original environment variables
    Object.entries(originalEnv).forEach(([key, value]) => {
      if (value !== undefined) {
        process.env[key] = value;
      } else {
        delete process.env[key];
      }
    });
  });

  describe("constructor", () => {
    it("should create strategy with valid AWS credentials", () => {
      const strategy = new BedrockStrategy("test-access-key", "test-secret-key", "us-east-1");
      expect(strategy).toBeDefined();
      expect(strategy.getExecutionMode()).toBe("bedrock");
    });

    it("should throw error if AWS access key is missing", () => {
      expect(() => new BedrockStrategy("", "test-secret-key", "us-east-1")).toThrow(
        "AWS credentials (access key, secret key, and region) are required for BedrockStrategy",
      );
    });

    it("should throw error if AWS secret key is missing", () => {
      expect(() => new BedrockStrategy("test-access-key", "", "us-east-1")).toThrow(
        "AWS credentials (access key, secret key, and region) are required for BedrockStrategy",
      );
    });

    it("should throw error if AWS region is missing", () => {
      expect(() => new BedrockStrategy("test-access-key", "test-secret-key", "")).toThrow(
        "AWS credentials (access key, secret key, and region) are required for BedrockStrategy",
      );
    });

    it("should throw BedrockRegionError for unsupported regions", () => {
      expect(() => new BedrockStrategy("test-access-key", "test-secret-key", "eu-west-1")).toThrow(
        BedrockRegionError,
      );

      try {
        new BedrockStrategy("test-access-key", "test-secret-key", "eu-west-1");
      } catch (error) {
        expect(error).toBeInstanceOf(BedrockRegionError);
        expect((error as BedrockRegionError).message).toBe(
          "Region 'eu-west-1' is not supported for Claude models. Please use us-east-1.",
        );
        expect((error as BedrockRegionError).code).toBe("UNSUPPORTED_REGION");
        expect((error as BedrockRegionError).region).toBe("eu-west-1");
      }
    });

    it("should accept us-east-1 as the valid region", () => {
      expect(
        () => new BedrockStrategy("test-access-key", "test-secret-key", "us-east-1"),
      ).not.toThrow();
    });
  });

  describe("executeQuery", () => {
    it("should set Bedrock environment variables and execute query", async () => {
      const strategy = new BedrockStrategy("test-access-key", "test-secret-key", "us-east-1");
      const mockMessages = [
        { type: "init", message: "Starting" },
        { type: "assistant", message: "Hello from Bedrock" },
        { type: "result", message: "Done" },
      ];

      // Mock the query function to return an async generator
      const mockQuery = vi.mocked(query);
      mockQuery.mockImplementation(async function* () {
        // Verify environment is set correctly during execution
        expect(process.env.CLAUDE_CODE_USE_BEDROCK).toBe("1");
        expect(process.env.AWS_ACCESS_KEY_ID).toBe("test-access-key");
        expect(process.env.AWS_SECRET_ACCESS_KEY).toBe("test-secret-key");
        expect(process.env.AWS_REGION).toBe("us-east-1");
        expect(process.env.CLAUDE_API_KEY).toBeUndefined();

        for (const msg of mockMessages) {
          yield msg as any;
        }
      });

      const options = { prompt: "test prompt", options: {} };
      const messages = [];

      for await (const message of strategy.executeQuery(options)) {
        messages.push(message);
      }

      expect(messages).toHaveLength(3);
      expect(mockQuery).toHaveBeenCalledWith(options);
    });

    it("should restore original environment variables after execution", async () => {
      const strategy = new BedrockStrategy("test-access-key", "test-secret-key", "us-east-1");

      // Set some original values
      process.env.CLAUDE_CODE_USE_BEDROCK = "0";
      process.env.AWS_ACCESS_KEY_ID = "original-access-key";
      process.env.AWS_SECRET_ACCESS_KEY = "original-secret-key";
      process.env.AWS_REGION = "ap-northeast-1";
      process.env.CLAUDE_API_KEY = "original-api-key";

      const mockQuery = vi.mocked(query);
      mockQuery.mockImplementation(async function* () {
        yield { type: "result", message: "Done" } as any;
      });

      const options = { prompt: "test prompt", options: {} };

      // Execute query to verify environment setup
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _message of strategy.executeQuery(options)) {
        // Process message
      }

      // All environment variables should be restored
      expect(process.env.CLAUDE_CODE_USE_BEDROCK).toBe("0");
      expect(process.env.AWS_ACCESS_KEY_ID).toBe("original-access-key");
      expect(process.env.AWS_SECRET_ACCESS_KEY).toBe("original-secret-key");
      expect(process.env.AWS_REGION).toBe("ap-northeast-1");
      expect(process.env.CLAUDE_API_KEY).toBe("original-api-key");
    });

    it("should handle UnrecognizedClientException and throw BedrockAuthError", async () => {
      const strategy = new BedrockStrategy("test-access-key", "test-secret-key", "us-east-1");

      const mockQuery = vi.mocked(query);
      mockQuery.mockImplementation(async function* () {
        throw new Error(
          "UnrecognizedClientException: The security token included in the request is invalid.",
        );
      });

      const options = { prompt: "test prompt", options: {} };

      await expect(async () => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for await (const _message of strategy.executeQuery(options)) {
          // Should not reach here
        }
      }).rejects.toThrow(BedrockAuthError);

      try {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for await (const _message of strategy.executeQuery(options)) {
          // Should not reach here
        }
      } catch (error) {
        expect(error).toBeInstanceOf(BedrockAuthError);
        expect((error as BedrockAuthError).message).toBe(
          "Invalid AWS credentials. Please check your access key and secret key.",
        );
        expect((error as BedrockAuthError).code).toBe("AUTH_ERROR");
      }
    });

    it("should handle InvalidSignatureException and throw BedrockAuthError", async () => {
      const strategy = new BedrockStrategy("test-access-key", "test-secret-key", "us-east-1");

      const mockQuery = vi.mocked(query);
      mockQuery.mockImplementation(async function* () {
        throw new Error("InvalidSignatureException: Signature not yet current");
      });

      const options = { prompt: "test prompt", options: {} };

      await expect(async () => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for await (const _message of strategy.executeQuery(options)) {
          // Should not reach here
        }
      }).rejects.toThrow(BedrockAuthError);
    });

    it("should handle AccessDeniedException and throw BedrockAuthError", async () => {
      const strategy = new BedrockStrategy("test-access-key", "test-secret-key", "us-east-1");

      const mockQuery = vi.mocked(query);
      mockQuery.mockImplementation(async function* () {
        throw new Error(
          "AccessDeniedException: User is not authorized to perform bedrock:InvokeModel",
        );
      });

      const options = { prompt: "test prompt", options: {} };

      try {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for await (const _message of strategy.executeQuery(options)) {
          // Should not reach here
        }
      } catch (error) {
        expect(error).toBeInstanceOf(BedrockAuthError);
        expect((error as BedrockAuthError).message).toBe(
          "AWS credentials do not have permission to access Bedrock. Please check IAM policies.",
        );
      }
    });

    it("should propagate other errors without modification", async () => {
      const strategy = new BedrockStrategy("test-access-key", "test-secret-key", "us-east-1");

      const mockQuery = vi.mocked(query);
      const originalError = new Error("Some other error");
      mockQuery.mockImplementation(async function* () {
        throw originalError;
      });

      const options = { prompt: "test prompt", options: {} };

      await expect(async () => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for await (const _message of strategy.executeQuery(options)) {
          // Should not reach here
        }
      }).rejects.toThrow(originalError);
    });

    it("should restore environment variables even when error occurs", async () => {
      const strategy = new BedrockStrategy("test-access-key", "test-secret-key", "us-east-1");

      // Set original values
      process.env.CLAUDE_API_KEY = "original-api-key";
      process.env.CLAUDE_CODE_USE_BEDROCK = "0";

      const mockQuery = vi.mocked(query);
      mockQuery.mockImplementation(async function* () {
        throw new Error("Test error");
      });

      const options = { prompt: "test prompt", options: {} };

      try {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for await (const _message of strategy.executeQuery(options)) {
          // Should not reach here
        }
      } catch (error) {
        // Expected error
      }

      // Environment should be restored
      expect(process.env.CLAUDE_API_KEY).toBe("original-api-key");
      expect(process.env.CLAUDE_CODE_USE_BEDROCK).toBe("0");
    });
  });

  describe("getModelName", () => {
    it("should return the correct Bedrock model ID", () => {
      const strategy = new BedrockStrategy("test-access-key", "test-secret-key", "us-east-1");
      expect(strategy.getModelName()).toBe("us.anthropic.claude-opus-4-20250514-v1:0");
    });
  });

  describe("isAvailable", () => {
    it("should return true when all credentials are provided", () => {
      const strategy = new BedrockStrategy("test-access-key", "test-secret-key", "us-east-1");
      expect(strategy.isAvailable()).toBe(true);
    });
  });

  describe("getExecutionMode", () => {
    it("should return 'bedrock'", () => {
      const strategy = new BedrockStrategy("test-access-key", "test-secret-key", "us-east-1");
      expect(strategy.getExecutionMode()).toBe("bedrock");
    });
  });
});

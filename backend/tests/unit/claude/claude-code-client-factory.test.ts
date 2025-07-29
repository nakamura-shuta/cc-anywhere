import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { FactoryConfig } from "../../../src/claude/claude-code-client-factory";
import { ClaudeCodeClientFactory } from "../../../src/claude/claude-code-client-factory";
import { ApiKeyStrategy, BedrockStrategy } from "../../../src/claude/strategies";
import { ClaudeCodeClient } from "../../../src/claude/claude-code-client";
import { config } from "../../../src/config";

// Mock dependencies
vi.mock("../../../src/claude/claude-code-client");
vi.mock("../../../src/config", () => ({
  config: {
    claude: {
      apiKey: "default-api-key",
    },
    aws: {
      accessKeyId: "",
      secretAccessKey: "",
      region: "",
    },
    forceExecutionMode: undefined,
  },
}));

// Mock logger
vi.mock("../../../src/utils/logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("ClaudeCodeClientFactory", () => {
  let originalEnv: Record<string, string | undefined>;

  beforeEach(() => {
    // Save original environment variables
    originalEnv = {
      CLAUDE_API_KEY: process.env.CLAUDE_API_KEY,
      AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
      AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
      AWS_REGION: process.env.AWS_REGION,
      FORCE_EXECUTION_MODE: process.env.FORCE_EXECUTION_MODE,
    };
    vi.clearAllMocks();

    // Reset config
    vi.mocked(config).claude.apiKey = "default-api-key";
    vi.mocked(config).aws = {
      accessKeyId: "",
      secretAccessKey: "",
      region: "",
    };
    vi.mocked(config).forceExecutionMode = undefined;
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

  describe("create", () => {
    it("should create ClaudeCodeClient with default config", () => {
      // Create client to verify constructor arguments
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _client = ClaudeCodeClientFactory.create();

      expect(ClaudeCodeClient).toHaveBeenCalledWith({
        claude: {
          apiKey: "default-api-key",
        },
        aws: {
          accessKeyId: "",
          secretAccessKey: "",
          region: "",
        },
        forceExecutionMode: undefined,
      });
    });

    it("should create ClaudeCodeClient with factory config overrides", () => {
      const factoryConfig: FactoryConfig = {
        claudeApiKey: "override-api-key",
        awsAccessKeyId: "override-access-key",
        awsSecretAccessKey: "override-secret-key",
        awsRegion: "us-east-1",
        forceExecutionMode: "bedrock",
      };

      // Create client to verify constructor arguments
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _client = ClaudeCodeClientFactory.create(factoryConfig);

      expect(ClaudeCodeClient).toHaveBeenCalledWith({
        claude: {
          apiKey: "override-api-key",
        },
        aws: {
          accessKeyId: "override-access-key",
          secretAccessKey: "override-secret-key",
          region: "us-east-1",
        },
        forceExecutionMode: "bedrock",
      });
    });

    it("should merge factory config with default config", () => {
      vi.mocked(config).aws = {
        accessKeyId: "default-access-key",
        secretAccessKey: "default-secret-key",
        region: "us-west-2",
      };

      const factoryConfig: FactoryConfig = {
        awsRegion: "us-east-1", // Only override region
      };

      // Create client to verify constructor arguments
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _client = ClaudeCodeClientFactory.create(factoryConfig);

      expect(ClaudeCodeClient).toHaveBeenCalledWith({
        claude: {
          apiKey: "default-api-key",
        },
        aws: {
          accessKeyId: "default-access-key",
          secretAccessKey: "default-secret-key",
          region: "us-east-1", // Should be overridden
        },
        forceExecutionMode: undefined,
      });
    });
  });

  describe("createStrategy", () => {
    describe("api-key mode", () => {
      it("should create ApiKeyStrategy with provided API key", () => {
        const strategy = ClaudeCodeClientFactory.createStrategy("api-key", {
          claudeApiKey: "test-api-key",
        });

        expect(strategy).toBeInstanceOf(ApiKeyStrategy);
        expect(strategy.getExecutionMode()).toBe("api-key");
      });

      it("should create ApiKeyStrategy with default API key from config", () => {
        const strategy = ClaudeCodeClientFactory.createStrategy("api-key");

        expect(strategy).toBeInstanceOf(ApiKeyStrategy);
        expect(strategy.getExecutionMode()).toBe("api-key");
      });

      it("should throw error when no API key is available", () => {
        vi.mocked(config).claude.apiKey = "";

        expect(() => ClaudeCodeClientFactory.createStrategy("api-key")).toThrow(
          "API key is required for api-key mode",
        );
      });
    });

    describe("bedrock mode", () => {
      it("should create BedrockStrategy with provided AWS credentials", () => {
        const strategy = ClaudeCodeClientFactory.createStrategy("bedrock", {
          awsAccessKeyId: "test-access-key",
          awsSecretAccessKey: "test-secret-key",
          awsRegion: "us-east-1",
        });

        expect(strategy).toBeInstanceOf(BedrockStrategy);
        expect(strategy.getExecutionMode()).toBe("bedrock");
      });

      it("should create BedrockStrategy with AWS credentials from config", () => {
        vi.mocked(config).aws = {
          accessKeyId: "config-access-key",
          secretAccessKey: "config-secret-key",
          region: "us-east-1",
        };

        const strategy = ClaudeCodeClientFactory.createStrategy("bedrock");

        expect(strategy).toBeInstanceOf(BedrockStrategy);
        expect(strategy.getExecutionMode()).toBe("bedrock");
      });

      it("should use default region us-east-1 when not specified", () => {
        const strategy = ClaudeCodeClientFactory.createStrategy("bedrock", {
          awsAccessKeyId: "test-access-key",
          awsSecretAccessKey: "test-secret-key",
        });

        expect(strategy).toBeInstanceOf(BedrockStrategy);
        expect(strategy.getModelName()).toContain("us.anthropic");
      });

      it("should throw error when AWS access key is missing", () => {
        expect(() =>
          ClaudeCodeClientFactory.createStrategy("bedrock", {
            awsSecretAccessKey: "test-secret-key",
            awsRegion: "us-east-1",
          }),
        ).toThrow("AWS credentials (access key and secret key) are required for bedrock mode");
      });

      it("should throw error when AWS secret key is missing", () => {
        expect(() =>
          ClaudeCodeClientFactory.createStrategy("bedrock", {
            awsAccessKeyId: "test-access-key",
            awsRegion: "us-east-1",
          }),
        ).toThrow("AWS credentials (access key and secret key) are required for bedrock mode");
      });
    });

    it("should throw error for unknown execution mode", () => {
      expect(() => ClaudeCodeClientFactory.createStrategy("unknown" as any)).toThrow(
        "Unknown execution mode: unknown",
      );
    });
  });

  describe("determineExecutionMode", () => {
    it("should use forced execution mode when specified", () => {
      const mode = ClaudeCodeClientFactory.determineExecutionMode({
        forceExecutionMode: "bedrock",
        claudeApiKey: "test-api-key", // Should be ignored
      });

      expect(mode).toBe("bedrock");
    });

    it("should use forced execution mode from config", () => {
      vi.mocked(config).forceExecutionMode = "api-key";
      vi.mocked(config).aws = {
        accessKeyId: "test-access-key",
        secretAccessKey: "test-secret-key",
        region: "us-east-1",
      };

      const mode = ClaudeCodeClientFactory.determineExecutionMode();

      expect(mode).toBe("api-key");
    });

    it("should prefer api-key mode when API key is available", () => {
      const mode = ClaudeCodeClientFactory.determineExecutionMode({
        claudeApiKey: "test-api-key",
        awsAccessKeyId: "test-access-key",
        awsSecretAccessKey: "test-secret-key",
      });

      expect(mode).toBe("api-key");
    });

    it("should use bedrock mode when only AWS credentials are available", () => {
      vi.mocked(config).claude.apiKey = "";

      const mode = ClaudeCodeClientFactory.determineExecutionMode({
        awsAccessKeyId: "test-access-key",
        awsSecretAccessKey: "test-secret-key",
      });

      expect(mode).toBe("bedrock");
    });

    it("should use credentials from config for mode determination", () => {
      vi.mocked(config).claude.apiKey = "";
      vi.mocked(config).aws = {
        accessKeyId: "config-access-key",
        secretAccessKey: "config-secret-key",
        region: "us-east-1",
      };

      const mode = ClaudeCodeClientFactory.determineExecutionMode();

      expect(mode).toBe("bedrock");
    });

    it("should throw error when no credentials are available", () => {
      vi.mocked(config).claude.apiKey = "";
      vi.mocked(config).aws = {
        accessKeyId: "",
        secretAccessKey: "",
        region: "",
      };

      expect(() => ClaudeCodeClientFactory.determineExecutionMode()).toThrow(
        "No valid credentials found for Claude Code execution. Please provide either CLAUDE_API_KEY or AWS credentials (AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY).",
      );
    });

    it("should throw error when only partial AWS credentials are provided", () => {
      vi.mocked(config).claude.apiKey = "";

      expect(() =>
        ClaudeCodeClientFactory.determineExecutionMode({
          awsAccessKeyId: "test-access-key",
          // Missing secret key
        }),
      ).toThrow(
        "No valid credentials found for Claude Code execution. Please provide either CLAUDE_API_KEY or AWS credentials (AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY).",
      );
    });
  });
});

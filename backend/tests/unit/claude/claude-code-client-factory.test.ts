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

      it("should reject incomplete AWS credentials (secret key only)", () => {
        expect(() =>
          ClaudeCodeClientFactory.createStrategy("bedrock", {
            awsSecretAccessKey: "test-secret-key",
            awsRegion: "us-east-1",
          }),
        ).toThrow(/Incomplete AWS credentials/);
      });

      it("should reject incomplete AWS credentials (access key only)", () => {
        expect(() =>
          ClaudeCodeClientFactory.createStrategy("bedrock", {
            awsAccessKeyId: "test-access-key",
            awsRegion: "us-east-1",
          }),
        ).toThrow(/Incomplete AWS credentials/);
      });

      it("should allow neither key (full default credential chain)", () => {
        const strategy = ClaudeCodeClientFactory.createStrategy("bedrock", {
          awsRegion: "us-east-1",
        });
        expect(strategy).toBeInstanceOf(BedrockStrategy);
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

    it("should throw error when no credentials and no AWS context are available", () => {
      vi.mocked(config).claude.apiKey = "";
      vi.mocked(config).aws = {
        accessKeyId: "",
        secretAccessKey: "",
        region: "",
      };
      // AWS env vars must also be cleared for this test to be deterministic.
      const saved = {
        AWS_PROFILE: process.env.AWS_PROFILE,
        AWS_BEARER_TOKEN_BEDROCK: process.env.AWS_BEARER_TOKEN_BEDROCK,
        AWS_SESSION_TOKEN: process.env.AWS_SESSION_TOKEN,
        AWS_REGION: process.env.AWS_REGION,
        AWS_DEFAULT_REGION: process.env.AWS_DEFAULT_REGION,
      };
      delete process.env.AWS_PROFILE;
      delete process.env.AWS_BEARER_TOKEN_BEDROCK;
      delete process.env.AWS_SESSION_TOKEN;
      delete process.env.AWS_REGION;
      delete process.env.AWS_DEFAULT_REGION;
      try {
        expect(() => ClaudeCodeClientFactory.determineExecutionMode()).toThrow(
          /No valid credentials found for Claude Code execution/,
        );
      } finally {
        Object.entries(saved).forEach(([k, v]) => {
          if (v !== undefined) process.env[k] = v;
        });
      }
    });

    it("should pick bedrock mode when AWS_PROFILE is set (SSO/default credential chain)", () => {
      vi.mocked(config).claude.apiKey = "";
      vi.mocked(config).aws = { accessKeyId: "", secretAccessKey: "", region: "" };
      const prev = process.env.AWS_PROFILE;
      process.env.AWS_PROFILE = "dev";
      try {
        const mode = ClaudeCodeClientFactory.determineExecutionMode();
        expect(mode).toBe("bedrock");
      } finally {
        if (prev !== undefined) process.env.AWS_PROFILE = prev;
        else delete process.env.AWS_PROFILE;
      }
    });

    it("should NOT auto-detect bedrock from AWS_REGION alone", () => {
      vi.mocked(config).claude.apiKey = "";
      vi.mocked(config).aws = { accessKeyId: "", secretAccessKey: "", region: "" };
      const saved = {
        AWS_PROFILE: process.env.AWS_PROFILE,
        AWS_BEARER_TOKEN_BEDROCK: process.env.AWS_BEARER_TOKEN_BEDROCK,
        AWS_REGION: process.env.AWS_REGION,
      };
      delete process.env.AWS_PROFILE;
      delete process.env.AWS_BEARER_TOKEN_BEDROCK;
      process.env.AWS_REGION = "us-east-1";
      try {
        expect(() => ClaudeCodeClientFactory.determineExecutionMode()).toThrow(
          /No valid credentials found/,
        );
      } finally {
        Object.entries(saved).forEach(([k, v]) => {
          if (v !== undefined) process.env[k] = v;
          else delete process.env[k];
        });
      }
    });

    it("should NOT auto-detect bedrock from AWS_SESSION_TOKEN alone", () => {
      vi.mocked(config).claude.apiKey = "";
      vi.mocked(config).aws = { accessKeyId: "", secretAccessKey: "", region: "" };
      const saved = {
        AWS_PROFILE: process.env.AWS_PROFILE,
        AWS_BEARER_TOKEN_BEDROCK: process.env.AWS_BEARER_TOKEN_BEDROCK,
        AWS_SESSION_TOKEN: process.env.AWS_SESSION_TOKEN,
        AWS_REGION: process.env.AWS_REGION,
      };
      delete process.env.AWS_PROFILE;
      delete process.env.AWS_BEARER_TOKEN_BEDROCK;
      delete process.env.AWS_REGION;
      process.env.AWS_SESSION_TOKEN = "AQoDYXdzE...";
      try {
        expect(() => ClaudeCodeClientFactory.determineExecutionMode()).toThrow(
          /No valid credentials found/,
        );
      } finally {
        Object.entries(saved).forEach(([k, v]) => {
          if (v !== undefined) process.env[k] = v;
          else delete process.env[k];
        });
      }
    });

    it("should pick bedrock when AWS_BEARER_TOKEN_BEDROCK is set", () => {
      vi.mocked(config).claude.apiKey = "";
      vi.mocked(config).aws = { accessKeyId: "", secretAccessKey: "", region: "" };
      const prev = process.env.AWS_BEARER_TOKEN_BEDROCK;
      process.env.AWS_BEARER_TOKEN_BEDROCK = "bedrock-token";
      try {
        expect(ClaudeCodeClientFactory.determineExecutionMode()).toBe("bedrock");
      } finally {
        if (prev !== undefined) process.env.AWS_BEARER_TOKEN_BEDROCK = prev;
        else delete process.env.AWS_BEARER_TOKEN_BEDROCK;
      }
    });
  });
});

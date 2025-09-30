import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ApiKeyStrategy } from "../../../../src/claude/strategies/api-key-strategy";
import { query } from "@anthropic-ai/claude-agent-sdk";

// Mock the Claude Code SDK
vi.mock("@anthropic-ai/claude-agent-sdk", () => ({
  query: vi.fn(),
}));

describe("ApiKeyStrategy", () => {
  let originalApiKey: string | undefined;
  let originalBedrockMode: string | undefined;

  beforeEach(() => {
    // Save original environment variables
    originalApiKey = process.env.CLAUDE_API_KEY;
    originalBedrockMode = process.env.CLAUDE_CODE_USE_BEDROCK;
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore original environment variables
    if (originalApiKey !== undefined) {
      process.env.CLAUDE_API_KEY = originalApiKey;
    } else {
      delete process.env.CLAUDE_API_KEY;
    }
    if (originalBedrockMode !== undefined) {
      process.env.CLAUDE_CODE_USE_BEDROCK = originalBedrockMode;
    } else {
      delete process.env.CLAUDE_CODE_USE_BEDROCK;
    }
  });

  describe("constructor", () => {
    it("should create strategy with valid API key", () => {
      const strategy = new ApiKeyStrategy("test-api-key");
      expect(strategy).toBeDefined();
      expect(strategy.getExecutionMode()).toBe("api-key");
    });

    it("should throw error if API key is not provided", () => {
      expect(() => new ApiKeyStrategy("")).toThrow("API key is required for ApiKeyStrategy");
    });
  });

  describe("executeQuery", () => {
    it("should set API key in environment and execute query", async () => {
      const strategy = new ApiKeyStrategy("test-api-key");
      const mockMessages = [
        { type: "init", message: "Starting" },
        { type: "assistant", message: "Hello" },
        { type: "result", message: "Done" },
      ];

      // Mock the query function to return an async generator
      const mockQuery = vi.mocked(query);
      mockQuery.mockImplementation(async function* () {
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

    it("should disable Bedrock mode during execution", async () => {
      const strategy = new ApiKeyStrategy("test-api-key");
      process.env.CLAUDE_CODE_USE_BEDROCK = "1";

      const mockQuery = vi.mocked(query);
      mockQuery.mockImplementation(async function* () {
        // Check that Bedrock mode is disabled during execution
        expect(process.env.CLAUDE_CODE_USE_BEDROCK).toBeUndefined();
        yield { type: "result", message: "Done" } as any;
      });

      const options = { prompt: "test prompt", options: {} };

      // Execute query to verify environment setup
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _message of strategy.executeQuery(options)) {
        // Process message
      }

      // Bedrock mode should be restored
      expect(process.env.CLAUDE_CODE_USE_BEDROCK).toBe("1");
    });

    it("should restore original environment variables after execution", async () => {
      const strategy = new ApiKeyStrategy("test-api-key");
      const originalKey = "original-key";
      process.env.CLAUDE_API_KEY = originalKey;

      const mockQuery = vi.mocked(query);
      mockQuery.mockImplementation(async function* () {
        // Check that API key is set to strategy key during execution
        expect(process.env.CLAUDE_API_KEY).toBe("test-api-key");
        yield { type: "result", message: "Done" } as any;
      });

      const options = { prompt: "test prompt", options: {} };

      // Execute query to verify environment setup
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _message of strategy.executeQuery(options)) {
        // Process message
      }

      // Original API key should be restored
      expect(process.env.CLAUDE_API_KEY).toBe(originalKey);
    });
  });

  describe("getModelName", () => {
    it("should return the correct model name", () => {
      const strategy = new ApiKeyStrategy("test-api-key");
      expect(strategy.getModelName()).toBe("claude-opus-4-20250514");
    });
  });

  describe("isAvailable", () => {
    it("should return true when API key is provided", () => {
      const strategy = new ApiKeyStrategy("test-api-key");
      expect(strategy.isAvailable()).toBe(true);
    });
  });

  describe("getExecutionMode", () => {
    it("should return 'api-key'", () => {
      const strategy = new ApiKeyStrategy("test-api-key");
      expect(strategy.getExecutionMode()).toBe("api-key");
    });
  });
});

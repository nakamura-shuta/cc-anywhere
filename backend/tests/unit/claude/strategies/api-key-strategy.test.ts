import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ApiKeyStrategy } from "../../../../src/claude/strategies/api-key-strategy";
import { query } from "@anthropic-ai/claude-agent-sdk";

function createMockQuery(messages: any[]) {
  const close = vi.fn();
  const gen = (async function* () {
    for (const msg of messages) yield msg;
  })() as AsyncGenerator<any, void> & { close: () => void };
  return Object.assign(gen, { close });
}

function createThrowingMockQuery(error: Error) {
  const close = vi.fn();
  const gen = (async function* () {
    throw error;
    // eslint-disable-next-line no-unreachable
    yield undefined;
  })() as AsyncGenerator<any, void> & { close: () => void };
  return Object.assign(gen, { close });
}

vi.mock("@anthropic-ai/claude-agent-sdk", () => ({
  query: vi.fn(),
}));

const mockQuery = vi.mocked(query);

describe("ApiKeyStrategy", () => {
  let originalApiKey: string | undefined;
  let originalBedrockMode: string | undefined;

  beforeEach(() => {
    originalApiKey = process.env.CLAUDE_API_KEY;
    originalBedrockMode = process.env.CLAUDE_CODE_USE_BEDROCK;
    vi.clearAllMocks();
  });

  afterEach(() => {
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
      expect(() => new ApiKeyStrategy("")).toThrow("API key is required");
    });
  });

  describe("executeQuery", () => {
    it("should set API key in environment and call query()", async () => {
      const strategy = new ApiKeyStrategy("test-api-key");
      const messages = [
        { type: "system", session_id: "s1" },
        { type: "assistant", message: "Hello" },
      ];
      mockQuery.mockReturnValue(createMockQuery(messages) as any);

      const collected: any[] = [];
      for await (const msg of strategy.executeQuery({ prompt: "test" })) {
        collected.push(msg);
      }

      expect(collected).toHaveLength(2);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({ prompt: "test" }),
      );
    });

    it("should call query.close() after normal completion", async () => {
      const strategy = new ApiKeyStrategy("test-api-key");
      const mockQ = createMockQuery([{ type: "assistant", message: "done" }]);
      mockQuery.mockReturnValue(mockQ as any);

      for await (const _msg of strategy.executeQuery({ prompt: "test" })) {
        // consume
      }

      expect(mockQ.close).toHaveBeenCalled();
    });

    it("should call query.close() when stream throws", async () => {
      const strategy = new ApiKeyStrategy("test-api-key");
      const mockQ = createThrowingMockQuery(new Error("stream error"));
      mockQuery.mockReturnValue(mockQ as any);

      try {
        for await (const _msg of strategy.executeQuery({ prompt: "test" })) {
          // unreachable
        }
      } catch {
        // expected
      }

      expect(mockQ.close).toHaveBeenCalled();
    });

    it("should call query.close() when signal is already aborted", async () => {
      const strategy = new ApiKeyStrategy("test-api-key");
      const mockQ = createMockQuery([]);
      mockQuery.mockReturnValue(mockQ as any);

      const controller = new AbortController();
      controller.abort();

      try {
        for await (const _msg of strategy.executeQuery({
          prompt: "test",
          abortController: controller,
        })) {
          // unreachable
        }
      } catch {
        // expected: AbortError
      }

      expect(mockQ.close).toHaveBeenCalled();
    });

    it("should restore environment variables after execution", async () => {
      process.env.CLAUDE_API_KEY = "original-key";
      process.env.CLAUDE_CODE_USE_BEDROCK = "1";

      const strategy = new ApiKeyStrategy("test-api-key");
      mockQuery.mockReturnValue(createMockQuery([]) as any);

      for await (const _msg of strategy.executeQuery({ prompt: "test" })) {
        // consume
      }

      expect(process.env.CLAUDE_API_KEY).toBe("original-key");
      expect(process.env.CLAUDE_CODE_USE_BEDROCK).toBe("1");
    });
  });

  describe("getModelName", () => {
    it("should return default model name", () => {
      const strategy = new ApiKeyStrategy("test-key");
      expect(strategy.getModelName()).toContain("claude");
    });
  });

  describe("isAvailable", () => {
    it("should return true with API key", () => {
      const strategy = new ApiKeyStrategy("test-key");
      expect(strategy.isAvailable()).toBe(true);
    });
  });
});

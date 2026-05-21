import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { BedrockStrategy } from "../../../../src/claude/strategies/bedrock-strategy";
import { BedrockRegionError } from "../../../../src/claude/errors";
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

    yield undefined;
  })() as AsyncGenerator<any, void> & { close: () => void };
  return Object.assign(gen, { close });
}

vi.mock("@anthropic-ai/claude-agent-sdk", () => ({
  query: vi.fn(),
}));

const mockQuery = vi.mocked(query);

describe("BedrockStrategy", () => {
  let originalEnv: Record<string, string | undefined>;

  beforeEach(() => {
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
    Object.entries(originalEnv).forEach(([key, value]) => {
      if (value !== undefined) process.env[key] = value;
      else delete process.env[key];
    });
  });

  describe("constructor", () => {
    it("should create strategy with valid credentials", () => {
      const strategy = new BedrockStrategy("key", "secret", "us-east-1");
      expect(strategy.getExecutionMode()).toBe("bedrock");
    });

    it("should throw for non-us-east-1 region", () => {
      expect(() => new BedrockStrategy("key", "secret", "eu-west-1")).toThrow(BedrockRegionError);
    });

    it("should allow missing access keys (default AWS credential chain is used)", () => {
      // SSO / instance profile / AWS_PROFILE は constructor では検証しない
      expect(() => new BedrockStrategy(undefined, undefined, "us-east-1")).not.toThrow();
    });

    it("should reject partial AWS credentials (access key only)", () => {
      expect(() => new BedrockStrategy("key", undefined, "us-east-1")).toThrow(
        /Incomplete AWS credentials/,
      );
    });

    it("should reject partial AWS credentials (secret key only)", () => {
      expect(() => new BedrockStrategy(undefined, "secret", "us-east-1")).toThrow(
        /Incomplete AWS credentials/,
      );
    });

    it("should throw if region is missing", () => {
      expect(() => new BedrockStrategy("key", "secret", "")).toThrow(/region/i);
    });
  });

  describe("executeQuery", () => {
    it("should set Bedrock environment and call query()", async () => {
      const strategy = new BedrockStrategy("key", "secret", "us-east-1");
      mockQuery.mockReturnValue(createMockQuery([{ type: "assistant", message: "Hello" }]) as any);

      const collected: any[] = [];
      for await (const msg of strategy.executeQuery({ prompt: "test" })) {
        collected.push(msg);
      }

      expect(collected).toHaveLength(1);
      expect(mockQuery).toHaveBeenCalledWith(expect.objectContaining({ prompt: "test" }));
    });

    it("should call query.close() after normal completion", async () => {
      const strategy = new BedrockStrategy("key", "secret", "us-east-1");
      const mockQ = createMockQuery([{ type: "assistant", message: "done" }]);
      mockQuery.mockReturnValue(mockQ as any);

      for await (const msg of strategy.executeQuery({ prompt: "test" })) {
        void msg;
      }

      expect(mockQ.close).toHaveBeenCalled();
    });

    it("should call query.close() when stream throws", async () => {
      const strategy = new BedrockStrategy("key", "secret", "us-east-1");
      const mockQ = createThrowingMockQuery(new Error("stream error"));
      mockQuery.mockReturnValue(mockQ as any);

      try {
        for await (const msg of strategy.executeQuery({ prompt: "test" })) {
          void msg;
        }
      } catch {
        // expected
      }

      expect(mockQ.close).toHaveBeenCalled();
    });

    it("should call query.close() when signal is already aborted", async () => {
      const strategy = new BedrockStrategy("key", "secret", "us-east-1");
      const mockQ = createMockQuery([]);
      mockQuery.mockReturnValue(mockQ as any);

      const controller = new AbortController();
      controller.abort();

      try {
        for await (const msg of strategy.executeQuery({
          prompt: "test",
          abortController: controller,
        })) {
          void msg;
        }
      } catch {
        // expected: AbortError
      }

      expect(mockQ.close).toHaveBeenCalled();
    });

    it("should restore environment variables after execution", async () => {
      process.env.CLAUDE_API_KEY = "original";
      const strategy = new BedrockStrategy("key", "secret", "us-east-1");
      mockQuery.mockReturnValue(createMockQuery([]) as any);

      for await (const msg of strategy.executeQuery({ prompt: "test" })) {
        void msg;
      }

      expect(process.env.CLAUDE_API_KEY).toBe("original");
    });
  });

  describe("getModelName", () => {
    it("should return default Bedrock model", () => {
      const strategy = new BedrockStrategy("key", "secret", "us-east-1");
      expect(strategy.getModelName()).toContain("anthropic");
    });
  });

  describe("isAvailable", () => {
    it("should return true with valid credentials", () => {
      const strategy = new BedrockStrategy("key", "secret", "us-east-1");
      expect(strategy.isAvailable()).toBe(true);
    });
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { BedrockStrategy } from "../../../../src/claude/strategies/bedrock-strategy";
import { BedrockRegionError } from "../../../../src/claude/errors";
import { unstable_v2_createSession } from "@anthropic-ai/claude-agent-sdk";

const mockSend = vi.fn().mockResolvedValue(undefined);

function createMockSession(messages: any[]) {
  const close = vi.fn();
  return {
    get sessionId() { return "test-session"; },
    send: mockSend,
    stream: vi.fn().mockReturnValue((async function* () {
      for (const msg of messages) yield msg;
    })()),
    close,
    [Symbol.asyncDispose]: vi.fn(async () => { close(); }),
  };
}

vi.mock("@anthropic-ai/claude-agent-sdk", () => ({
  unstable_v2_createSession: vi.fn(),
  unstable_v2_resumeSession: vi.fn(),
}));

const mockCreateSession = vi.mocked(unstable_v2_createSession);

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

    it("should throw if credentials are missing", () => {
      expect(() => new BedrockStrategy("", "secret", "us-east-1")).toThrow();
    });
  });

  describe("executeQuery", () => {
    it("should set Bedrock environment and execute V2 session", async () => {
      const strategy = new BedrockStrategy("key", "secret", "us-east-1");
      mockCreateSession.mockReturnValue(createMockSession([
        { type: "assistant", message: "Hello" },
      ]) as any);

      const collected: any[] = [];
      for await (const msg of strategy.executeQuery({ prompt: "test" })) {
        collected.push(msg);
      }

      expect(collected).toHaveLength(1);
      expect(mockCreateSession).toHaveBeenCalled();
    });

    it("should call session.close() after normal completion", async () => {
      const strategy = new BedrockStrategy("key", "secret", "us-east-1");
      const mockSession = createMockSession([
        { type: "assistant", message: "done" },
      ]);
      mockCreateSession.mockReturnValue(mockSession as any);

      for await (const _msg of strategy.executeQuery({ prompt: "test" })) {
        // consume
      }

      expect(mockSession.close).toHaveBeenCalled();
    });

    it("should call session.close() when stream throws", async () => {
      const strategy = new BedrockStrategy("key", "secret", "us-east-1");
      const close = vi.fn();
      const mockSession = {
        sessionId: "test-session",
        send: vi.fn().mockResolvedValue(undefined),
        stream: vi.fn().mockReturnValue((async function* () {
          throw new Error("stream error");
        })()),
        close,
        [Symbol.asyncDispose]: vi.fn(async () => { close(); }),
      };
      mockCreateSession.mockReturnValue(mockSession as any);

      try {
        for await (const _msg of strategy.executeQuery({ prompt: "test" })) {
          // consume
        }
      } catch {
        // expected
      }

      expect(mockSession.close).toHaveBeenCalled();
    });

    it("should call session.close() when signal is already aborted", async () => {
      const strategy = new BedrockStrategy("key", "secret", "us-east-1");
      const mockSession = createMockSession([]);
      mockCreateSession.mockReturnValue(mockSession as any);

      const controller = new AbortController();
      controller.abort();

      try {
        for await (const _msg of strategy.executeQuery({
          prompt: "test",
          abortController: controller,
        })) {
          // consume
        }
      } catch {
        // expected: AbortError
      }

      expect(mockSession.close).toHaveBeenCalled();
    });

    it("should restore environment variables after execution", async () => {
      process.env.CLAUDE_API_KEY = "original";
      const strategy = new BedrockStrategy("key", "secret", "us-east-1");
      mockCreateSession.mockReturnValue(createMockSession([]) as any);

      for await (const _msg of strategy.executeQuery({ prompt: "test" })) {
        // consume
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

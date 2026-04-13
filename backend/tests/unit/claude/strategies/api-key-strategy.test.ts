import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ApiKeyStrategy } from "../../../../src/claude/strategies/api-key-strategy";
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
    it("should set API key in environment and execute V2 session", async () => {
      const strategy = new ApiKeyStrategy("test-api-key");
      const messages = [
        { type: "system", session_id: "s1" },
        { type: "assistant", message: "Hello" },
      ];
      mockCreateSession.mockReturnValue(createMockSession(messages) as any);

      const collected: any[] = [];
      for await (const msg of strategy.executeQuery({ prompt: "test" })) {
        collected.push(msg);
      }

      expect(collected).toHaveLength(2);
      expect(mockCreateSession).toHaveBeenCalled();
      expect(mockSend).toHaveBeenCalledWith("test");
    });

    it("should call session.close() after normal completion", async () => {
      const strategy = new ApiKeyStrategy("test-api-key");
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
      const strategy = new ApiKeyStrategy("test-api-key");
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

      const collected: any[] = [];
      try {
        for await (const msg of strategy.executeQuery({ prompt: "test" })) {
          collected.push(msg);
        }
      } catch {
        // expected
      }

      expect(mockSession.close).toHaveBeenCalled();
    });

    it("should call session.close() when signal is already aborted", async () => {
      const strategy = new ApiKeyStrategy("test-api-key");
      const mockSession = createMockSession([]);
      mockCreateSession.mockReturnValue(mockSession as any);

      const controller = new AbortController();
      controller.abort();

      const collected: any[] = [];
      try {
        for await (const msg of strategy.executeQuery({
          prompt: "test",
          abortController: controller,
        })) {
          collected.push(msg);
        }
      } catch {
        // expected: AbortError
      }

      expect(mockSession.close).toHaveBeenCalled();
    });

    it("should restore environment variables after execution", async () => {
      process.env.CLAUDE_API_KEY = "original-key";
      process.env.CLAUDE_CODE_USE_BEDROCK = "1";

      const strategy = new ApiKeyStrategy("test-api-key");
      mockCreateSession.mockReturnValue(createMockSession([]) as any);

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

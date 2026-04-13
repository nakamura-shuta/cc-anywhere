import { describe, it, expect, vi, beforeEach } from "vitest";
import { ClaudeCodeClient } from "../../../src/claude/claude-code-client";
import { unstable_v2_createSession, unstable_v2_resumeSession } from "@anthropic-ai/claude-agent-sdk";

const mockSend = vi.fn().mockResolvedValue(undefined);

function createMockSession(messages: any[], opts?: { throwOnStream?: Error }) {
  const close = vi.fn();
  return {
    get sessionId() { return "test-session"; },
    send: mockSend,
    stream: vi.fn().mockReturnValue((async function* () {
      for (const msg of messages) yield msg;
      if (opts?.throwOnStream) throw opts.throwOnStream;
    })()),
    close,
    [Symbol.asyncDispose]: vi.fn(async () => { close(); }),
  };
}

vi.mock("@anthropic-ai/claude-agent-sdk", () => ({
  unstable_v2_createSession: vi.fn(),
  unstable_v2_resumeSession: vi.fn(),
}));

vi.mock("../../../src/config", () => ({
  config: {
    claude: { apiKey: "test-api-key" },
    claudeCodeSDK: { defaultMaxTurns: 3 },
  },
}));

vi.mock("../../../src/utils/logger", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

vi.mock("../../../src/services/task-tracker", () => ({
  TaskTracker: vi.fn().mockImplementation(() => ({
    recordProgress: vi.fn(),
    recordError: vi.fn(),
    recordToolUsage: vi.fn(),
    recordStatistics: vi.fn(),
    generateSummary: vi.fn().mockReturnValue({
      highlights: [],
      toolsUsed: [],
      statistics: { startTime: Date.now(), endTime: Date.now(), duration: 0, totalTurns: 0 },
    }),
  })),
}));

const mockCreateSession = vi.mocked(unstable_v2_createSession);
const mockResumeSession = vi.mocked(unstable_v2_resumeSession);

describe("ClaudeCodeClient SDK Session", () => {
  let client: ClaudeCodeClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new ClaudeCodeClient();
  });

  it("should extract session ID from SDK messages", async () => {
    const messages = [
      { type: "system", session_id: "test-session-123" },
      { type: "assistant", message: { content: [{ type: "text", text: "Hello" }] } },
      { type: "result", result: "Done", subtype: "success" },
    ];
    mockCreateSession.mockReturnValue(createMockSession(messages) as any);

    const result = await client.executeTask("Test prompt", {});

    expect(result.success).toBe(true);
    expect(result.sessionId).toBe("test-session-123");
  });

  it("should use resumeSession to resume via V2 API", async () => {
    const messages = [
      { type: "assistant", message: { content: [{ type: "text", text: "Resumed" }] } },
    ];
    mockResumeSession.mockReturnValue(createMockSession(messages) as any);

    await client.executeTask("Test prompt", {
      resumeSession: "existing-session-456",
    });

    expect(mockResumeSession).toHaveBeenCalledWith(
      "existing-session-456",
      expect.any(Object),
    );
  });

  it("should handle missing session ID gracefully", async () => {
    const messages = [
      { type: "assistant", message: { content: [{ type: "text", text: "No session" }] } },
    ];
    mockCreateSession.mockReturnValue(createMockSession(messages) as any);

    const result = await client.executeTask("Test prompt", {});

    expect(result.success).toBe(true);
    // sessionId may come from session.sessionId getter
  });

  it("should handle errors and still return session ID if available", async () => {
    const messages = [
      { type: "system", session_id: "error-session-789" },
      { type: "assistant", message: { content: [{ type: "text", text: "Starting" }] } },
    ];
    mockCreateSession.mockReturnValue(
      createMockSession(messages, { throwOnStream: new Error("Task execution failed") }) as any,
    );

    const result = await client.executeTask("Test prompt", {});

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.sessionId).toBe("error-session-789");
  });
});

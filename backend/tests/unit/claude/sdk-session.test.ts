import { describe, it, expect, vi, beforeEach } from "vitest";
import { ClaudeCodeClient } from "../../../src/claude/claude-code-client";
import { query } from "@anthropic-ai/claude-code";

// Mock the claude-code module
vi.mock("@anthropic-ai/claude-code", () => ({
  query: vi.fn(),
}));

// Mock the config
vi.mock("../../../src/config", () => ({
  config: {
    claude: {
      apiKey: "test-api-key",
    },
    claudeCodeSDK: {
      defaultMaxTurns: 3,
    },
  },
}));

// Mock the logger
vi.mock("../../../src/utils/logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock TaskTracker
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

describe("ClaudeCodeClient SDK Session", () => {
  let client: ClaudeCodeClient;
  const mockQuery = query as any;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new ClaudeCodeClient();
  });

  it("should extract session ID from SDK messages", async () => {
    const mockSessionId = "test-session-123";
    const mockMessages = [
      { type: "system", message: "Starting task" },
      {
        type: "assistant",
        message: { content: [{ type: "text", text: "Hello" }] },
        session_id: mockSessionId,
      },
      { type: "result", result: "Task completed", subtype: "success" },
    ];

    // Mock the async generator
    mockQuery.mockImplementation(async function* () {
      for (const msg of mockMessages) {
        yield msg;
      }
    });

    const result = await client.executeTask("Test prompt", {});

    expect(result.success).toBe(true);
    expect(result.sessionId).toBe(mockSessionId);
  });

  it("should pass resumeSession option to SDK", async () => {
    const mockSessionId = "existing-session-456";
    const mockMessages = [
      { type: "assistant", message: { content: [{ type: "text", text: "Resumed" }] } },
      { type: "result", result: "Task completed", subtype: "success" },
    ];

    mockQuery.mockImplementation(async function* () {
      for (const msg of mockMessages) {
        yield msg;
      }
    });

    await client.executeTask("Test prompt", {
      resumeSession: mockSessionId,
    });

    expect(mockQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          resume: mockSessionId,
        }),
      }),
    );
  });

  it("should pass continueSession option to SDK", async () => {
    const mockMessages = [
      { type: "assistant", message: { content: [{ type: "text", text: "Continued" }] } },
      { type: "result", result: "Task completed", subtype: "success" },
    ];

    mockQuery.mockImplementation(async function* () {
      for (const msg of mockMessages) {
        yield msg;
      }
    });

    await client.executeTask("Test prompt", {
      continueSession: true,
    });

    expect(mockQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          continue: true,
        }),
      }),
    );
  });

  it("should handle missing session ID gracefully", async () => {
    const mockMessages = [
      { type: "assistant", message: { content: [{ type: "text", text: "No session ID" }] } },
      { type: "result", result: "Task completed", subtype: "success" },
    ];

    mockQuery.mockImplementation(async function* () {
      for (const msg of mockMessages) {
        yield msg;
      }
    });

    const result = await client.executeTask("Test prompt", {});

    expect(result.success).toBe(true);
    expect(result.sessionId).toBeUndefined();
  });

  it("should handle errors and still return session ID if available", async () => {
    const mockSessionId = "error-session-789";
    const mockMessages = [
      {
        type: "assistant",
        message: { content: [{ type: "text", text: "Starting" }] },
        session_id: mockSessionId,
      },
      { type: "error", error: "Task failed" },
    ];

    mockQuery.mockImplementation(async function* () {
      for (const msg of mockMessages) {
        yield msg;
      }
      throw new Error("Task execution failed");
    });

    const result = await client.executeTask("Test prompt", {});

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.sessionId).toBe(mockSessionId);
  });
});

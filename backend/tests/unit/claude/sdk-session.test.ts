import { describe, it, expect, vi, beforeEach } from "vitest";
import { ClaudeCodeClient } from "../../../src/claude/claude-code-client";
import { query, getSessionMessages } from "@anthropic-ai/claude-agent-sdk";

function createMockQuery(messages: any[], opts?: { throwOnStream?: Error }) {
  const close = vi.fn();
  const gen = (async function* () {
    for (const msg of messages) yield msg;
    if (opts?.throwOnStream) throw opts.throwOnStream;
  })() as AsyncGenerator<any, void> & { close: () => void };
  return Object.assign(gen, { close });
}

vi.mock("@anthropic-ai/claude-agent-sdk", () => ({
  query: vi.fn(),
  getSessionMessages: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../../src/config", () => ({
  config: {
    claude: { apiKey: "test-api-key" },
    claudeCodeSDK: { defaultMaxTurns: 3 },
  },
}));

vi.mock("../../../src/utils/logger", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("../../../src/services/task-tracker", () => ({
  TaskTracker: vi.fn().mockImplementation(() => ({
    recordProgress: vi.fn(),
    recordError: vi.fn(),
    recordToolUsage: vi.fn(),
    recordStatistics: vi.fn(),
    updateTodos: vi.fn(),
    getStatistics: vi.fn().mockReturnValue({
      totalToolUsage: 0,
      toolUsageByType: new Map(),
    }),
    generateSummary: vi.fn().mockReturnValue({
      highlights: [],
      toolsUsed: [],
      statistics: { startTime: Date.now(), endTime: Date.now(), duration: 0, totalTurns: 0 },
    }),
  })),
}));

const mockQuery = vi.mocked(query);
const mockGetSessionMessages = vi.mocked(getSessionMessages);

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
    mockQuery.mockReturnValue(createMockQuery(messages) as any);

    const result = await client.executeTask("Test prompt", {});

    expect(result.success).toBe(true);
    expect(result.sessionId).toBe("test-session-123");
  });

  it("should pass resume option when resumeSession provided", async () => {
    const messages = [
      { type: "assistant", message: { content: [{ type: "text", text: "Resumed" }] } },
    ];
    mockQuery.mockReturnValue(createMockQuery(messages) as any);

    await client.executeTask("Test prompt", {
      resumeSession: "existing-session-456",
    });

    expect(mockQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({ resume: "existing-session-456" }),
      }),
    );
  });

  it("should handle missing session ID gracefully", async () => {
    const messages = [
      { type: "assistant", message: { content: [{ type: "text", text: "No session" }] } },
    ];
    mockQuery.mockReturnValue(createMockQuery(messages) as any);

    const result = await client.executeTask("Test prompt", {});

    expect(result.success).toBe(true);
    // sessionId may be undefined when no system/init was emitted
  });

  it("should handle errors and still return session ID if available", async () => {
    const messages = [
      { type: "system", session_id: "error-session-789" },
      { type: "assistant", message: { content: [{ type: "text", text: "Starting" }] } },
    ];
    mockQuery.mockReturnValue(
      createMockQuery(messages, { throwOnStream: new Error("Task execution failed") }) as any,
    );

    const result = await client.executeTask("Test prompt", {});

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.sessionId).toBe("error-session-789");
  });

  it("should seed TodoBridge from getSessionMessages on resume and emit initial todo_update", async () => {
    // Historical session: TaskCreate resolved to task-1, then TaskUpdate set in_progress.
    const history = [
      {
        type: "assistant",
        message: {
          content: [
            {
              type: "tool_use",
              id: "tu-1",
              name: "TaskCreate",
              input: { subject: "Refactor module" },
            },
          ],
        },
      },
      {
        type: "user",
        message: {
          content: [
            {
              type: "tool_result",
              tool_use_id: "tu-1",
              content: { task: { id: "task-1", subject: "Refactor module" } },
            },
          ],
        },
      },
      {
        type: "assistant",
        message: {
          content: [
            {
              type: "tool_use",
              id: "tu-2",
              name: "TaskUpdate",
              input: { taskId: "task-1", status: "in_progress" },
            },
          ],
        },
      },
    ];
    mockGetSessionMessages.mockResolvedValue(history as any);
    mockQuery.mockReturnValue(createMockQuery([]) as any);

    const progressEvents: Array<{ type: string; data?: any }> = [];
    await client.executeTask("Continue task", {
      resumeSession: "prior-session-id",
      onProgress: (e) => {
        progressEvents.push({ type: e.type, data: (e as any).data });
      },
    });

    expect(mockGetSessionMessages).toHaveBeenCalledWith("prior-session-id");
    const restore = progressEvents.find((e) => e.type === "todo_update");
    expect(restore).toBeDefined();
    expect(restore?.data.todos).toEqual([{ content: "Refactor module", status: "in_progress" }]);
  });

  it("should emit subagent:started / :progress / :completed for task_* system messages", async () => {
    mockQuery.mockReturnValue(
      createMockQuery([
        {
          type: "system",
          subtype: "task_started",
          task_id: "sub-1",
          tool_use_id: "tu-1",
          description: "Run tests",
          subagent_type: "test-runner",
        },
        {
          type: "system",
          subtype: "task_progress",
          task_id: "sub-1",
          tool_use_id: "tu-1",
          description: "running",
          subagent_type: "test-runner",
          last_tool_name: "Bash",
          summary: "Running vitest",
          usage: { total_tokens: 1234, tool_uses: 3, duration_ms: 500 },
        },
        {
          type: "system",
          subtype: "task_notification",
          task_id: "sub-1",
          tool_use_id: "tu-1",
          status: "completed",
          summary: "All tests passed",
          output_file: "/tmp/x",
          usage: { total_tokens: 2000, tool_uses: 5, duration_ms: 1500 },
        },
        { type: "assistant", message: { content: [{ type: "text", text: "done" }] } },
      ]) as any,
    );

    const events: Array<{ type: string; data?: any }> = [];
    await client.executeTask("Test", {
      onProgress: (e) => {
        events.push({ type: e.type, data: (e as any).data });
      },
    });

    const started = events.find((e) => e.type === "subagent:started");
    expect(started?.data).toMatchObject({
      taskId: "sub-1",
      toolUseId: "tu-1",
      description: "Run tests",
      subagentType: "test-runner",
    });

    const progress = events.find((e) => e.type === "subagent:progress");
    expect(progress?.data).toMatchObject({
      taskId: "sub-1",
      summary: "Running vitest",
      lastToolName: "Bash",
      usage: { totalTokens: 1234, toolUses: 3, durationMs: 500 },
    });

    const completed = events.find((e) => e.type === "subagent:completed");
    expect(completed?.data).toMatchObject({
      taskId: "sub-1",
      status: "completed",
      summary: "All tests passed",
      usage: { totalTokens: 2000, toolUses: 5, durationMs: 1500 },
    });
  });

  it("should emit api:retry progress when system/api_retry message is received (object error)", async () => {
    mockQuery.mockReturnValue(
      createMockQuery([
        {
          type: "system",
          subtype: "api_retry",
          attempt: 1,
          max_retries: 3,
          retry_delay_ms: 500,
          error_status: 503,
          error: { message: "Service Unavailable" },
        },
        { type: "assistant", message: { content: [{ type: "text", text: "ok" }] } },
      ]) as any,
    );

    const events: Array<{ type: string; data?: any }> = [];
    await client.executeTask("Test", {
      onProgress: (e) => {
        events.push({ type: e.type, data: (e as any).data });
      },
    });

    const retry = events.find((e) => e.type === "api:retry");
    expect(retry).toBeDefined();
    expect(retry?.data).toEqual({
      attempt: 1,
      maxRetries: 3,
      retryDelayMs: 500,
      errorStatus: 503,
      errorMessage: "Service Unavailable",
    });
  });

  it("should emit api:retry progress when error is a string (SDKAssistantMessageError)", async () => {
    mockQuery.mockReturnValue(
      createMockQuery([
        {
          type: "system",
          subtype: "api_retry",
          attempt: 2,
          max_retries: 5,
          retry_delay_ms: 1000,
          error_status: 429,
          error: "Rate limited",
        },
        { type: "assistant", message: { content: [{ type: "text", text: "ok" }] } },
      ]) as any,
    );

    const events: Array<{ type: string; data?: any }> = [];
    await client.executeTask("Test", {
      onProgress: (e) => {
        events.push({ type: e.type, data: (e as any).data });
      },
    });

    const retry = events.find((e) => e.type === "api:retry");
    expect(retry?.data).toEqual({
      attempt: 2,
      maxRetries: 5,
      retryDelayMs: 1000,
      errorStatus: 429,
      errorMessage: "Rate limited",
    });
  });

  it("should emit session:status progress when system/status message is received", async () => {
    mockQuery.mockReturnValue(
      createMockQuery([
        { type: "system", subtype: "status", status: "requesting", permissionMode: "default" },
        { type: "assistant", message: { content: [{ type: "text", text: "ok" }] } },
      ]) as any,
    );

    const events: Array<{ type: string; data?: any }> = [];
    await client.executeTask("Test", {
      onProgress: (e) => {
        events.push({ type: e.type, data: (e as any).data });
      },
    });

    const status = events.find((e) => e.type === "session:status");
    expect(status).toBeDefined();
    expect(status?.data).toMatchObject({
      status: "requesting",
      permissionMode: "default",
    });
  });

  it("should emit result:metadata progress with terminal_reason / stop_reason / api_error_status", async () => {
    mockQuery.mockReturnValue(
      createMockQuery([
        { type: "assistant", message: { content: [{ type: "text", text: "ok" }] } },
        {
          type: "result",
          subtype: "success",
          is_error: false,
          terminal_reason: "completed",
          stop_reason: "end_turn",
          api_error_status: null,
          duration_ms: 1234,
          num_turns: 2,
          errors: [],
          permission_denials: [],
        },
      ]) as any,
    );

    const events: Array<{ type: string; data?: any }> = [];
    await client.executeTask("Test", {
      onProgress: (e) => {
        events.push({ type: e.type, data: (e as any).data });
      },
    });

    const meta = events.find((e) => e.type === "result:metadata");
    expect(meta).toBeDefined();
    expect(meta?.data).toMatchObject({
      subtype: "success",
      isError: false,
      terminalReason: "completed",
      stopReason: "end_turn",
      apiErrorStatus: null,
      durationMs: 1234,
      numTurns: 2,
      permissionDenials: 0,
    });
  });

  it("should swallow getSessionMessages errors and continue without seeding", async () => {
    mockGetSessionMessages.mockRejectedValue(new Error("session not found"));
    mockQuery.mockReturnValue(
      createMockQuery([
        { type: "assistant", message: { content: [{ type: "text", text: "ok" }] } },
      ]) as any,
    );

    const progressEvents: Array<{ type: string }> = [];
    const result = await client.executeTask("Continue task", {
      resumeSession: "missing-session-id",
      onProgress: (e) => {
        progressEvents.push({ type: e.type });
      },
    });

    expect(result.success).toBe(true);
    expect(progressEvents.some((e) => e.type === "todo_update")).toBe(false);
  });
});

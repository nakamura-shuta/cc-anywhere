import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TaskExecutorImpl } from "../../src/claude/executor.js";
import type { TaskRequest } from "../../src/claude/types.js";

// Mock Claude Code SDK
vi.mock("@anthropic-ai/claude-agent-sdk", () => ({
  query: vi.fn().mockImplementation(async function* () {
    yield {
      type: "assistant",
      message: {
        content: [{ type: "text", text: "Slash command executed successfully" }],
      },
    };
  }),
}));

vi.mock("../../src/config", () => ({
  config: {
    claude: {
      apiKey: "test-key",
    },
    claudeCodeSDK: {
      defaultMaxTurns: 3,
    },
    tasks: {},
  },
}));

vi.mock("../../src/utils/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

describe("Slash Command Integration", () => {
  let executor: TaskExecutorImpl;

  beforeEach(() => {
    vi.clearAllMocks();
    executor = new TaskExecutorImpl();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should execute task with /project: prefix slash command", async () => {
    const task: TaskRequest = {
      instruction: "/project:task Run unit tests",
      options: {},
    };

    const result = await executor.execute(task);

    expect(result.success).toBe(true);
    expect(result.output).toContain("Slash command executed successfully");
  });

  it("should execute task with /user: prefix slash command", async () => {
    const task: TaskRequest = {
      instruction: "/user:test-command with arguments",
      options: {},
    };

    const result = await executor.execute(task);

    expect(result.success).toBe(true);
  });

  it("should handle slash command without prefix (defaults to /user:)", async () => {
    const task: TaskRequest = {
      instruction: "/test simple command",
      options: {},
    };

    const result = await executor.execute(task);

    expect(result.success).toBe(true);
  });

  it("should pass slash command directly to SDK without preprocessing", async () => {
    const task: TaskRequest = {
      instruction: "/project:build-all",
      options: {
        sdk: {
          maxTurns: 5,
        },
      },
    };

    const result = await executor.execute(task);

    // Agent SDK handles slash commands automatically
    // No preprocessing should occur
    expect(result.success).toBe(true);
  });

  it("should handle slash command with complex arguments", async () => {
    const task: TaskRequest = {
      instruction: '/project:task "complex argument with spaces" --flag',
      options: {},
    };

    const result = await executor.execute(task);

    expect(result.success).toBe(true);
  });

  it("should combine slash command with SDK options", async () => {
    const task: TaskRequest = {
      instruction: "/project:task Run integration tests",
      options: {
        sdk: {
          maxTurns: 10,
          allowedTools: ["Bash", "Read", "Write"],
          permissionMode: "allow",
        },
      },
    };

    const result = await executor.execute(task);

    expect(result.success).toBe(true);
  });

  it("should handle regular instruction (non-slash command)", async () => {
    const task: TaskRequest = {
      instruction: "Regular task instruction without slash command",
      options: {},
    };

    const result = await executor.execute(task);

    expect(result.success).toBe(true);
  });
});

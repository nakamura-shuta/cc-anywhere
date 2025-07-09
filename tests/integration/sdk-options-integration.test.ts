import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TaskExecutorImpl } from "../../src/claude/executor.js";
import type { TaskRequest } from "../../src/claude/types.js";

// Mock Claude Code SDK
vi.mock("@anthropic-ai/claude-code", () => ({
  query: vi.fn().mockImplementation(async function* () {
    yield {
      type: "assistant",
      message: {
        content: [{ type: "text", text: "Task completed with SDK options" }],
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
    tasks: {
      useClaudeCodeSDK: true,
    },
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

describe("SDK Options Integration", () => {
  let executor: TaskExecutorImpl;

  beforeEach(() => {
    vi.clearAllMocks();
    executor = new TaskExecutorImpl();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should execute task with SDK options", async () => {
    const task: TaskRequest = {
      instruction: "Test task with SDK options",
      options: {
        sdk: {
          maxTurns: 5,
          allowedTools: ["Read", "Write"],
          systemPrompt: "You are a helpful assistant",
          permissionMode: "allow",
          outputFormat: "text",
        },
      },
    };

    const result = await executor.execute(task);

    expect(result.success).toBe(true);
    expect(result.output).toContain("Task completed with SDK options");
  });

  it("should handle legacy allowedTools option", async () => {
    const task: TaskRequest = {
      instruction: "Test task with legacy options",
      options: {
        allowedTools: ["Read", "Write"],
      },
    };

    const result = await executor.execute(task);

    expect(result.success).toBe(true);
  });

  it("should merge SDK options with legacy options correctly", async () => {
    const task: TaskRequest = {
      instruction: "Test task with mixed options",
      options: {
        allowedTools: ["Read"],
        sdk: {
          allowedTools: ["Read", "Write", "Edit"],
          maxTurns: 10,
        },
      },
    };

    const result = await executor.execute(task);

    expect(result.success).toBe(true);
    // SDK options should take precedence
  });

  it("should validate SDK options", async () => {
    const task: TaskRequest = {
      instruction: "Test task with invalid options",
      options: {
        sdk: {
          maxTurns: 100, // Invalid: too high
        },
      },
    };

    const result = await executor.execute(task);
    expect(result.success).toBe(false);
    expect(result.error?.message).toBe("maxTurns must be between 1 and 50");
  });

  it("should handle systemPrompt validation", async () => {
    const task: TaskRequest = {
      instruction: "Test task with long system prompt",
      options: {
        sdk: {
          systemPrompt: "A".repeat(10001), // Too long
        },
      },
    };

    const result = await executor.execute(task);
    expect(result.success).toBe(false);
    expect(result.error?.message).toBe("systemPrompt must be 10000 characters or less");
  });
});

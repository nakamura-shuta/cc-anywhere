/**
 * AgentExecutorFactory unit tests
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AgentTaskRequest } from "../../../src/agents/types.js";

// Mock config
const mockConfig = {
  openai: {
    apiKey: "test-openai-key",
  },
  claude: {
    apiKey: "test-claude-key",
  },
  logging: {
    level: "debug",
  },
};

vi.mock("../../../src/config/index.js", () => ({
  config: mockConfig,
}));

// Mock executors
const mockCodexExecutor = {
  executeTask: vi.fn(),
  cancelTask: vi.fn(),
  getExecutorType: vi.fn(() => "codex"),
  isAvailable: vi.fn(() => true),
};

const mockClaudeExecutor = {
  executeTask: vi.fn(),
  cancelTask: vi.fn(),
  getExecutorType: vi.fn(() => "claude"),
  isAvailable: vi.fn(() => true),
};

// Mock executor classes
vi.mock("../../../src/agents/codex-agent-executor.js", () => ({
  CodexAgentExecutor: vi.fn(() => mockCodexExecutor),
}));

vi.mock("../../../src/agents/claude-agent-executor.js", () => ({
  ClaudeAgentExecutor: vi.fn(() => mockClaudeExecutor),
}));

// Import after mocking
const { AgentExecutorFactory } = await import("../../../src/agents/agent-executor-factory.js");

describe("AgentExecutorFactory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("create", () => {
    it("should create CodexAgentExecutor when executor is 'codex'", async () => {
      const request: AgentTaskRequest = {
        instruction: "test",
        options: {
          executor: "codex",
        },
      };

      const executor = await AgentExecutorFactory.create(request);

      expect(executor.getExecutorType()).toBe("codex");
    });

    it("should create ClaudeAgentExecutor when executor is 'claude'", async () => {
      const request: AgentTaskRequest = {
        instruction: "test",
        options: {
          executor: "claude",
        },
      };

      const executor = await AgentExecutorFactory.create(request);

      expect(executor.getExecutorType()).toBe("claude");
    });

    it("should default to ClaudeAgentExecutor when executor is not specified", async () => {
      const request: AgentTaskRequest = {
        instruction: "test",
      };

      const executor = await AgentExecutorFactory.create(request);

      expect(executor.getExecutorType()).toBe("claude");
    });

    it("should throw error for unknown executor type", async () => {
      const request: AgentTaskRequest = {
        instruction: "test",
        options: {
          executor: "unknown" as any,
        },
      };

      await expect(AgentExecutorFactory.create(request)).rejects.toThrow(
        "Unknown executor type: unknown",
      );
    });
  });

  describe("getAvailableExecutors", () => {
    it("should return available executors", async () => {
      mockCodexExecutor.isAvailable.mockReturnValue(true);
      mockClaudeExecutor.isAvailable.mockReturnValue(true);

      const available = await AgentExecutorFactory.getAvailableExecutors();

      expect(available).toContain("claude");
      expect(available).toContain("codex");
    });

    it("should exclude unavailable executors", async () => {
      // Mock Codex unavailable by removing API key
      mockConfig.openai.apiKey = undefined;
      mockClaudeExecutor.isAvailable.mockReturnValue(true);

      const available = await AgentExecutorFactory.getAvailableExecutors();

      expect(available).toContain("claude");
      expect(available).not.toContain("codex");

      // Restore API key
      mockConfig.openai.apiKey = "test-openai-key";
    });

    it("should return empty array when no executors are available", async () => {
      // Mock both unavailable
      mockConfig.openai.apiKey = undefined;
      mockClaudeExecutor.isAvailable.mockReturnValue(false);

      const available = await AgentExecutorFactory.getAvailableExecutors();

      expect(available).toEqual([]);

      // Restore API key
      mockConfig.openai.apiKey = "test-openai-key";
    });
  });
});

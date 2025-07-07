import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { TaskExecutorImpl } from "../../../../src/claude/executor";
import { WorktreeManager } from "../../../../src/services/worktree/worktree-manager";
import { config } from "../../../../src/config";
import type { TaskRequest } from "../../../../src/claude/types";
import * as fs from "fs/promises";
import { existsSync } from "fs";

// Mock modules
vi.mock("../../../../src/services/worktree/worktree-manager");
vi.mock("../../../../src/config");
vi.mock("../../../../src/claude/client");
vi.mock("../../../../src/claude/claude-code-client");
vi.mock("fs/promises");
vi.mock("fs");

describe("TaskExecutor Worktree Integration", () => {
  let executor: TaskExecutorImpl;
  let mockWorktreeManager: any;

  beforeEach(async () => {
    // Setup config mock
    vi.mocked(config).worktree = {
      enabled: true,
      basePath: ".worktrees",
      maxWorktrees: 5,
      autoCleanup: true,
      cleanupDelay: 0, // Set to 0 for immediate cleanup in tests
      prefix: "cc-anywhere",
    };

    // Mock the entire config object
    vi.mocked(config).tasks = {
      defaultTimeout: 60000,
      maxConcurrent: 10,
      useClaudeCodeSDK: true,
    };

    // Setup WorktreeManager mock
    mockWorktreeManager = {
      createWorktree: vi.fn().mockResolvedValue({
        id: "cc-anywhere-task-123",
        taskId: "task-123",
        path: "/repos/test/.worktrees/cc-anywhere-task-123",
        branch: "cc-anywhere/task-123",
        baseBranch: "main",
        repository: "/repos/test",
        createdAt: new Date(),
        status: "active",
      }),
      removeWorktree: vi.fn().mockResolvedValue(true),
      isWorktreeHealthy: vi.fn().mockResolvedValue(true),
    };

    vi.mocked(WorktreeManager).mockImplementation(() => mockWorktreeManager);

    // Setup fs mock
    vi.mocked(fs.access).mockResolvedValue(undefined);

    // Mock fs.existsSync to return true for worktree paths
    vi.mocked(existsSync).mockReturnValue(true);

    // Setup Claude SDK mocks
    const { ClaudeClient } = await import("../../../../src/claude/client");
    const { ClaudeCodeClient } = await import("../../../../src/claude/claude-code-client");
    const mockClaudeClient = vi.mocked(ClaudeClient);
    const mockClaudeCodeClient = vi.mocked(ClaudeCodeClient);

    mockClaudeClient.prototype.query = vi.fn().mockResolvedValue({
      role: "assistant",
      content: "Test response",
    });

    mockClaudeCodeClient.prototype.executeTask = vi.fn().mockResolvedValue({
      success: true,
      messages: [{ role: "assistant", content: "Test response" }],
    });

    mockClaudeCodeClient.prototype.formatMessagesAsString = vi
      .fn()
      .mockReturnValue("Test response");

    executor = new TaskExecutorImpl(true);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Worktree Creation", () => {
    it("worktreeが有効な場合、タスク実行前にworktreeを作成する", async () => {
      const task: TaskRequest = {
        instruction: "Test task",
        context: {
          workingDirectory: "/repos/test",
        },
        options: {
          useWorktree: true,
        },
      };

      // Execute task
      const result = await executor.execute(task, "task-123");

      // Verify worktree was created
      expect(mockWorktreeManager.createWorktree).toHaveBeenCalledWith({
        taskId: "task-123",
        repositoryPath: "/repos/test",
        baseBranch: "master",
        branchName: undefined,
      });

      // Verify the task was executed in the worktree directory
      expect(result).toBeDefined();
    });

    it("worktreeオプションで詳細な設定を指定できる", async () => {
      const task: TaskRequest = {
        instruction: "Test task",
        context: {
          workingDirectory: "/repos/test",
        },
        options: {
          worktree: {
            enabled: true,
            baseBranch: "develop",
            branchName: "feature/test-123",
            keepAfterCompletion: true,
            autoCommit: true,
            commitMessage: "Test commit",
            autoMerge: false,
          },
        },
      };

      await executor.execute(task, "task-123");

      expect(mockWorktreeManager.createWorktree).toHaveBeenCalledWith({
        taskId: "task-123",
        repositoryPath: "/repos/test",
        baseBranch: "develop",
        branchName: "feature/test-123",
      });
    });

    it("グローバル設定が無効な場合はworktreeを作成しない", async () => {
      vi.mocked(config).worktree.enabled = false;

      const task: TaskRequest = {
        instruction: "Test task",
        context: {
          workingDirectory: "/repos/test",
        },
        options: {
          useWorktree: true,
        },
      };

      await executor.execute(task, "task-123");

      expect(mockWorktreeManager.createWorktree).not.toHaveBeenCalled();
    });

    it("workingDirectoryが指定されていない場合はworktreeを作成しない", async () => {
      const task: TaskRequest = {
        instruction: "Test task",
        options: {
          useWorktree: true,
        },
      };

      await executor.execute(task, "task-123");

      expect(mockWorktreeManager.createWorktree).not.toHaveBeenCalled();
    });
  });

  describe("Worktree Cleanup", () => {
    it("タスク完了後にworktreeをクリーンアップする", async () => {
      const task: TaskRequest = {
        instruction: "Test task",
        context: {
          workingDirectory: "/repos/test",
        },
        options: {
          useWorktree: true,
        },
      };

      await executor.execute(task, "task-123");

      // Verify cleanup was scheduled
      expect(mockWorktreeManager.removeWorktree).toHaveBeenCalledWith(
        "cc-anywhere-task-123",
        expect.objectContaining({
          force: false,
          saveUncommitted: true,
        }),
      );
    });

    it("keepAfterCompletionが指定されている場合はクリーンアップしない", async () => {
      const task: TaskRequest = {
        instruction: "Test task",
        context: {
          workingDirectory: "/repos/test",
        },
        options: {
          worktree: {
            enabled: true,
            keepAfterCompletion: true,
          },
        },
      };

      await executor.execute(task, "task-123");

      expect(mockWorktreeManager.removeWorktree).not.toHaveBeenCalled();
    });

    it("エラー時もworktreeをクリーンアップする", async () => {
      const task: TaskRequest = {
        instruction: "Test task that will fail",
        context: {
          workingDirectory: "/repos/test",
        },
        options: {
          useWorktree: true,
        },
      };

      // Make the task execution fail
      const mockCodeClient = vi.fn().mockRejectedValue(new Error("Task failed"));
      (executor as any).codeClient.executeTask = mockCodeClient;

      const result = await executor.execute(task, "task-123");

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe("Task failed");

      // Verify cleanup was still called
      expect(mockWorktreeManager.removeWorktree).toHaveBeenCalled();
    });
  });

  describe("Error Handling", () => {
    it("worktree作成に失敗した場合、エラーを返す", async () => {
      mockWorktreeManager.createWorktree.mockRejectedValue(new Error("Failed to create worktree"));

      const task: TaskRequest = {
        instruction: "Test task",
        context: {
          workingDirectory: "/repos/test",
        },
        options: {
          useWorktree: true,
        },
      };

      const result = await executor.execute(task, "task-123");

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe("Failed to create worktree");
    });

    it("worktreeのヘルスチェックに失敗した場合、エラーを返す", async () => {
      mockWorktreeManager.isWorktreeHealthy.mockResolvedValue(false);

      const task: TaskRequest = {
        instruction: "Test task",
        context: {
          workingDirectory: "/repos/test",
        },
        options: {
          useWorktree: true,
        },
      };

      const result = await executor.execute(task, "task-123");

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe("Worktree is not healthy");
    });
  });

  describe("Progress Reporting", () => {
    it("worktree操作の進捗を報告する", async () => {
      const onProgress = vi.fn();
      const task: TaskRequest = {
        instruction: "Test task",
        context: {
          workingDirectory: "/repos/test",
        },
        options: {
          useWorktree: true,
          onProgress,
        },
      };

      await executor.execute(task, "task-123");

      // Verify progress callbacks
      expect(onProgress).toHaveBeenCalledWith({
        type: "log",
        message: expect.stringContaining("Worktree"),
      });
    });
  });
});

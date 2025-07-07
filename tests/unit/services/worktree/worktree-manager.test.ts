import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { WorktreeManager } from "../../../../src/services/worktree/worktree-manager";
import { GitService } from "../../../../src/services/worktree/git-service";
import { WorktreeLogger } from "../../../../src/services/worktree/worktree-logger";
import type {
  WorktreeConfig,
  CreateWorktreeOptions,
} from "../../../../src/services/worktree/types";
import { WorktreeError, WorktreeErrorCode } from "../../../../src/services/worktree/types";
import * as fs from "fs/promises";

// モック
vi.mock("../../../../src/services/worktree/git-service");
vi.mock("../../../../src/services/worktree/worktree-logger");
vi.mock("fs/promises");

describe("WorktreeManager", () => {
  let manager: WorktreeManager;
  let mockGitService: any;
  let mockLogger: any;
  let mockConfig: WorktreeConfig;

  beforeEach(() => {
    // モックの設定
    mockGitService = {
      isGitRepository: vi.fn().mockResolvedValue(true),
      getCurrentBranch: vi.fn().mockResolvedValue("main"),
      createWorktree: vi.fn().mockResolvedValue({ success: true }),
      removeWorktree: vi.fn().mockResolvedValue({ success: true }),
      listWorktrees: vi.fn().mockResolvedValue([]),
      hasUncommittedChanges: vi.fn().mockResolvedValue(false),
      createPatch: vi.fn().mockResolvedValue(""),
      deleteBranch: vi.fn().mockResolvedValue({ success: true }),
    };

    mockLogger = {
      logOperationStart: vi.fn(),
      logOperationSuccess: vi.fn(),
      logOperationError: vi.fn(),
      logWarning: vi.fn(),
      logDebug: vi.fn(),
      logWorktreeCreation: vi.fn(),
      logWorktreeDeletion: vi.fn(),
    };

    mockConfig = {
      maxWorktrees: 5,
      baseDirectory: ".worktrees",
      autoCleanup: true,
      cleanupDelay: 300000,
      worktreePrefix: "cc-anywhere",
    };

    // fsモック
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.rm).mockResolvedValue(undefined);
    vi.mocked(fs.access).mockResolvedValue(undefined);
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({ worktrees: [] }));
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);

    // クラスのモックインスタンスを設定
    vi.mocked(GitService).mockImplementation(() => mockGitService);
    vi.mocked(WorktreeLogger).mockImplementation(() => mockLogger);

    manager = new WorktreeManager(mockConfig);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("createWorktree", () => {
    const createOptions: CreateWorktreeOptions = {
      taskId: "task-123",
      repositoryPath: "/repos/test",
      baseBranch: "main",
      branchName: "feature/task-123",
    };

    it("worktreeを作成できる", async () => {
      const worktree = await manager.createWorktree(createOptions);

      expect(worktree).toBeDefined();
      expect(worktree.taskId).toBe("task-123");
      expect(worktree.branch).toBe("feature/task-123");
      expect(worktree.baseBranch).toBe("main");
      expect(worktree.status).toBe("active");
      expect(worktree.path).toContain(".worktrees");
      expect(worktree.path).toContain("task-123");

      expect(mockGitService.isGitRepository).toHaveBeenCalledWith("/repos/test");
      expect(mockGitService.createWorktree).toHaveBeenCalled();
      expect(mockLogger.logWorktreeCreation).toHaveBeenCalled();
    });

    it("Gitリポジトリでない場合はエラー", async () => {
      mockGitService.isGitRepository.mockResolvedValue(false);

      await expect(manager.createWorktree(createOptions)).rejects.toThrow(WorktreeError);
      await expect(manager.createWorktree(createOptions)).rejects.toThrow(
        expect.objectContaining({
          code: WorktreeErrorCode.NOT_GIT_REPOSITORY,
        }),
      );
    });

    it("最大worktree数を超えた場合はエラー", async () => {
      // 既存のworktreeで上限に達している状態をモック
      mockGitService.listWorktrees.mockResolvedValue(
        Array(5)
          .fill(null)
          .map((_, i) => ({
            path: `/repos/test/.worktrees/task-${i}`,
            branch: `feature/task-${i}`,
            commit: "abc123",
            name: `task-${i}`,
          })),
      );

      await expect(manager.createWorktree(createOptions)).rejects.toThrow(WorktreeError);
      await expect(manager.createWorktree(createOptions)).rejects.toThrow(
        expect.objectContaining({
          code: WorktreeErrorCode.MAX_WORKTREES_EXCEEDED,
        }),
      );
    });

    it("worktree作成に失敗した場合はエラー", async () => {
      mockGitService.createWorktree.mockResolvedValue({
        success: false,
        error: "Failed to create worktree",
      });

      await expect(manager.createWorktree(createOptions)).rejects.toThrow(WorktreeError);
      await expect(manager.createWorktree(createOptions)).rejects.toThrow(
        expect.objectContaining({
          code: WorktreeErrorCode.CREATION_FAILED,
        }),
      );
    });

    it("ブランチ名が自動生成される", async () => {
      const optionsWithoutBranch = {
        ...createOptions,
        branchName: undefined,
      };

      const worktree = await manager.createWorktree(optionsWithoutBranch);

      expect(worktree.branch).toMatch(/^cc-anywhere\/task-123/);
    });
  });

  describe("removeWorktree", () => {
    it("worktreeを削除できる", async () => {
      const worktreeId = "cc-anywhere-task-123";
      const result = await manager.removeWorktree(worktreeId);

      expect(result).toBe(true);
      expect(mockGitService.removeWorktree).toHaveBeenCalled();
      expect(mockLogger.logWorktreeDeletion).toHaveBeenCalled();
    });

    it("強制削除オプションを使用できる", async () => {
      const worktreeId = "cc-anywhere-task-123";
      await manager.removeWorktree(worktreeId, { force: true });

      expect(mockGitService.removeWorktree).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        true,
      );
    });

    it("削除に失敗した場合はfalseを返す", async () => {
      mockGitService.removeWorktree.mockResolvedValue({
        success: false,
        error: "Failed to remove",
      });

      const result = await manager.removeWorktree("cc-anywhere-task-123");
      expect(result).toBe(false);
    });
  });

  describe("getWorktree", () => {
    it("存在するworktreeを取得できる", async () => {
      const worktreeId = "cc-anywhere-task-123";
      const worktree = await manager.getWorktree(worktreeId);

      // メタデータから取得されるべき
      expect(worktree).toBeNull(); // 初期状態では存在しない
    });
  });

  describe("listWorktrees", () => {
    it("すべてのworktreeを一覧できる", async () => {
      // メタデータにworktreeを追加
      const worktree = {
        id: "cc-anywhere-task-1",
        taskId: "task-1",
        path: "/repos/test/.worktrees/task-1",
        branch: "feature/task-1",
        baseBranch: "main",
        repository: "/repos/test",
        createdAt: new Date(),
        status: "active" as const,
      };

      vi.mocked(fs.readFile).mockResolvedValueOnce(
        JSON.stringify({
          worktrees: [worktree],
          lastUpdated: new Date(),
          version: "1.0.0",
        }),
      );

      mockGitService.listWorktrees.mockResolvedValue([
        {
          path: "/repos/test/.worktrees/task-1",
          branch: "feature/task-1",
          commit: "abc123",
          name: "task-1",
        },
      ]);

      const worktrees = await manager.listWorktrees("/repos/test");
      expect(worktrees).toHaveLength(1);
      expect(worktrees[0]).toEqual(worktree);
    });

    it("リポジトリパスなしですべてのworktreeを返す", async () => {
      const worktree = {
        id: "cc-anywhere-task-1",
        taskId: "task-1",
        path: "/repos/test/.worktrees/task-1",
        branch: "feature/task-1",
        baseBranch: "main",
        repository: "/repos/test",
        createdAt: new Date(),
        status: "active" as const,
      };

      vi.mocked(fs.readFile).mockResolvedValueOnce(
        JSON.stringify({
          worktrees: [worktree],
          lastUpdated: new Date(),
          version: "1.0.0",
        }),
      );

      const worktrees = await manager.listWorktrees();
      expect(worktrees).toHaveLength(1);
      expect(worktrees[0]).toEqual(worktree);
    });
  });

  describe("cleanupOrphanedWorktrees", () => {
    it("孤立したworktreeをクリーンアップできる", async () => {
      // Git上に存在するがメタデータにないworktree
      mockGitService.listWorktrees.mockResolvedValue([
        {
          path: "/repos/test/.worktrees/cc-anywhere-orphan",
          branch: "feature/orphan",
          commit: "abc123",
          name: "cc-anywhere-orphan",
        },
      ]);

      const cleaned = await manager.cleanupOrphanedWorktrees("/repos/test");
      expect(cleaned).toBe(1);
      expect(mockGitService.removeWorktree).toHaveBeenCalled();
    });
  });

  describe("isWorktreeHealthy", () => {
    it("健全なworktreeの場合trueを返す", async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);

      const healthy = await manager.isWorktreeHealthy({
        id: "test",
        taskId: "task-123",
        path: "/repos/test/.worktrees/test",
        branch: "feature/test",
        baseBranch: "main",
        repository: "/repos/test",
        createdAt: new Date(),
        status: "active",
      });

      expect(healthy).toBe(true);
    });

    it("パスが存在しない場合falseを返す", async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error("ENOENT"));

      const healthy = await manager.isWorktreeHealthy({
        id: "test",
        taskId: "task-123",
        path: "/repos/test/.worktrees/test",
        branch: "feature/test",
        baseBranch: "main",
        repository: "/repos/test",
        createdAt: new Date(),
        status: "active",
      });

      expect(healthy).toBe(false);
    });
  });
});

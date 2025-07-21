import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { GitService } from "../../../../src/services/worktree/git-service";

// simple-gitのモック
vi.mock("simple-git", () => {
  const mockGit = {
    checkIsRepo: vi.fn().mockResolvedValue(true),
    status: vi.fn().mockResolvedValue({
      current: "main",
      files: [],
      ahead: 0,
      behind: 0,
    }),
    branch: vi.fn().mockResolvedValue({
      current: "main",
      all: ["main", "develop"],
    }),
    worktree: vi.fn().mockReturnThis(),
    add: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockReturnThis(),
    list: vi.fn().mockResolvedValue([]),
    raw: vi.fn().mockResolvedValue(""),
    revparse: vi.fn().mockResolvedValue("abc123\n"),
    branchLocal: vi.fn().mockResolvedValue({
      all: ["main", "develop"],
      branches: {},
      current: "main",
      detached: false,
    }),
    commit: vi.fn().mockResolvedValue({
      commit: "abc123",
      summary: { changes: 1, insertions: 10, deletions: 5 },
    }),
    diff: vi.fn().mockResolvedValue(""),
  };

  return {
    default: vi.fn(() => mockGit),
    simpleGit: vi.fn(() => mockGit),
  };
});

describe("GitService", () => {
  let gitService: GitService;
  let mockGit: any;

  beforeEach(async () => {
    // モックをリセット
    vi.clearAllMocks();

    // simple-gitモジュールを再インポート
    const simpleGitModule = await import("simple-git");
    mockGit = simpleGitModule.default();

    // モックを再設定
    mockGit.checkIsRepo.mockResolvedValue(true);
    mockGit.status.mockResolvedValue({
      current: "main",
      files: [],
      ahead: 0,
      behind: 0,
    });
    mockGit.branch.mockResolvedValue({
      current: "main",
      all: ["main", "develop"],
    });
    mockGit.raw.mockResolvedValue("");
    mockGit.revparse.mockResolvedValue("abc123\n");
    mockGit.branchLocal.mockResolvedValue({
      all: ["main", "develop"],
      branches: {},
      current: "main",
      detached: false,
    });
    mockGit.add.mockResolvedValue(undefined);
    mockGit.commit.mockResolvedValue({
      commit: "abc123",
      summary: { changes: 1, insertions: 10, deletions: 5 },
    });
    mockGit.diff.mockResolvedValue("");

    gitService = new GitService();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("isGitRepository", () => {
    it("Gitリポジトリの場合trueを返す", async () => {
      mockGit.checkIsRepo.mockResolvedValue(true);

      const result = await gitService.isGitRepository("/repos/test");

      expect(result).toBe(true);
      expect(mockGit.checkIsRepo).toHaveBeenCalled();
    });

    it("Gitリポジトリでない場合falseを返す", async () => {
      mockGit.checkIsRepo.mockResolvedValue(false);

      const result = await gitService.isGitRepository("/repos/test");

      expect(result).toBe(false);
    });

    it("エラー時はfalseを返す", async () => {
      mockGit.checkIsRepo.mockRejectedValue(new Error("Git error"));

      const result = await gitService.isGitRepository("/repos/test");

      expect(result).toBe(false);
    });
  });

  describe("getCurrentBranch", () => {
    it("現在のブランチ名を返す", async () => {
      mockGit.revparse.mockResolvedValue("feature/test\n");

      const result = await gitService.getCurrentBranch("/repos/test");

      expect(result).toBe("feature/test");
      expect(mockGit.revparse).toHaveBeenCalledWith(["--abbrev-ref", "HEAD"]);
    });

    it("エラー時はHEADを返す", async () => {
      mockGit.revparse.mockRejectedValue(new Error("Git error"));

      const result = await gitService.getCurrentBranch("/repos/test");

      expect(result).toBe("HEAD");
    });
  });

  describe("createWorktree", () => {
    it("worktreeを作成できる", async () => {
      mockGit.revparse.mockResolvedValueOnce("main\n"); // getCurrentBranch用
      mockGit.raw.mockResolvedValueOnce(""); // createWorktree用

      const result = await gitService.createWorktree(
        "/repos/test",
        "/repos/test/.worktrees/task-123",
        "feature/task-123",
      );

      expect(result.success).toBe(true);
      expect(mockGit.raw).toHaveBeenCalledWith([
        "worktree",
        "add",
        "-b",
        "feature/task-123",
        "/repos/test/.worktrees/task-123",
        "main",
      ]);
    });

    it("既存のブランチでworktreeを作成できる", async () => {
      mockGit.raw.mockResolvedValue("");

      const result = await gitService.createWorktree(
        "/repos/test",
        "/repos/test/.worktrees/task-123",
        "feature/existing",
        "main",
      );

      expect(result.success).toBe(true);
      expect(mockGit.raw).toHaveBeenCalledWith([
        "worktree",
        "add",
        "-b",
        "feature/existing",
        "/repos/test/.worktrees/task-123",
        "main",
      ]);
    });

    it("作成エラー時は失敗結果を返す", async () => {
      mockGit.revparse.mockResolvedValueOnce("main\n"); // getCurrentBranch用
      mockGit.raw.mockRejectedValueOnce(new Error("worktree already exists")); // createWorktree用

      const result = await gitService.createWorktree(
        "/repos/test",
        "/repos/test/.worktrees/task-123",
        "feature/task-123",
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("worktree already exists");
    });
  });

  describe("removeWorktree", () => {
    it("worktreeを削除できる", async () => {
      mockGit.raw.mockResolvedValue("");

      const result = await gitService.removeWorktree(
        "/repos/test",
        "/repos/test/.worktrees/task-123",
      );

      expect(result.success).toBe(true);
      expect(mockGit.raw).toHaveBeenCalledWith([
        "worktree",
        "remove",
        "/repos/test/.worktrees/task-123",
      ]);
    });

    it("強制削除オプションを使用できる", async () => {
      mockGit.raw.mockResolvedValue("");

      const result = await gitService.removeWorktree(
        "/repos/test",
        "/repos/test/.worktrees/task-123",
        true,
      );

      expect(result.success).toBe(true);
      expect(mockGit.raw).toHaveBeenCalledWith([
        "worktree",
        "remove",
        "--force",
        "/repos/test/.worktrees/task-123",
      ]);
    });
  });

  describe("listWorktrees", () => {
    it("worktree一覧を取得できる", async () => {
      // porcelain形式の出力をモック
      const mockPorcelainOutput = `worktree /repos/test
HEAD abcd1234
branch refs/heads/main

worktree /repos/test/.worktrees/task-123
HEAD efgh5678
branch refs/heads/feature/task-123

`;

      mockGit.raw.mockResolvedValueOnce(mockPorcelainOutput);

      const result = await gitService.listWorktrees("/repos/test");

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        path: "/repos/test",
        branch: "refs/heads/main",
        commit: "abcd1234",
        name: "main",
      });
      expect(result[1]).toEqual({
        path: "/repos/test/.worktrees/task-123",
        branch: "refs/heads/feature/task-123",
        commit: "efgh5678",
        name: "task-123",
      });
    });

    it.skip("porcelain形式が失敗した場合は通常形式にフォールバック", async () => {
      const mockOutput = `/repos/test  abcd1234 [main]
/repos/test/.worktrees/task-123  efgh5678 [feature/task-123]`;

      // モックをリセットして新しい動作を設定
      mockGit.raw.mockReset();
      mockGit.raw
        .mockResolvedValueOnce("") // 最初の呼び出し（porcelain）は空
        .mockResolvedValueOnce(mockOutput); // 2回目の呼び出し（通常形式）

      const result = await gitService.listWorktrees("/repos/test");

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        path: "/repos/test",
        branch: "main",
        commit: "abcd1234",
        name: "main",
      });
      expect(result[1]).toEqual({
        path: "/repos/test/.worktrees/task-123",
        branch: "feature/task-123",
        commit: "efgh5678",
        name: "task-123",
      });

      // 2回呼ばれたことを確認
      expect(mockGit.raw).toHaveBeenCalledTimes(2);
      expect(mockGit.raw).toHaveBeenNthCalledWith(1, ["worktree", "list", "--porcelain"]);
      expect(mockGit.raw).toHaveBeenNthCalledWith(2, ["worktree", "list"]);
    });
  });

  describe("getStatus", () => {
    it("Gitステータスを取得できる", async () => {
      mockGit.status.mockResolvedValue({
        current: "feature/test",
        files: [
          { path: "file1.ts", index: "M", working_dir: " " },
          { path: "file2.ts", index: "A", working_dir: " " },
        ],
        ahead: 2,
        behind: 0,
      });

      const result = await gitService.getStatus("/repos/test");

      expect(result.current).toBe("feature/test");
      expect(result.files).toHaveLength(2);
      expect(result.files[0]).toEqual({
        path: "file1.ts",
        status: "modified",
      });
      expect(result.files[1]).toEqual({
        path: "file2.ts",
        status: "added",
      });
      expect(result.ahead).toBe(2);
      expect(result.behind).toBe(0);
    });
  });

  describe("hasUncommittedChanges", () => {
    it("未コミットの変更がある場合trueを返す", async () => {
      mockGit.status.mockResolvedValue({
        files: [{ path: "file1.ts" }],
      });

      const result = await gitService.hasUncommittedChanges("/repos/test");

      expect(result).toBe(true);
    });

    it("未コミットの変更がない場合falseを返す", async () => {
      mockGit.status.mockResolvedValue({
        files: [],
      });

      const result = await gitService.hasUncommittedChanges("/repos/test");

      expect(result).toBe(false);
    });
  });

  describe("commitAll", () => {
    it("すべての変更をコミットできる", async () => {
      const result = await gitService.commitAll("/repos/test", "feat: test commit");

      expect(result.success).toBe(true);
      expect(mockGit.add).toHaveBeenCalledWith(".");
      expect(mockGit.commit).toHaveBeenCalledWith("feat: test commit");
    });
  });

  describe("createPatch", () => {
    it("未コミットの変更のパッチを作成できる", async () => {
      const mockPatch = `diff --git a/file.ts b/file.ts
index abc..def 100644
--- a/file.ts
+++ b/file.ts
@@ -1,3 +1,3 @@
-old line
+new line`;

      mockGit.diff.mockResolvedValue(mockPatch);

      const result = await gitService.createPatch("/repos/test");

      expect(result).toBe(mockPatch);
      expect(mockGit.diff).toHaveBeenCalledWith(["HEAD"]);
    });
  });
});

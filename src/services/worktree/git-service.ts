import type { SimpleGitOptions } from "simple-git";
import simpleGit from "simple-git";
import type { GitOperationResult, GitStatus } from "./types";
import { WorktreeError, WorktreeErrorCode } from "./types";

/**
 * Git操作を管理するサービス
 */
export class GitService {
  constructor(_options?: Partial<SimpleGitOptions>) {
    // We'll create git instances per-operation instead of storing one
  }

  /**
   * 指定されたパスがGitリポジトリかどうかを確認
   */
  async isGitRepository(path: string): Promise<boolean> {
    try {
      const git = simpleGit(path);
      return await git.checkIsRepo();
    } catch (error) {
      return false;
    }
  }

  /**
   * 現在のブランチ名を取得
   */
  async getCurrentBranch(repositoryPath: string): Promise<string> {
    try {
      const git = simpleGit(repositoryPath);
      const branchInfo = await git.branch();
      return branchInfo.current;
    } catch (error) {
      throw new WorktreeError(
        `Failed to get current branch: ${error}`,
        WorktreeErrorCode.CREATION_FAILED,
        { repositoryPath, error: String(error) },
      );
    }
  }

  /**
   * Worktreeを作成
   */
  async createWorktree(
    repositoryPath: string,
    worktreePath: string,
    branchName: string,
    baseBranch?: string,
  ): Promise<GitOperationResult> {
    try {
      const git = simpleGit(repositoryPath);
      const args = ["worktree", "add", "-b", branchName, worktreePath];

      if (baseBranch) {
        args.push(baseBranch);
      }

      await git.raw(args);

      return {
        success: true,
        output: `Worktree created at ${worktreePath} with branch ${branchName}`,
      };
    } catch (error) {
      return {
        success: false,
        error: String(error),
      };
    }
  }

  /**
   * Worktreeを削除
   */
  async removeWorktree(
    repositoryPath: string,
    worktreePath: string,
    force = false,
  ): Promise<GitOperationResult> {
    try {
      const git = simpleGit(repositoryPath);
      const args = ["worktree", "remove"];

      if (force) {
        args.push("--force");
      }

      args.push(worktreePath);
      await git.raw(args);

      return {
        success: true,
        output: `Worktree removed: ${worktreePath}`,
      };
    } catch (error) {
      return {
        success: false,
        error: String(error),
      };
    }
  }

  /**
   * Worktree一覧を取得
   */
  async listWorktrees(repositoryPath: string): Promise<
    Array<{
      path: string;
      branch: string;
      commit: string;
      name: string;
    }>
  > {
    try {
      const git = simpleGit(repositoryPath);
      const output = await git.raw(["worktree", "list", "--porcelain"]);

      const worktrees: Array<{
        path: string;
        branch: string;
        commit: string;
        name: string;
      }> = [];

      const lines = output.split("\n").filter((line) => line.trim());
      let currentWorktree: any = {};

      for (const line of lines) {
        if (line.startsWith("worktree ")) {
          if (currentWorktree.path) {
            worktrees.push(currentWorktree);
          }
          currentWorktree = { path: line.substring(9) };
        } else if (line.startsWith("HEAD ")) {
          currentWorktree.commit = line.substring(5);
        } else if (line.startsWith("branch ")) {
          currentWorktree.branch = line.substring(7);
          // ブランチ名から名前を抽出
          const branchParts = currentWorktree.branch.split("/");
          currentWorktree.name = branchParts[branchParts.length - 1];
        }
      }

      if (currentWorktree.path) {
        worktrees.push(currentWorktree);
      }

      // 簡易的な実装の場合（porcelainが期待通り動かない場合のフォールバック）
      if (worktrees.length === 0) {
        const simpleOutput = await git.raw(["worktree", "list"]);
        const simpleLines = simpleOutput.split("\n").filter((line) => line.trim());

        for (const line of simpleLines) {
          const match = line.match(/^(.+?)\s+([a-f0-9]+)\s+\[(.+?)\]$/);
          if (match && match[1] && match[2] && match[3]) {
            const branch = match[3];
            worktrees.push({
              path: match[1].trim(),
              commit: match[2],
              branch: branch,
              name: branch.split("/").pop() || branch,
            });
          }
        }
      }

      return worktrees;
    } catch (error) {
      throw new WorktreeError(
        `Failed to list worktrees: ${error}`,
        WorktreeErrorCode.CREATION_FAILED,
        { repositoryPath, error: String(error) },
      );
    }
  }

  /**
   * Gitステータスを取得
   */
  async getStatus(workingDirectory: string): Promise<GitStatus> {
    try {
      const git = simpleGit(workingDirectory);
      const status = await git.status();

      return {
        current: status.current || "",
        files: status.files.map((file) => ({
          path: file.path,
          status: this.mapFileStatus(file.index || file.working_dir),
        })),
        ahead: status.ahead,
        behind: status.behind,
      };
    } catch (error) {
      throw new WorktreeError(
        `Failed to get git status: ${error}`,
        WorktreeErrorCode.CREATION_FAILED,
        { workingDirectory, error: String(error) },
      );
    }
  }

  /**
   * 未コミットの変更があるかチェック
   */
  async hasUncommittedChanges(workingDirectory: string): Promise<boolean> {
    try {
      const git = simpleGit(workingDirectory);
      const status = await git.status();
      return status.files.length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * すべての変更をコミット
   */
  async commitAll(workingDirectory: string, message: string): Promise<GitOperationResult> {
    try {
      const git = simpleGit(workingDirectory);
      await git.add(".");
      await git.commit(message);

      return {
        success: true,
        output: `Changes committed with message: ${message}`,
      };
    } catch (error) {
      return {
        success: false,
        error: String(error),
      };
    }
  }

  /**
   * 未コミットの変更をパッチとして取得
   */
  async createPatch(workingDirectory: string): Promise<string> {
    try {
      const git = simpleGit(workingDirectory);
      return await git.diff(["HEAD"]);
    } catch (error) {
      throw new WorktreeError(
        `Failed to create patch: ${error}`,
        WorktreeErrorCode.CREATION_FAILED,
        { workingDirectory, error: String(error) },
      );
    }
  }

  /**
   * ブランチを削除
   */
  async deleteBranch(
    repositoryPath: string,
    branchName: string,
    force = false,
  ): Promise<GitOperationResult> {
    try {
      const git = simpleGit(repositoryPath);
      const flag = force ? "-D" : "-d";
      await git.branch([flag, branchName]);

      return {
        success: true,
        output: `Branch ${branchName} deleted`,
      };
    } catch (error) {
      return {
        success: false,
        error: String(error),
      };
    }
  }

  /**
   * ファイルステータスをマッピング
   */
  private mapFileStatus(status: string): "added" | "modified" | "deleted" | "renamed" {
    switch (status) {
      case "A":
        return "added";
      case "M":
        return "modified";
      case "D":
        return "deleted";
      case "R":
        return "renamed";
      default:
        return "modified";
    }
  }
}

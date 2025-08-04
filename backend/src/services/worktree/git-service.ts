import type { SimpleGitOptions } from "simple-git";
import simpleGit from "simple-git";
import * as path from "path";
import type { GitOperationResult, GitStatus } from "./types";
import { WorktreeError, WorktreeErrorCode } from "./types";
import { logger } from "../../utils/logger";

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
      logger.debug("Repository check failed", {
        path,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * 現在のブランチ名を取得
   */
  async getCurrentBranch(repositoryPath: string): Promise<string> {
    try {
      const git = simpleGit(repositoryPath);
      const branch = await git.revparse(["--abbrev-ref", "HEAD"]);
      return branch.trim();
    } catch (error) {
      logger.warn("Failed to get current branch, using HEAD", { error });
      return "HEAD";
    }
  }

  /**
   * worktreeのベースブランチを取得（通常は現在のブランチ）
   */
  async getBaseBranch(repositoryPath: string): Promise<string> {
    try {
      // 現在のブランチから作成する方が直感的なので、現在のブランチを返す
      const currentBranch = await this.getCurrentBranch(repositoryPath);
      if (currentBranch !== "HEAD") {
        return currentBranch;
      }

      // HEADの場合は、実際のコミットハッシュを取得
      const git = simpleGit(repositoryPath);
      const hash = await git.revparse(["HEAD"]);
      return hash.trim();
    } catch (error) {
      logger.warn("Failed to get current branch, fallback to main/master", { error });

      try {
        const git = simpleGit(repositoryPath);
        const branches = await git.branchLocal();

        // フォールバック: よく使われるブランチ名を確認
        if (branches.all.includes("main")) {
          return "main";
        } else if (branches.all.includes("master")) {
          return "master";
        }

        // 最初のブランチを使用
        if (branches.all.length > 0 && branches.all[0]) {
          return branches.all[0];
        }

        // ブランチがない場合はコミットハッシュを使用
        try {
          const hash = await git.revparse(["HEAD"]);
          return hash.trim();
        } catch (e) {
          // 何もない場合は初期化されていないリポジトリ
          throw new WorktreeError(
            "Repository has no commits or branches",
            WorktreeErrorCode.NOT_GIT_REPOSITORY,
            { repositoryPath },
          );
        }
      } catch (e) {
        logger.error("Failed to get any branch", { error: e });
        throw e;
      }
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

      // baseBranchが指定されていない場合は現在のブランチを使用
      if (!baseBranch) {
        baseBranch = await this.getBaseBranch(repositoryPath);
      }

      const args = ["worktree", "add", "-b", branchName, worktreePath, baseBranch];

      await git.raw(args);

      return {
        success: true,
        output: `Worktree created at ${worktreePath} with branch ${branchName} based on ${baseBranch}`,
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
    let targetPath = worktreePath;

    try {
      const git = simpleGit(repositoryPath);
      const args = ["worktree", "remove"];

      if (force) {
        args.push("--force");
      }

      // Git worktree removeは絶対パスまたはworktree名を受け付ける
      // まず、worktreeリストから該当するworktreeを探す
      try {
        const worktrees = await this.listWorktrees(repositoryPath);
        const matchingWorktree = worktrees.find((w) => w.path === worktreePath);

        if (matchingWorktree) {
          // worktreeが見つかった場合は、そのパスを使用
          targetPath = matchingWorktree.path;
        } else if (path.isAbsolute(worktreePath)) {
          // worktreeが見つからず、絶対パスの場合は相対パスに変換
          targetPath = path.relative(repositoryPath, worktreePath);
        }
      } catch (listError) {
        logger.warn("Failed to list worktrees, using original path", { error: listError });
      }

      args.push(targetPath);

      logger.info("GitService: Executing git worktree remove", {
        repositoryPath,
        worktreePath,
        targetPath,
        args,
      });

      const output = await git.raw(args);

      logger.info("GitService: git worktree remove completed", {
        output,
        worktreePath,
      });

      return {
        success: true,
        output: `Worktree removed: ${worktreePath}`,
      };
    } catch (error) {
      logger.error("GitService: git worktree remove failed", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        repositoryPath,
        worktreePath,
        targetPath,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
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

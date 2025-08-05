import * as fs from "fs/promises";
import * as path from "path";
import { GitService } from "./git-service";
import { WorktreeLogger } from "./worktree-logger";
import type {
  Worktree,
  WorktreeConfig,
  CreateWorktreeOptions,
  CleanupOptions,
  WorktreeMetadata,
} from "./types";
import { WorktreeError, WorktreeErrorCode } from "./types";

/**
 * Worktreeの作成・管理・削除を行うマネージャー
 */
export class WorktreeManager {
  private gitService: GitService;
  private logger: WorktreeLogger;
  private config: WorktreeConfig;
  private metadataPath: string;

  constructor(config: WorktreeConfig) {
    this.config = config;
    this.gitService = new GitService();
    this.logger = new WorktreeLogger("WorktreeManager");
    this.metadataPath = path.join(config.baseDirectory, ".metadata.json");
  }

  /**
   * Worktreeを作成
   */
  async createWorktree(options: CreateWorktreeOptions): Promise<Worktree> {
    const { taskId, repositoryPath, baseBranch, branchName } = options;

    // Convert relative repository path to absolute path
    const absoluteRepositoryPath = path.isAbsolute(repositoryPath)
      ? repositoryPath
      : path.resolve(repositoryPath);

    // Gitリポジトリかチェック
    const isGitRepo = await this.gitService.isGitRepository(absoluteRepositoryPath);
    if (!isGitRepo) {
      throw new WorktreeError(
        `Not a git repository: ${absoluteRepositoryPath}`,
        WorktreeErrorCode.NOT_GIT_REPOSITORY,
        { repositoryPath: absoluteRepositoryPath },
      );
    }

    // 最大数チェック
    const existingWorktrees = await this.gitService.listWorktrees(absoluteRepositoryPath);
    const activeWorktrees = existingWorktrees.filter((w) =>
      w.path.includes(this.config.baseDirectory),
    );

    if (activeWorktrees.length >= this.config.maxWorktrees) {
      throw new WorktreeError(
        `Maximum worktrees (${this.config.maxWorktrees}) exceeded`,
        WorktreeErrorCode.MAX_WORKTREES_EXCEEDED,
        { current: activeWorktrees.length, max: this.config.maxWorktrees },
      );
    }

    // Worktree情報の生成
    const worktreeId = `${this.config.worktreePrefix}-${taskId}`;

    // Calculate worktree path relative to the project root
    // If baseDirectory is relative, make it relative to the repository root
    const worktreePath = path.isAbsolute(this.config.baseDirectory)
      ? path.join(this.config.baseDirectory, worktreeId)
      : path.join(absoluteRepositoryPath, this.config.baseDirectory, worktreeId);

    const targetBranch = branchName || `${this.config.worktreePrefix}/${taskId}-${Date.now()}`;

    // ログ記録
    this.logger.logWorktreeCreation(taskId, worktreeId, {
      repositoryPath: absoluteRepositoryPath,
      worktreePath,
      baseBranch: baseBranch || "current",
      targetBranch,
    });

    try {
      // ディレクトリ作成
      await fs.mkdir(path.dirname(worktreePath), { recursive: true });

      // Worktree作成
      const result = await this.gitService.createWorktree(
        absoluteRepositoryPath,
        worktreePath,
        targetBranch,
        baseBranch,
      );

      if (!result.success) {
        throw new WorktreeError(
          `Failed to create worktree: ${result.error}`,
          WorktreeErrorCode.CREATION_FAILED,
          { error: result.error },
        );
      }

      // Worktree情報
      const worktree: Worktree = {
        id: worktreeId,
        taskId,
        path: worktreePath,
        branch: targetBranch,
        baseBranch,
        repository: absoluteRepositoryPath,
        createdAt: new Date(),
        status: "active",
      };

      // メタデータに保存
      await this.saveWorktreeMetadata(worktree);

      this.logger.logOperationSuccess("WORKTREE_CREATE", taskId, worktreeId, {
        path: worktreePath,
        branch: targetBranch,
      });

      return worktree;
    } catch (error) {
      this.logger.logOperationError("WORKTREE_CREATE", error as Error, taskId, worktreeId);

      if (error instanceof WorktreeError) {
        throw error;
      }

      throw new WorktreeError("Failed to create worktree", WorktreeErrorCode.CREATION_FAILED, {
        error: String(error),
      });
    }
  }

  /**
   * Worktreeを削除
   */
  async removeWorktree(worktreeId: string, options?: CleanupOptions): Promise<boolean> {
    try {
      // メタデータから情報を取得
      const worktree = await this.getWorktree(worktreeId);

      // メタデータにない場合は、worktreeIdからパスを推測
      const worktreePath =
        worktree?.path ||
        path.join(
          process.cwd(), // テスト時は現在のディレクトリを使用
          this.config.baseDirectory,
          worktreeId,
        );
      const taskId = worktree?.taskId || "unknown";
      const repository = worktree?.repository || process.cwd();

      this.logger.logWorktreeDeletion(taskId, worktreeId, worktreePath, options?.force || false);

      if (!worktree) {
        this.logger.logWarning("WORKTREE_DELETE", `Worktree not found in metadata: ${worktreeId}`);
        // メタデータにない場合でもGit上のworktreeは削除を試みる
      }

      // 未コミットの変更を保存（オプション）
      if (options?.saveUncommitted && worktree) {
        const hasChanges = await this.gitService.hasUncommittedChanges(worktreePath);
        if (hasChanges) {
          const patch = await this.gitService.createPatch(worktreePath);
          const backupPath = options.backupPath || path.join(repository, ".worktree-backups");
          await fs.mkdir(backupPath, { recursive: true });
          await fs.writeFile(path.join(backupPath, `${worktreeId}-${Date.now()}.patch`), patch);
        }
      }

      // Worktree削除
      this.logger.logWarning(
        "WORKTREE_DELETE",
        `Attempting to remove worktree: ${worktreePath} from ${repository}`,
      );
      const result = await this.gitService.removeWorktree(repository, worktreePath, options?.force);

      if (!result.success) {
        this.logger.logOperationError("WORKTREE_DELETE", result.error || "Unknown error");
        this.logger.logOperationError(
          "WORKTREE_DELETE",
          `Failed to remove worktree: ${worktreePath}, error: ${result.error}`,
        );
        return false;
      }

      // ディレクトリ削除
      try {
        await fs.rm(worktreePath, { recursive: true, force: true });
      } catch (error) {
        this.logger.logWarning("WORKTREE_DELETE", `Failed to remove directory: ${error}`);
      }

      // ブランチ削除（オプション）
      if (worktree && worktree.branch !== worktree.baseBranch) {
        await this.gitService.deleteBranch(repository, worktree.branch, true);
      }

      // メタデータから削除
      if (worktree) {
        await this.removeWorktreeMetadata(worktreeId);
      }

      this.logger.logOperationSuccess("WORKTREE_DELETE", taskId, worktreeId);
      return true;
    } catch (error) {
      this.logger.logOperationError("WORKTREE_DELETE", error as Error);
      return false;
    }
  }

  /**
   * Worktree情報を取得
   */
  async getWorktree(worktreeId: string): Promise<Worktree | null> {
    const metadata = await this.loadMetadata();
    return metadata.worktrees.find((w) => w.id === worktreeId) || null;
  }

  /**
   * すべてのWorktreeを一覧
   */
  async listWorktrees(repositoryPath?: string): Promise<Worktree[]> {
    if (!repositoryPath) {
      const metadata = await this.loadMetadata();
      return metadata.worktrees;
    }

    const gitWorktrees = await this.gitService.listWorktrees(repositoryPath);
    const metadata = await this.loadMetadata();

    return metadata.worktrees.filter(
      (w) => w.repository === repositoryPath && gitWorktrees.some((gw) => gw.path === w.path),
    );
  }

  /**
   * 孤立したWorktreeをクリーンアップ
   */
  async cleanupOrphanedWorktrees(repositoryPath: string): Promise<number> {
    const gitWorktrees = await this.gitService.listWorktrees(repositoryPath);
    const metadata = await this.loadMetadata();
    let cleanedCount = 0;

    // Git上に存在するがメタデータにないworktree
    for (const gitWorktree of gitWorktrees) {
      // worktree名にプレフィックスが含まれているかチェック
      if (gitWorktree.name && gitWorktree.name.includes(this.config.worktreePrefix)) {
        const exists = metadata.worktrees.some((w) => w.path === gitWorktree.path);
        if (!exists) {
          this.logger.logWarning(
            "CLEANUP_ORPHANED",
            `Found orphaned worktree: ${gitWorktree.path}`,
          );

          const result = await this.gitService.removeWorktree(
            repositoryPath,
            gitWorktree.path,
            true,
          );

          if (result.success) {
            cleanedCount++;
            try {
              await fs.rm(gitWorktree.path, { recursive: true, force: true });
            } catch (error) {
              // ディレクトリ削除エラーは無視
            }
          }
        }
      }
    }

    if (cleanedCount > 0) {
      this.logger.logOperationSuccess("CLEANUP_ORPHANED", undefined, undefined, {
        cleanedCount,
      });
    }

    return cleanedCount;
  }

  /**
   * Worktreeの健全性をチェック
   */
  async isWorktreeHealthy(worktree: Worktree): Promise<boolean> {
    try {
      // パスの存在確認
      await fs.access(worktree.path);

      // TODO: 追加のヘルスチェック
      // - Gitリポジトリとして有効か
      // - ブランチが正しいか
      // - リモートとの同期状態

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * メタデータを読み込み
   */
  private async loadMetadata(): Promise<WorktreeMetadata> {
    try {
      const data = await fs.readFile(this.metadataPath, "utf-8");
      const rawMetadata = JSON.parse(data) as {
        worktrees: Array<{
          id: string;
          taskId: string;
          name: string;
          path: string;
          branch: string;
          baseBranch: string;
          repository: string;
          status: "active" | "completed" | "failed" | "cleanup_required";
          createdAt: string;
        }>;
        lastUpdated: string;
        version?: string;
      };

      // Date型に変換
      const metadata: WorktreeMetadata = {
        worktrees: rawMetadata.worktrees.map((w) => ({
          ...w,
          createdAt: new Date(w.createdAt),
        })),
        lastUpdated: new Date(rawMetadata.lastUpdated),
        version: rawMetadata.version || "1.0.0",
      };

      return metadata;
    } catch (error) {
      // ファイルが存在しない場合は初期化
      return {
        worktrees: [],
        lastUpdated: new Date(),
        version: "1.0.0",
      };
    }
  }

  /**
   * Worktreeメタデータを保存
   */
  private async saveWorktreeMetadata(worktree: Worktree): Promise<void> {
    const metadata = await this.loadMetadata();

    // 既存のエントリを更新または追加
    const index = metadata.worktrees.findIndex((w) => w.id === worktree.id);
    if (index >= 0) {
      metadata.worktrees[index] = worktree;
    } else {
      metadata.worktrees.push(worktree);
    }

    metadata.lastUpdated = new Date();

    await fs.mkdir(path.dirname(this.metadataPath), { recursive: true });
    await fs.writeFile(this.metadataPath, JSON.stringify(metadata, null, 2));
  }

  /**
   * Worktreeメタデータから削除
   */
  private async removeWorktreeMetadata(worktreeId: string): Promise<void> {
    const metadata = await this.loadMetadata();
    metadata.worktrees = metadata.worktrees.filter((w) => w.id !== worktreeId);
    metadata.lastUpdated = new Date();

    await fs.writeFile(this.metadataPath, JSON.stringify(metadata, null, 2));
  }
}

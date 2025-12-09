/**
 * LLM比較モードサービス
 *
 * 複数のLLM（Claude, Codex, Gemini）に同一タスクを同時実行させ、結果を比較する機能を提供
 */

import { existsSync, mkdirSync } from "fs";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { logger } from "../../utils/logger.js";
import { GitService } from "../worktree/git-service.js";
import type { CompareTaskRepositoryImpl } from "../../repositories/compare-task-repository.js";
import type { CompareTaskEntity, CompareTaskStatus } from "../../repositories/types.js";
import type {
  CreateCompareTaskRequest,
  CreateCompareTaskResponse,
  CompareTaskDetailResponse,
  CompareFilesResponse,
  CompareWorktreeInfo,
  CompareConfig,
  FileChangeStatus,
} from "./types.js";
import { CompareErrorCode } from "./types.js";
import { AppError } from "../../utils/errors.js";

const execAsync = promisify(exec);

/**
 * ワークツリーベースパスを絶対パスで取得
 * 相対パスの場合はプロジェクトルートからの相対パスとして解決
 */
function getAbsoluteWorktreeBasePath(): string {
  const basePath = process.env.WORKTREE_BASE_PATH || "/tmp/cc-anywhere/worktrees";
  // 既に絶対パスならそのまま返す
  if (path.isAbsolute(basePath)) {
    return basePath;
  }
  // 相対パスの場合はcwdからの絶対パスに変換
  return path.resolve(process.cwd(), basePath);
}

// 環境変数から設定を取得
const DEFAULT_CONFIG: CompareConfig = {
  worktreeBasePath: getAbsoluteWorktreeBasePath(),
  worktreeRetentionHours: parseInt(process.env.WORKTREE_RETENTION_HOURS || "24", 10),
  maxConcurrentCompareTasks: parseInt(process.env.MAX_CONCURRENT_COMPARE_TASKS || "3", 10),
  minFreeSpaceGB: parseInt(process.env.MIN_FREE_SPACE_GB || "5", 10),
  maxFilesCount: 100,
};

/**
 * リポジトリ情報の型
 */
interface Repository {
  name: string;
  path: string;
}

/**
 * LLM比較モードサービス
 */
export class CompareService {
  private gitService: GitService;
  private config: CompareConfig;

  constructor(
    private compareTaskRepository: CompareTaskRepositoryImpl,
    private taskQueue: any, // TaskQueueの型は既存コードに依存
    private getRepositories: () => Repository[],
    config?: Partial<CompareConfig>,
  ) {
    this.gitService = new GitService();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 比較タスクを作成して実行開始
   */
  async createCompareTask(request: CreateCompareTaskRequest): Promise<CreateCompareTaskResponse> {
    const { instruction, repositoryId } = request;

    // 1. リポジトリ検証
    const repo = this.findRepository(repositoryId);
    if (!repo) {
      throw new AppError(
        "指定されたリポジトリが見つかりません",
        404,
        CompareErrorCode.REPOSITORY_NOT_FOUND,
      );
    }

    if (!existsSync(repo.path)) {
      throw new AppError(
        "リポジトリパスが存在しません",
        400,
        CompareErrorCode.REPOSITORY_PATH_NOT_EXISTS,
      );
    }

    const isGitRepo = await this.gitService.isGitRepository(repo.path);
    if (!isGitRepo) {
      throw new AppError(
        "指定されたパスはGitリポジトリではありません",
        400,
        CompareErrorCode.NOT_A_GIT_REPOSITORY,
      );
    }

    // 2. 同時実行数チェック
    const runningCount = await this.compareTaskRepository.countRunningTasks();
    if (runningCount >= this.config.maxConcurrentCompareTasks) {
      throw new AppError(
        `同時実行上限（${this.config.maxConcurrentCompareTasks}件）に達しています。しばらく待ってから再試行してください。`,
        429,
        CompareErrorCode.TOO_MANY_COMPARE_TASKS,
        { retryAfter: 60 },
      );
    }

    // 3. ディスク容量チェック
    await this.checkDiskSpace();

    // 4. ベースコミット取得
    const baseCommit = await this.getHeadCommit(repo.path);

    // 5. 比較タスクID生成
    const compareId = `cmp_${uuidv4().substring(0, 8)}`;

    // 6. ワークツリーベースディレクトリの確認・作成
    if (!existsSync(this.config.worktreeBasePath)) {
      try {
        mkdirSync(this.config.worktreeBasePath, { recursive: true });
        logger.info("Created worktree base directory", { path: this.config.worktreeBasePath });
      } catch (error) {
        throw new AppError(
          "Worktreeベースディレクトリの作成に失敗しました",
          500,
          CompareErrorCode.WORKTREE_CREATION_FAILED,
          { originalError: error instanceof Error ? error.message : String(error) },
        );
      }
    }

    // 7. Worktree作成（ロールバック対応）
    let worktrees: CompareWorktreeInfo[] = [];
    try {
      worktrees = await this.createCompareWorktrees(compareId, repo.path, baseCommit);
    } catch (error) {
      logger.error("Failed to create worktrees for compare task", { compareId, error });
      throw new AppError(
        "Worktreeの作成に失敗しました",
        500,
        CompareErrorCode.WORKTREE_CREATION_FAILED,
        { originalError: error instanceof Error ? error.message : String(error) },
      );
    }

    // 7. 3つのタスクを作成
    const executors = ["claude", "codex", "gemini"] as const;
    const taskIds: Record<string, string> = {};

    for (const executor of executors) {
      const worktree = worktrees.find((w) => w.executor === executor);
      if (!worktree) continue;

      const taskId = this.taskQueue.add(
        {
          instruction,
          context: {
            workingDirectory: worktree.worktreePath,
          },
          options: {
            executor,
            async: true,
            worktree: {
              enabled: false, // 既にworktreeを作成済み
            },
            // Compare modeでは全ての権限をバイパス（ワークツリー内で安全に実行）
            sdk: {
              permissionMode: "bypassPermissions" as const,
            },
            // Geminiにファイル操作ツールを有効化
            gemini: {
              enableFileOperations: true,
            },
          },
        },
        0,
      );

      taskIds[executor] = taskId;
    }

    // 8. 比較タスクレコード作成
    const compareTask: CompareTaskEntity = {
      id: compareId,
      instruction,
      repositoryId,
      repositoryPath: repo.path,
      baseCommit,
      claudeTaskId: taskIds.claude || null,
      codexTaskId: taskIds.codex || null,
      geminiTaskId: taskIds.gemini || null,
      status: "running",
      createdAt: new Date(),
      completedAt: null,
    };

    await this.compareTaskRepository.create(compareTask);

    logger.info("Compare task created", {
      compareId,
      claudeTaskId: taskIds.claude,
      codexTaskId: taskIds.codex,
      geminiTaskId: taskIds.gemini,
    });

    return {
      compareId,
      claudeTaskId: taskIds.claude || "",
      codexTaskId: taskIds.codex || "",
      geminiTaskId: taskIds.gemini || "",
      status: "running",
    };
  }

  /**
   * 比較タスクの詳細を取得
   */
  async getCompareTask(compareId: string): Promise<CompareTaskDetailResponse | null> {
    const task = await this.compareTaskRepository.findById(compareId);
    if (!task) return null;

    return {
      compareId: task.id,
      instruction: task.instruction,
      repositoryId: task.repositoryId,
      baseCommit: task.baseCommit,
      status: task.status,
      claudeTaskId: task.claudeTaskId,
      codexTaskId: task.codexTaskId,
      geminiTaskId: task.geminiTaskId,
      createdAt: task.createdAt.toISOString(),
      completedAt: task.completedAt?.toISOString() || null,
    };
  }

  /**
   * 比較タスク一覧を取得
   */
  async listCompareTasks(
    limit = 20,
    offset = 0,
  ): Promise<{ tasks: CompareTaskDetailResponse[]; total: number }> {
    const result = await this.compareTaskRepository.findMany([], {
      page: Math.floor(offset / limit) + 1,
      limit,
      sortBy: "created_at",
      sortOrder: "desc",
    });

    return {
      tasks: result.items.map((task) => ({
        compareId: task.id,
        instruction: task.instruction,
        repositoryId: task.repositoryId,
        baseCommit: task.baseCommit,
        status: task.status,
        claudeTaskId: task.claudeTaskId,
        codexTaskId: task.codexTaskId,
        geminiTaskId: task.geminiTaskId,
        createdAt: task.createdAt.toISOString(),
        completedAt: task.completedAt?.toISOString() || null,
      })),
      total: result.total,
    };
  }

  /**
   * 変更ファイル一覧を取得
   */
  async getCompareFiles(compareId: string): Promise<CompareFilesResponse> {
    const task = await this.compareTaskRepository.findById(compareId);
    if (!task) {
      throw new AppError(
        "比較タスクが見つかりません",
        404,
        CompareErrorCode.COMPARE_TASK_NOT_FOUND,
      );
    }

    const executors = ["claude", "codex", "gemini"] as const;
    const fileChanges: Map<string, Record<string, FileChangeStatus>> = new Map();

    for (const executor of executors) {
      const worktreePath = `${this.config.worktreeBasePath}/${compareId}-${executor}`;

      if (!existsSync(worktreePath)) continue;

      try {
        const changes = await this.getWorktreeChanges(worktreePath, task.baseCommit);
        for (const { path, status } of changes) {
          if (!fileChanges.has(path)) {
            fileChanges.set(path, { claude: null, codex: null, gemini: null });
          }
          fileChanges.get(path)![executor] = status;
        }
      } catch (error) {
        logger.warn(`Failed to get changes for ${executor} worktree`, { compareId, error });
      }
    }

    // ファイル一覧をソートして制限
    const sortedFiles = Array.from(fileChanges.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(0, this.config.maxFilesCount);

    return {
      files: sortedFiles.map(([path, changes]) => ({
        path,
        claude: changes.claude ?? null,
        codex: changes.codex ?? null,
        gemini: changes.gemini ?? null,
      })),
      truncated: fileChanges.size > this.config.maxFilesCount,
      totalCount: fileChanges.size,
    };
  }

  /**
   * 比較タスクをキャンセル
   */
  async cancelCompareTask(compareId: string): Promise<{ compareId: string; status: string }> {
    const task = await this.compareTaskRepository.findById(compareId);
    if (!task) {
      throw new AppError(
        "比較タスクが見つかりません",
        404,
        CompareErrorCode.COMPARE_TASK_NOT_FOUND,
      );
    }

    // 1. ステータスを'cancelling'に更新
    await this.compareTaskRepository.updateStatus(compareId, "cancelling");

    // 2. 各タスクをキャンセル（並列実行）
    const taskIds = [task.claudeTaskId, task.codexTaskId, task.geminiTaskId].filter(Boolean);

    await Promise.all(
      taskIds.map(async (taskId) => {
        try {
          // TaskQueueからキャンセル
          if (taskId) {
            this.taskQueue.cancel(taskId);
          }
        } catch (error) {
          logger.warn(`Failed to cancel task ${taskId}`, { compareId, error });
        }
      }),
    );

    // 3. ステータスを'cancelled'に更新
    await this.compareTaskRepository.markCompleted(compareId, "cancelled");

    // 4. Worktreeクリーンアップ（非同期）
    this.cleanupCompareWorktrees(compareId, task.repositoryPath).catch((error) => {
      logger.warn(`Failed to cleanup worktrees for compare task ${compareId}`, { error });
    });

    return { compareId, status: "cancelled" };
  }

  /**
   * 比較タスクのステータスを更新（タスク完了時に呼ばれる）
   */
  async updateCompareTaskStatus(compareId: string): Promise<void> {
    const task = await this.compareTaskRepository.findById(compareId);
    if (!task) return;

    // 各タスクのステータスを確認
    const taskIds = [task.claudeTaskId, task.codexTaskId, task.geminiTaskId];
    const taskStatuses = await Promise.all(
      taskIds.map(async (taskId) => {
        if (!taskId) return null;
        const queuedTask = this.taskQueue.get(taskId);
        return queuedTask?.status || null;
      }),
    );

    const completed = taskStatuses.filter((s) => s === "completed").length;
    const failed = taskStatuses.filter((s) => s === "failed").length;
    const cancelled = taskStatuses.filter((s) => s === "cancelled").length;
    const total = taskStatuses.filter((s) => s !== null).length;

    let newStatus: CompareTaskStatus;

    if (completed + failed + cancelled === total) {
      // 全タスク完了
      if (completed === total) {
        newStatus = "completed";
      } else if (failed === total) {
        newStatus = "failed";
      } else if (cancelled === total) {
        newStatus = "cancelled";
      } else {
        newStatus = "partial_success";
      }

      await this.compareTaskRepository.markCompleted(compareId, newStatus);

      logger.info("Compare task completed", {
        compareId,
        status: newStatus,
        completed,
        failed,
        cancelled,
      });
    }
  }

  /**
   * 古いworktreeをクリーンアップ
   */
  async cleanupExpiredWorktrees(): Promise<void> {
    const retentionMs = this.config.worktreeRetentionHours * 60 * 60 * 1000;
    const cutoffDate = new Date(Date.now() - retentionMs);

    // 期限切れまたは失敗/キャンセル済みのタスクを取得
    const expiredTasks = await this.compareTaskRepository.findMany([
      {
        field: "completed_at",
        operator: "lt",
        value: cutoffDate.toISOString(),
      },
    ]);

    const failedOrCancelled = await this.compareTaskRepository.findMany([
      {
        field: "status",
        operator: "in",
        value: ["failed", "cancelled"],
      },
    ]);

    const tasksToCleanup = [...expiredTasks.items, ...failedOrCancelled.items];

    for (const task of tasksToCleanup) {
      try {
        await this.cleanupCompareWorktrees(task.id, task.repositoryPath);
        await this.compareTaskRepository.delete(task.id);
        logger.info("Cleaned up expired compare task", { compareId: task.id });
      } catch (error) {
        logger.warn(`Failed to cleanup compare task ${task.id}`, { error });
      }
    }
  }

  // === Private Methods ===

  private findRepository(repositoryId: string): Repository | undefined {
    const repositories = this.getRepositories();
    return repositories.find((r) => r.name === repositoryId);
  }

  private async getHeadCommit(repoPath: string): Promise<string> {
    const { stdout } = await execAsync("git rev-parse HEAD", { cwd: repoPath });
    return stdout.trim();
  }

  private async checkDiskSpace(): Promise<void> {
    try {
      const { stdout } = await execAsync(
        `df -BG "${this.config.worktreeBasePath}" | tail -1 | awk '{print $4}'`,
      );
      const freeGB = parseInt(stdout.replace("G", ""), 10);

      if (freeGB < this.config.minFreeSpaceGB) {
        throw new AppError(
          `ディスク空き容量が不足しています（${freeGB}GB < ${this.config.minFreeSpaceGB}GB）`,
          503,
          CompareErrorCode.INSUFFICIENT_DISK_SPACE,
        );
      }
    } catch (error) {
      if (error instanceof AppError) throw error;
      // ディスク容量チェックに失敗した場合は警告のみ
      logger.warn("Failed to check disk space", { error });
    }
  }

  private async createCompareWorktrees(
    compareId: string,
    repoPath: string,
    baseCommit: string,
  ): Promise<CompareWorktreeInfo[]> {
    const executors = ["claude", "codex", "gemini"] as const;
    const created: CompareWorktreeInfo[] = [];

    try {
      for (const executor of executors) {
        const branchName = `compare/${compareId}-${executor}`;
        const worktreePath = `${this.config.worktreeBasePath}/${compareId}-${executor}`;

        // 既存チェック（前回失敗の残骸対応）
        if (existsSync(worktreePath)) {
          await this.gitService.removeWorktree(repoPath, worktreePath, true);
        }

        // ブランチ存在チェック
        try {
          await execAsync(`git branch -D "${branchName}"`, { cwd: repoPath });
        } catch {
          // ブランチが存在しない場合は無視
        }

        // Worktree作成（特定のコミットをベースに）
        const result = await this.gitService.createWorktree(
          repoPath,
          worktreePath,
          branchName,
          baseCommit,
        );

        if (!result.success) {
          throw new Error(result.error || "Worktree creation failed");
        }

        created.push({ executor, worktreePath, branchName });
      }

      return created;
    } catch (error) {
      // ロールバック: 作成済みworktreeを削除
      for (const wt of created) {
        try {
          await this.gitService.removeWorktree(repoPath, wt.worktreePath, true);
        } catch (cleanupError) {
          logger.warn(`Rollback cleanup failed: ${wt.worktreePath}`, { cleanupError });
        }
      }
      throw error;
    }
  }

  private async cleanupCompareWorktrees(compareId: string, repoPath: string): Promise<void> {
    const executors = ["claude", "codex", "gemini"] as const;

    for (const executor of executors) {
      const worktreePath = `${this.config.worktreeBasePath}/${compareId}-${executor}`;
      const branchName = `compare/${compareId}-${executor}`;

      try {
        // --force: 未コミット変更があっても強制削除
        await this.gitService.removeWorktree(repoPath, worktreePath, true);

        // ブランチも削除
        try {
          await execAsync(`git branch -D "${branchName}"`, { cwd: repoPath });
        } catch {
          // ブランチが存在しない場合は無視
        }
      } catch (error) {
        // 失敗時はログ出力のみ（次回ジョブで再試行または手動対応）
        logger.warn(`Worktree cleanup failed: ${worktreePath}`, {
          error,
          compareId,
        });
      }
    }
  }

  /**
   * ワークツリーの変更ファイルを取得
   * コミット済み差分 + 未コミット差分（ステージ済み + 未ステージ）を含む
   */
  private async getWorktreeChanges(
    worktreePath: string,
    baseCommit: string,
  ): Promise<Array<{ path: string; status: FileChangeStatus }>> {
    try {
      const changes: Map<string, FileChangeStatus> = new Map();

      // 1. コミット済み差分（baseCommit から HEAD）
      try {
        const { stdout: committedDiff } = await execAsync(
          `git -C "${worktreePath}" diff --name-status ${baseCommit} HEAD 2>/dev/null || true`,
        );
        this.parseGitDiffOutput(committedDiff, changes);
      } catch {
        // コミットがない場合は無視
      }

      // 2. 未コミット差分（ステージ済み + 未ステージ）
      // baseCommit からワーキングツリーまでの全差分
      try {
        const { stdout: workingDiff } = await execAsync(
          `git -C "${worktreePath}" diff --name-status ${baseCommit} -- 2>/dev/null || true`,
        );
        this.parseGitDiffOutput(workingDiff, changes);
      } catch {
        // 差分がない場合は無視
      }

      // 3. 新規追加ファイル（untracked files）
      try {
        const { stdout: untrackedFiles } = await execAsync(
          `git -C "${worktreePath}" ls-files --others --exclude-standard 2>/dev/null || true`,
        );
        if (untrackedFiles.trim()) {
          for (const filePath of untrackedFiles.trim().split("\n")) {
            if (filePath && !changes.has(filePath)) {
              changes.set(filePath, "A");
            }
          }
        }
      } catch {
        // untrackedファイルの取得に失敗しても続行
      }

      return Array.from(changes.entries())
        .map(([filePath, status]) => ({ path: filePath, status }))
        .filter((item) => item.path !== "");
    } catch (error) {
      logger.warn("Failed to get worktree changes", { worktreePath, baseCommit, error });
      return [];
    }
  }

  /**
   * git diff出力をパースしてMapに追加
   */
  private parseGitDiffOutput(output: string, changes: Map<string, FileChangeStatus>): void {
    if (!output.trim()) return;

    for (const line of output.trim().split("\n")) {
      const parts = line.split("\t");
      const statusCode = parts[0];
      const filePath = parts[1] || "";
      if (!filePath) continue;

      let status: FileChangeStatus;
      switch (statusCode) {
        case "A":
          status = "A";
          break;
        case "M":
          status = "M";
          break;
        case "D":
          status = "D";
          break;
        default:
          status = "M"; // その他はMとして扱う
      }
      // 既存のエントリがあれば上書きしない（最初の検出を優先）
      if (!changes.has(filePath)) {
        changes.set(filePath, status);
      }
    }
  }
}

import { FormattingHelpers } from "../utils/formatting-helpers.js";
import { logger } from "../utils/logger.js";

/**
 * Executor共通処理のヘルパークラス（Composition用）
 *
 * IAgentExecutorインターフェースは変更せず、共通処理のみ提供します。
 * 各ExecutorクラスはこのHelperを保持し、共通機能を委譲できます。
 *
 * @example
 * ```typescript
 * export class CodexAgentExecutor implements IAgentExecutor {
 *   private helper = new BaseExecutorHelper("codex-task");
 *
 *   async *executeTask(request, options) {
 *     const taskId = options.taskId || this.helper.generateTaskId();
 *     const abortController = new AbortController();
 *     this.helper.trackTask(taskId, abortController);
 *     try {
 *       // ... task execution
 *     } finally {
 *       this.helper.untrackTask(taskId);
 *     }
 *   }
 *
 *   async cancelTask(taskId: string): Promise<void> {
 *     if (await this.helper.cancelTrackedTask(taskId)) {
 *       logger.debug("Task cancelled", { taskId });
 *     }
 *   }
 * }
 * ```
 */
export class BaseExecutorHelper {
  protected runningTasks = new Map<string, AbortController>();

  /**
   * @param prefix - タスクIDのプレフィックス（例: "task", "codex-task"）
   */
  constructor(private prefix: string) {}

  /**
   * タスクIDを生成
   *
   * @returns 一意なタスクID
   *
   * @example
   * ```typescript
   * const helper = new BaseExecutorHelper("codex-task");
   * const taskId = helper.generateTaskId(); // "codex-task-1699..."
   * ```
   */
  generateTaskId(): string {
    return FormattingHelpers.generateTaskId(this.prefix);
  }

  /**
   * タスクを追跡対象に追加
   *
   * @param taskId - タスクID
   * @param controller - AbortController
   *
   * @example
   * ```typescript
   * const taskId = "task-123";
   * const controller = new AbortController();
   * helper.trackTask(taskId, controller);
   * ```
   */
  trackTask(taskId: string, controller: AbortController): void {
    this.runningTasks.set(taskId, controller);
    logger.debug(`Task tracked: ${taskId}`, { prefix: this.prefix });
  }

  /**
   * タスクを追跡対象から削除
   *
   * @param taskId - タスクID
   *
   * @example
   * ```typescript
   * helper.untrackTask("task-123");
   * ```
   */
  untrackTask(taskId: string): void {
    this.runningTasks.delete(taskId);
    logger.debug(`Task untracked: ${taskId}`, { prefix: this.prefix });
  }

  /**
   * タスクがキャンセル可能かチェック
   *
   * @param taskId - タスクID
   * @returns キャンセル可能な場合true
   *
   * @example
   * ```typescript
   * if (helper.isTaskCancellable("task-123")) {
   *   // Task can be cancelled
   * }
   * ```
   */
  isTaskCancellable(taskId: string): boolean {
    return this.runningTasks.has(taskId);
  }

  /**
   * タスクをキャンセル
   *
   * AbortControllerのabort()を呼び出し、タスクを追跡対象から削除します。
   *
   * @param taskId - タスクID
   * @returns キャンセル成功した場合true、タスクが見つからない場合false
   *
   * @example
   * ```typescript
   * const cancelled = await helper.cancelTrackedTask("task-123");
   * if (cancelled) {
   *   console.log("Task cancelled successfully");
   * } else {
   *   console.log("Task not found");
   * }
   * ```
   */
  async cancelTrackedTask(taskId: string): Promise<boolean> {
    const controller = this.runningTasks.get(taskId);
    if (controller) {
      logger.debug(`Cancelling task: ${taskId}`, { prefix: this.prefix });
      controller.abort();
      this.untrackTask(taskId);
      return true;
    }
    logger.debug(`Task not found for cancellation: ${taskId}`, { prefix: this.prefix });
    return false;
  }

  /**
   * 実行中のタスク数を取得
   *
   * @returns 実行中のタスク数
   *
   * @example
   * ```typescript
   * const count = helper.getRunningTaskCount();
   * console.log(`${count} tasks running`);
   * ```
   */
  getRunningTaskCount(): number {
    return this.runningTasks.size;
  }

  /**
   * 実行中のタスクIDリストを取得
   *
   * @returns タスクIDの配列
   *
   * @example
   * ```typescript
   * const taskIds = helper.getRunningTaskIds();
   * console.log(`Running tasks: ${taskIds.join(", ")}`);
   * ```
   */
  getRunningTaskIds(): string[] {
    return Array.from(this.runningTasks.keys());
  }
}

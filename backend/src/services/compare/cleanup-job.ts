/**
 * Worktreeクリーンアップジョブ
 *
 * 定期的に期限切れのworktreeをクリーンアップする
 */

import { logger } from "../../utils/logger.js";
import type { CompareService } from "./compare-service.js";

const DEFAULT_CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1時間

/**
 * Worktreeクリーンアップジョブ
 */
export class CompareCleanupJob {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(
    private compareService: CompareService,
    private intervalMs: number = DEFAULT_CLEANUP_INTERVAL_MS,
  ) {}

  /**
   * クリーンアップジョブを開始
   */
  start(): void {
    if (this.intervalId) {
      logger.warn("Compare cleanup job is already running");
      return;
    }

    logger.info("Starting compare cleanup job", {
      intervalMs: this.intervalMs,
    });

    // 初回実行
    this.runCleanup();

    // 定期実行
    this.intervalId = setInterval(() => {
      this.runCleanup();
    }, this.intervalMs);
  }

  /**
   * クリーンアップジョブを停止
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info("Compare cleanup job stopped");
    }
  }

  /**
   * クリーンアップを実行
   */
  private async runCleanup(): Promise<void> {
    if (this.isRunning) {
      logger.debug("Compare cleanup is already running, skipping");
      return;
    }

    this.isRunning = true;

    try {
      logger.debug("Running compare worktree cleanup");
      await this.compareService.cleanupExpiredWorktrees();
      logger.debug("Compare worktree cleanup completed");
    } catch (error) {
      logger.error("Compare worktree cleanup failed", { error });
    } finally {
      this.isRunning = false;
    }
  }
}

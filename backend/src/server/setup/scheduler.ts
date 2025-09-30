import type { SchedulerService } from "../../services/scheduler-service";
import type { TaskQueueImpl } from "../../queue";
import { logger } from "../../utils/logger";

/**
 * Set up scheduler service with task queue integration
 * @param schedulerService Scheduler service instance
 * @param taskQueue Task queue instance
 */
export function setupScheduler(schedulerService: SchedulerService, taskQueue: TaskQueueImpl): void {
  // 各スケジュールのセッション実行回数を追跡
  const sessionExecutionCounts = new Map<string, number>();

  // Set up scheduler execution handler
  schedulerService.setOnExecuteHandler(async (taskRequest, scheduleId) => {
    // セッション実行回数を取得・更新
    const currentCount = sessionExecutionCounts.get(scheduleId) || 0;
    const maxSessionExecutions = taskRequest.options?.sdk?.maxSessionExecutions || 100;
    const shouldResetSession = currentCount >= maxSessionExecutions;

    // リセットした場合はカウントをリセット、そうでなければインクリメント
    if (shouldResetSession) {
      sessionExecutionCounts.set(scheduleId, 1);
      logger.info(`Resetting session for schedule ${scheduleId} after ${currentCount} executions`);
    } else {
      sessionExecutionCounts.set(scheduleId, currentCount + 1);
    }

    logger.info("Executing scheduled task", {
      scheduleId,
      sessionCount: currentCount,
      willResetSession: shouldResetSession,
    });

    // Ensure scheduled tasks have proper permissions for automation
    const enhancedTaskRequest = {
      ...taskRequest,
      options: {
        ...taskRequest.options,
        sdk: {
          ...taskRequest.options?.sdk,
          // Use bypassPermissions for scheduled tasks to allow all operations
          permissionMode: "bypassPermissions" as const,
          // セッション継続を制御（リセット時はfalse）
          continueSession:
            !shouldResetSession && (taskRequest.options?.sdk?.continueSession ?? true),
        },
      },
    };

    const taskId = taskQueue.add(enhancedTaskRequest, 0);
    return { taskId };
  });
}

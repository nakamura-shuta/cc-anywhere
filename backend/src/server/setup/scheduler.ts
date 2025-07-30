import type { SchedulerService } from "../../services/scheduler-service";
import type { TaskQueueImpl } from "../../queue";
import { logger } from "../../utils/logger";

/**
 * Set up scheduler service with task queue integration
 * @param schedulerService Scheduler service instance
 * @param taskQueue Task queue instance
 */
export function setupScheduler(schedulerService: SchedulerService, taskQueue: TaskQueueImpl): void {
  // Set up scheduler execution handler
  schedulerService.setOnExecuteHandler(async (taskRequest, scheduleId) => {
    logger.info("Executing scheduled task", { scheduleId });
    const taskId = taskQueue.add(taskRequest, 0);
    return { taskId };
  });
}

import { randomUUID } from "crypto";
import * as cronParser from "cron-parser";
import { CronJob } from "cron";
import { logger } from "../utils/logger.js";
import type {
  ScheduledTask,
  ScheduledTaskHistory,
  ScheduleListOptions,
  ScheduleListResponse,
} from "../types/scheduled-task.js";
import type { TaskRequest } from "../claude/types.js";

export type ExecuteHandler = (
  taskRequest: TaskRequest,
  scheduleId: string,
) => Promise<{ taskId: string } | void>;

export class SchedulerService {
  private schedules: Map<string, ScheduledTask> = new Map();
  private cronJobs: Map<string, CronJob> = new Map();
  private onExecute?: ExecuteHandler;
  private running = false;

  constructor() {
    logger.info("SchedulerService initialized");
  }

  /**
   * Create a new schedule
   */
  createSchedule(schedule: Omit<ScheduledTask, "id" | "history">): ScheduledTask {
    // Validate cron expression if type is cron
    if (schedule.schedule.type === "cron") {
      if (!schedule.schedule.expression) {
        throw new Error("Cron expression is required for cron type schedule");
      }
      try {
        cronParser.CronExpressionParser.parse(schedule.schedule.expression);
      } catch (error) {
        throw new Error("Invalid cron expression");
      }
    }

    // Validate executeAt for one-time schedule
    if (schedule.schedule.type === "once") {
      if (!schedule.schedule.executeAt) {
        throw new Error("executeAt is required for one-time schedule");
      }
      if (schedule.schedule.executeAt < new Date()) {
        throw new Error("executeAt must be in the future");
      }
    }

    const id = randomUUID();
    const newSchedule: ScheduledTask = {
      ...schedule,
      id,
      history: [],
      metadata: {
        ...schedule.metadata,
        nextExecuteAt: this.calculateNextExecuteTime(schedule.schedule),
      },
    };

    this.schedules.set(id, newSchedule);

    // Start cron job if service is running and schedule is active
    if (this.running && newSchedule.status === "active") {
      this.startScheduleJob(newSchedule);
    }

    logger.info("Schedule created", { id, name: newSchedule.name });
    return newSchedule;
  }

  /**
   * Get schedule by ID
   */
  getSchedule(id: string): ScheduledTask | undefined {
    return this.schedules.get(id);
  }

  /**
   * Update schedule
   */
  updateSchedule(
    id: string,
    updates: Partial<Omit<ScheduledTask, "id" | "history">>,
  ): ScheduledTask | undefined {
    const schedule = this.schedules.get(id);
    if (!schedule) {
      return undefined;
    }

    // Stop existing cron job
    this.stopScheduleJob(id);

    // Update schedule
    const updated: ScheduledTask = {
      ...schedule,
      ...updates,
      metadata: {
        ...schedule.metadata,
        ...updates.metadata,
        updatedAt: new Date(),
      },
    };

    // Recalculate next execute time if schedule changed
    if (updates.schedule) {
      updated.schedule = { ...schedule.schedule, ...updates.schedule };
      updated.metadata.nextExecuteAt = this.calculateNextExecuteTime(updated.schedule);
    }

    this.schedules.set(id, updated);

    // Restart job if active and running
    if (this.running && updated.status === "active") {
      this.startScheduleJob(updated);
    }

    logger.info("Schedule updated", { id });
    return updated;
  }

  /**
   * Delete schedule
   */
  deleteSchedule(id: string): boolean {
    const schedule = this.schedules.get(id);
    if (!schedule) {
      return false;
    }

    this.stopScheduleJob(id);
    this.schedules.delete(id);
    logger.info("Schedule deleted", { id });
    return true;
  }

  /**
   * List schedules with pagination
   */
  listSchedules(options: ScheduleListOptions = {}): ScheduleListResponse {
    const { limit = 10, offset = 0, status } = options;

    let schedules = Array.from(this.schedules.values());

    // Filter by status if provided
    if (status) {
      schedules = schedules.filter((s) => s.status === status);
    }

    // Sort by createdAt desc
    schedules.sort((a, b) => b.metadata.createdAt.getTime() - a.metadata.createdAt.getTime());

    const total = schedules.length;
    const paginated = schedules.slice(offset, offset + limit);

    return {
      schedules: paginated,
      total,
    };
  }

  /**
   * Enable schedule
   */
  enableSchedule(id: string): ScheduledTask | undefined {
    return this.updateSchedule(id, { status: "active" });
  }

  /**
   * Disable schedule
   */
  disableSchedule(id: string): ScheduledTask | undefined {
    return this.updateSchedule(id, { status: "inactive" });
  }

  /**
   * Get execution history for a schedule
   */
  getHistory(scheduleId: string): ScheduledTaskHistory[] {
    const schedule = this.schedules.get(scheduleId);
    return schedule?.history || [];
  }

  /**
   * Set the handler for task execution
   */
  setOnExecuteHandler(handler: ExecuteHandler): void {
    this.onExecute = handler;
  }

  /**
   * Start the scheduler service
   */
  start(): void {
    if (this.running) {
      return;
    }

    this.running = true;
    logger.info("SchedulerService started");

    // Start all active schedules
    for (const schedule of this.schedules.values()) {
      if (schedule.status === "active") {
        this.startScheduleJob(schedule);
      }
    }
  }

  /**
   * Stop the scheduler service
   */
  stop(): void {
    if (!this.running) {
      return;
    }

    this.running = false;

    // Stop all cron jobs
    for (const [id, job] of this.cronJobs) {
      (job as any).stop();
      logger.debug("Cron job stopped", { scheduleId: id });
    }
    this.cronJobs.clear();

    logger.info("SchedulerService stopped");
  }

  /**
   * Calculate next execution time
   */
  private calculateNextExecuteTime(schedule: ScheduledTask["schedule"]): Date | undefined {
    if (schedule.type === "once") {
      return schedule.executeAt;
    }

    if (schedule.type === "cron" && schedule.expression) {
      try {
        const interval = cronParser.CronExpressionParser.parse(schedule.expression, {
          tz: schedule.timezone,
        });
        return interval.next().toDate();
      } catch (error) {
        logger.error("Failed to calculate next execution time", { error });
        return undefined;
      }
    }

    return undefined;
  }

  /**
   * Start a cron job for a schedule
   */
  private startScheduleJob(schedule: ScheduledTask): void {
    if (schedule.schedule.type === "cron" && schedule.schedule.expression) {
      const job = new CronJob(
        schedule.schedule.expression,
        () => {
          void this.executeSchedule(schedule.id);
        },
        null,
        true,
        schedule.schedule.timezone,
      );

      this.cronJobs.set(schedule.id, job);
      logger.debug("Cron job started", { scheduleId: schedule.id });
    } else if (schedule.schedule.type === "once" && schedule.schedule.executeAt) {
      // For one-time schedules, use setTimeout
      const delay = schedule.schedule.executeAt.getTime() - Date.now();
      if (delay > 0) {
        const timeout = setTimeout(() => {
          void this.executeSchedule(schedule.id);
        }, delay);

        // Store as a simple cron job for consistency
        const mockJob = {
          stop: () => clearTimeout(timeout),
        } as CronJob;
        this.cronJobs.set(schedule.id, mockJob);
        logger.debug("One-time job scheduled", { scheduleId: schedule.id, delay });
      }
    }
  }

  /**
   * Stop a cron job for a schedule
   */
  private stopScheduleJob(scheduleId: string): void {
    const job = this.cronJobs.get(scheduleId);
    if (job) {
      (job as any).stop();
      this.cronJobs.delete(scheduleId);
      logger.debug("Job stopped", { scheduleId });
    }
  }

  /**
   * Execute a scheduled task
   */
  private async executeSchedule(scheduleId: string): Promise<void> {
    const schedule = this.schedules.get(scheduleId);
    if (!schedule || schedule.status !== "active") {
      return;
    }

    logger.info("Executing scheduled task", { scheduleId, name: schedule.name });

    const executedAt = new Date();
    let taskId: string | undefined;
    let status: "success" | "failure" = "success";
    let error: string | undefined;

    try {
      if (this.onExecute) {
        const result = await this.onExecute(schedule.taskRequest, scheduleId);
        taskId = result?.taskId || `exec-${randomUUID()}`;
      } else {
        logger.warn("No execute handler set for scheduler");
        taskId = `no-handler-${randomUUID()}`;
      }
    } catch (err) {
      status = "failure";
      error = err instanceof Error ? err.message : String(err);
      logger.error("Failed to execute scheduled task", { scheduleId, error });
    }

    // Update schedule metadata
    const updatedSchedule: ScheduledTask = {
      ...schedule,
      metadata: {
        ...schedule.metadata,
        lastExecutedAt: executedAt,
        executionCount: schedule.metadata.executionCount + 1,
        updatedAt: new Date(),
      },
    };

    // Add to history
    const historyEntry: ScheduledTaskHistory = {
      executedAt,
      taskId: taskId || `failed-${randomUUID()}`,
      status,
      error,
    };
    updatedSchedule.history = [...schedule.history, historyEntry].slice(-100); // Keep last 100

    // For one-time schedules, mark as completed
    if (schedule.schedule.type === "once") {
      updatedSchedule.status = status === "success" ? "completed" : "failed";
      this.stopScheduleJob(scheduleId);
    } else {
      // Calculate next execution time for cron schedules
      updatedSchedule.metadata.nextExecuteAt = this.calculateNextExecuteTime(schedule.schedule);
    }

    this.schedules.set(scheduleId, updatedSchedule);
    logger.info("Scheduled task execution completed", {
      scheduleId,
      taskId,
      status,
      executionCount: updatedSchedule.metadata.executionCount,
    });
  }
}

import { randomUUID } from "crypto";
import * as cronParser from "cron-parser";
import { CronJob } from "cron";
import { logger } from "../utils/logger.js";
import type {
  ScheduledTask,
  ScheduledTaskHistory,
  ScheduleListOptions,
  ScheduleListResponse,
  ScheduleFilter,
  PersistentScheduledTaskHistory,
} from "../types/scheduled-task.js";
import type { TaskRequest } from "../claude/types.js";
import type { WebSocketServer } from "../websocket/websocket-server.js";
import type { ScheduleRepository } from "../repositories/schedule-repository.js";

export type ExecuteHandler = (
  taskRequest: TaskRequest,
  scheduleId: string,
) => Promise<{ taskId: string } | void>;

export class SchedulerService {
  private schedules: Map<string, ScheduledTask> = new Map();
  private cronJobs: Map<string, CronJob> = new Map();
  private onExecute?: ExecuteHandler;
  private running = false;
  private wsServer?: WebSocketServer;
  private repository?: ScheduleRepository;

  constructor(wsServer?: WebSocketServer, repository?: ScheduleRepository) {
    this.wsServer = wsServer;
    this.repository = repository;
    logger.info("SchedulerService initialized", { withPersistence: !!repository });
  }

  /**
   * Create a new schedule
   */
  async createSchedule(schedule: Omit<ScheduledTask, "id" | "history">): Promise<ScheduledTask> {
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

    // Persist to database if repository is available
    if (this.repository) {
      await this.repository.create(newSchedule);
      logger.debug("Schedule persisted to database", { id });
    }

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
   * Get schedule by ID (async version with database fallback)
   */
  async getScheduleAsync(id: string): Promise<ScheduledTask | undefined> {
    // First check in-memory cache
    const cachedSchedule = this.schedules.get(id);
    if (cachedSchedule) {
      return cachedSchedule;
    }

    // Fallback to database if repository is available
    if (this.repository) {
      try {
        const schedule = await this.repository.findById(id);
        if (schedule) {
          schedule.history = await this.loadScheduleHistory(id);
          this.schedules.set(id, schedule); // Cache for future access
          return schedule;
        }
      } catch (error) {
        logger.error("Failed to load schedule from database", { id, error });
      }
    }

    return undefined;
  }

  /**
   * Update schedule
   */
  async updateSchedule(
    id: string,
    updates: Partial<Omit<ScheduledTask, "id" | "history">>,
  ): Promise<ScheduledTask | undefined> {
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

    // Persist to database if repository is available
    if (this.repository) {
      await this.repository.update(id, updated);
      logger.debug("Schedule update persisted to database", { id });
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
  async deleteSchedule(id: string): Promise<boolean> {
    const schedule = this.schedules.get(id);
    if (!schedule) {
      return false;
    }

    this.stopScheduleJob(id);
    this.schedules.delete(id);

    // Delete from database if repository is available
    if (this.repository) {
      await this.repository.delete(id);
      logger.debug("Schedule deleted from database", { id });
    }

    logger.info("Schedule deleted", { id });
    return true;
  }

  /**
   * List schedules with pagination
   */
  async listSchedules(options: ScheduleListOptions = {}): Promise<ScheduleListResponse> {
    // Use repository for listing if available, otherwise fallback to in-memory
    if (this.repository) {
      const filter: ScheduleFilter = {
        status: options.status,
        limit: options.limit || 10,
        offset: options.offset || 0,
      };
      const schedules = await this.repository.findWithFilter(filter);

      // Load history for each schedule
      for (const schedule of schedules) {
        schedule.history = await this.loadScheduleHistory(schedule.id);
      }

      // Get total count
      const totalFilter: ScheduleFilter = { status: options.status };
      const allSchedules = await this.repository.findWithFilter(totalFilter);

      return {
        schedules,
        total: allSchedules.length,
      };
    }

    // Fallback to in-memory
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
  async enableSchedule(id: string): Promise<ScheduledTask | undefined> {
    return this.updateSchedule(id, { status: "active" });
  }

  /**
   * Disable schedule
   */
  async disableSchedule(id: string): Promise<ScheduledTask | undefined> {
    return this.updateSchedule(id, { status: "inactive" });
  }

  /**
   * Get execution history for a schedule
   */
  async getHistory(scheduleId: string): Promise<ScheduledTaskHistory[]> {
    return this.loadScheduleHistory(scheduleId);
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
  async start(): Promise<void> {
    if (this.running) {
      return;
    }

    this.running = true;
    logger.info("SchedulerService started");

    // Load schedules from database if repository is available
    if (this.repository) {
      await this.loadPersistedSchedules();
    }

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

    // セッション実行回数を管理 - データベースから取得
    let currentCount = 0;
    if (this.repository) {
      try {
        const sessionState = await this.repository.getSessionState(scheduleId);
        currentCount = sessionState.executionCount;
      } catch (error) {
        logger.error("Failed to get session state", { scheduleId, error });
      }
    }

    const maxSessionExecutions = schedule.taskRequest.options?.sdk?.maxSessionExecutions || 100;
    const shouldResetSession = currentCount >= maxSessionExecutions;

    // セッションリセットの場合はカウントをリセット
    if (shouldResetSession && this.repository) {
      try {
        await this.repository.resetExecutionCount(scheduleId);
        logger.info(`Session reset for schedule ${scheduleId} after ${currentCount} executions`);
        currentCount = 0; // リセット後は0からスタート
      } catch (error) {
        logger.error("Failed to reset session execution count", { scheduleId, error });
      }
    }

    logger.info("Executing scheduled task", {
      scheduleId,
      name: schedule.name,
      sessionCount: currentCount,
      willResetSession: shouldResetSession,
    });

    const executedAt = new Date();
    let taskId: string | undefined;
    let status: "success" | "failure" = "success";
    let error: string | undefined;

    // Broadcast execution start
    this.wsServer?.broadcastScheduleExecution({
      scheduleId,
      taskId: "", // Task ID not yet available
      status: "started",
      timestamp: executedAt.toISOString(),
    });

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

    // Persist history entry to database
    await this.persistHistoryEntry(scheduleId, historyEntry);

    // Update session state in database
    if (this.repository) {
      try {
        await this.repository.incrementExecutionCount(scheduleId);
        logger.debug("Session execution count incremented", { scheduleId });
      } catch (error) {
        logger.error("Failed to update session execution count", { scheduleId, error });
      }
    }

    // For one-time schedules, mark as completed
    if (schedule.schedule.type === "once") {
      updatedSchedule.status = status === "success" ? "completed" : "failed";
      this.stopScheduleJob(scheduleId);
    } else {
      // Calculate next execution time for cron schedules
      updatedSchedule.metadata.nextExecuteAt = this.calculateNextExecuteTime(schedule.schedule);
    }

    // Persist schedule updates to database
    if (this.repository) {
      try {
        await this.repository.update(scheduleId, updatedSchedule);
        logger.debug("Schedule state persisted after execution", { scheduleId });
      } catch (error) {
        logger.error("Failed to persist schedule state", { scheduleId, error });
      }
    }

    this.schedules.set(scheduleId, updatedSchedule);

    // Broadcast execution completion
    this.wsServer?.broadcastScheduleExecution({
      scheduleId,
      taskId: taskId || "",
      status: status === "success" ? "completed" : "failed",
      error,
      timestamp: new Date().toISOString(),
    });

    // Broadcast schedule update
    this.wsServer?.broadcastScheduleUpdate({
      scheduleId,
      status: updatedSchedule.status,
      metadata: {
        lastExecutedAt: updatedSchedule.metadata.lastExecutedAt,
        nextExecuteAt: updatedSchedule.metadata.nextExecuteAt,
        executionCount: updatedSchedule.metadata.executionCount,
      },
      timestamp: new Date().toISOString(),
    });

    logger.info("Scheduled task execution completed", {
      scheduleId,
      taskId,
      status,
      executionCount: updatedSchedule.metadata.executionCount,
    });
  }

  /**
   * Load persisted schedules from database
   */
  private async loadPersistedSchedules(): Promise<void> {
    if (!this.repository) {
      return;
    }

    try {
      const schedules = await this.repository.findWithFilter({});
      logger.info(`Loading ${schedules.length} persisted schedules`);

      for (const schedule of schedules) {
        // Load history for the schedule
        schedule.history = await this.loadScheduleHistory(schedule.id);
        this.schedules.set(schedule.id, schedule);
        logger.debug("Loaded persisted schedule", { id: schedule.id, name: schedule.name });
      }

      logger.info("Persisted schedules loaded successfully");
    } catch (error) {
      logger.error("Failed to load persisted schedules", { error });
    }
  }

  /**
   * Load history for a specific schedule
   */
  private async loadScheduleHistory(scheduleId: string): Promise<ScheduledTaskHistory[]> {
    if (!this.repository) {
      const schedule = this.schedules.get(scheduleId);
      return schedule?.history || [];
    }

    try {
      const persistentHistory = await this.repository.getHistory(scheduleId);
      return persistentHistory.map((entry) => ({
        executedAt: entry.executedAt,
        taskId: entry.taskId,
        status: entry.status,
        error: entry.error,
      }));
    } catch (error) {
      logger.error("Failed to load schedule history", { scheduleId, error });
      return [];
    }
  }

  /**
   * Persist history entry to database
   */
  private async persistHistoryEntry(
    scheduleId: string,
    history: ScheduledTaskHistory,
  ): Promise<void> {
    if (!this.repository) {
      return;
    }

    try {
      const entry: Omit<PersistentScheduledTaskHistory, "id" | "createdAt"> = {
        scheduleId,
        executedAt: history.executedAt,
        taskId: history.taskId,
        status: history.status,
        error: history.error,
      };
      await this.repository.addHistory(entry);
      logger.debug("History entry persisted", { scheduleId, taskId: history.taskId });
    } catch (error) {
      logger.error("Failed to persist history entry", { scheduleId, error });
    }
  }
}

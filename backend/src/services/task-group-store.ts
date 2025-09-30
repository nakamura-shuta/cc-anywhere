import type { TaskGroup, TaskGroupResult, GroupStatus } from "../types/task-groups";
import { EventEmitter } from "events";
import type { WebSocketServer } from "../websocket/websocket-server";
import { TaskGroupHistoryRepository } from "../repositories/task-group-history-repository.js";
import { getDatabaseInstance } from "../db/shared-instance.js";
import { logger } from "../utils/logger.js";

export interface TaskGroupExecutionRecord {
  id: string;
  group: TaskGroup;
  result: TaskGroupResult;
  startedAt: Date;
  updatedAt: Date;
  progress: {
    completed: number;
    total: number;
    percentage: number;
  };
  currentTask?: string;
}

/**
 * In-memory store for task group execution state
 */
export class TaskGroupStore extends EventEmitter {
  private groups: Map<string, TaskGroupExecutionRecord> = new Map();
  private static instance: TaskGroupStore;
  private wsServer?: WebSocketServer;
  private historyRepository: TaskGroupHistoryRepository;

  constructor() {
    super();
    const db = getDatabaseInstance();
    this.historyRepository = new TaskGroupHistoryRepository(db);
    this.loadRecentHistory();
  }

  static getInstance(): TaskGroupStore {
    if (!TaskGroupStore.instance) {
      TaskGroupStore.instance = new TaskGroupStore();
    }
    return TaskGroupStore.instance;
  }

  /**
   * Load recent task groups from database on startup
   */
  private async loadRecentHistory(): Promise<void> {
    try {
      // Load recent task groups (last 24 hours) from database
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);

      const recentGroups = await this.historyRepository.findWithFilter({
        startedAfter: oneDayAgo,
        limit: 100,
      });

      // Convert database records to in-memory format
      for (const dbRecord of recentGroups) {
        const fullRecord = await this.historyRepository.findByIdWithTasks(dbRecord.id);
        if (!fullRecord) continue;

        const record: TaskGroupExecutionRecord = {
          id: fullRecord.id,
          group: {
            id: fullRecord.id,
            name: fullRecord.name,
            description: fullRecord.description,
            tasks: fullRecord.tasks.map((t) => ({
              id: t.id,
              name: t.name,
              instruction: t.instruction,
              dependencies: t.dependencies,
              context: t.context,
              options: t.options,
            })),
            execution: {
              mode: fullRecord.executionMode as "sequential" | "parallel" | "mixed",
              continueSession: true,
              maxParallel: fullRecord.maxParallel,
            },
          },
          result: {
            groupId: fullRecord.id,
            status: fullRecord.status,
            sessionId: fullRecord.sessionId,
            totalTasks: fullRecord.progressTotal,
            completedTasks: fullRecord.progressCompleted,
            progress: fullRecord.progressPercentage,
            tasks: fullRecord.tasks.map((t) => ({
              id: t.id,
              name: t.name,
              status: t.status,
              result: t.result,
              error: t.error,
              startedAt: t.startedAt,
              completedAt: t.completedAt,
            })),
            startedAt: fullRecord.startedAt,
            completedAt: fullRecord.completedAt,
            error: fullRecord.error,
          },
          startedAt: fullRecord.startedAt,
          updatedAt: fullRecord.updatedAt,
          progress: {
            completed: fullRecord.progressCompleted,
            total: fullRecord.progressTotal,
            percentage: fullRecord.progressPercentage,
          },
          currentTask: fullRecord.currentTask,
        };

        this.groups.set(record.id, record);
      }

      logger.info(`Loaded ${recentGroups.length} recent task groups from database`);
    } catch (error) {
      logger.error("Failed to load task group history from database", { error });
    }
  }

  /**
   * Set WebSocket server for broadcasting events
   */
  setWebSocketServer(wsServer: WebSocketServer): void {
    this.wsServer = wsServer;
  }

  /**
   * Store a new task group execution
   */
  store(group: TaskGroup, initialResult: TaskGroupResult): string {
    const record: TaskGroupExecutionRecord = {
      id: initialResult.groupId,
      group,
      result: initialResult,
      startedAt: new Date(),
      updatedAt: new Date(),
      progress: {
        completed: 0,
        total: group.tasks.length,
        percentage: 0,
      },
    };

    this.groups.set(record.id, record);
    this.emit("group:created", record);

    // Save to database asynchronously (non-blocking)
    this.historyRepository.saveTaskGroup(group, initialResult).catch((error) => {
      logger.error("Failed to save task group to database", { groupId: record.id, error });
    });

    // Broadcast via WebSocket
    if (this.wsServer) {
      this.wsServer.broadcastTaskGroupCreated({
        groupId: record.id,
        name: group.name,
        totalTasks: group.tasks.length,
        executionMode: group.execution.mode,
        timestamp: new Date().toISOString(),
      });
    }

    return record.id;
  }

  /**
   * Update task group execution status
   */
  updateStatus(groupId: string, status: GroupStatus, error?: string): void {
    const record = this.groups.get(groupId);
    if (!record) return;

    record.result.status = status;
    if (error) {
      record.result.error = error;
    }
    record.updatedAt = new Date();

    this.emit("group:status", record);

    // Update in database asynchronously
    this.historyRepository.updateGroupStatus(groupId, status, error).catch((err) => {
      logger.error("Failed to update task group status in database", {
        groupId,
        status,
        error: err,
      });
    });

    // Broadcast via WebSocket
    if (this.wsServer) {
      this.wsServer.broadcastTaskGroupStatus({
        groupId,
        status,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Update session ID for task group
   */
  updateSessionId(groupId: string, sessionId: string | undefined): void {
    const record = this.groups.get(groupId);
    if (!record) return;

    record.result.sessionId = sessionId;
    record.updatedAt = new Date();

    // Don't broadcast here - let updateTaskProgress handle the broadcasting
    // to avoid duplicate messages with inconsistent state
  }

  /**
   * Update task progress
   */
  updateTaskProgress(
    groupId: string,
    taskId: string,
    status: "pending" | "running" | "completed" | "failed",
  ): void {
    const record = this.groups.get(groupId);
    if (!record) return;

    const taskResult = record.result.tasks.find((t) => t.id === taskId);
    if (taskResult) {
      taskResult.status = status;

      // Update current task
      if (status === "running") {
        record.currentTask = record.group.tasks.find((t) => t.id === taskId)?.name || taskId;
      }

      // Calculate progress
      const completedCount = record.result.tasks.filter(
        (t) => t.status === "completed" || t.status === "failed",
      ).length;

      record.progress = {
        completed: completedCount,
        total: record.group.tasks.length,
        percentage: Math.round((completedCount / record.group.tasks.length) * 100),
      };

      record.updatedAt = new Date();

      this.emit("group:progress", record);

      // Update task status and progress in database
      Promise.all([
        this.historyRepository.updateTaskStatus(taskId, status),
        this.historyRepository.updateProgress(
          groupId,
          record.progress.completed,
          record.progress.total,
          record.currentTask,
        ),
      ]).catch((err) => {
        logger.error("Failed to update task progress in database", {
          groupId,
          taskId,
          status,
          error: err,
        });
      });

      // Broadcast via WebSocket with full task status information
      if (this.wsServer) {
        this.wsServer.broadcastTaskGroupProgress({
          groupId,
          completedTasks: completedCount,
          totalTasks: record.group.tasks.length,
          progress: record.progress.percentage,
          currentTask: record.currentTask,
          timestamp: new Date().toISOString(),
        });

        // Also broadcast detailed status update with task information
        this.wsServer.broadcastTaskGroupStatus({
          groupId,
          status: record.result.status,
          sessionId: record.result.sessionId,
          tasks: record.result.tasks,
          timestamp: new Date().toISOString(),
        });
      }
    }
  }

  /**
   * Update task result
   */
  updateTaskResult(groupId: string, taskId: string, result: any, error?: string): void {
    const record = this.groups.get(groupId);
    if (!record) return;

    const taskResult = record.result.tasks.find((t) => t.id === taskId);
    if (taskResult) {
      taskResult.result = result;
      if (error) {
        taskResult.error = error;
      }
      taskResult.completedAt = new Date();

      record.updatedAt = new Date();
      this.emit("group:task-completed", record, taskId);

      // Update task result in database
      this.historyRepository
        .updateTaskStatus(taskId, taskResult.status, result, error)
        .catch((err) => {
          logger.error("Failed to update task result in database", { groupId, taskId, error: err });
        });

      // Broadcast via WebSocket
      if (this.wsServer) {
        this.wsServer.broadcastTaskGroupTaskCompleted({
          groupId,
          taskId,
          status: taskResult.status,
          error,
          completedAt: taskResult.completedAt?.toISOString() || new Date().toISOString(),
          timestamp: new Date().toISOString(),
        });
      }
    }
  }

  /**
   * Get task group by ID
   */
  get(groupId: string): TaskGroupExecutionRecord | undefined {
    return this.groups.get(groupId);
  }

  /**
   * Get all task groups
   */
  getAll(): TaskGroupExecutionRecord[] {
    return Array.from(this.groups.values()).sort(
      (a, b) => b.startedAt.getTime() - a.startedAt.getTime(),
    );
  }

  /**
   * Get task groups by status
   */
  getByStatus(status: GroupStatus): TaskGroupExecutionRecord[] {
    return this.getAll().filter((g) => g.result.status === status);
  }

  /**
   * Delete a task group
   */
  delete(groupId: string): boolean {
    const deleted = this.groups.delete(groupId);
    if (deleted) {
      this.emit("group:deleted", groupId);
    }
    return deleted;
  }

  /**
   * Clear all task groups
   */
  clear(): void {
    this.groups.clear();
    this.emit("group:cleared");
  }

  /**
   * Get summary statistics
   */
  async getStats() {
    // Get stats from database (includes historical data)
    try {
      const dbStats = await this.historyRepository.getStatistics();
      return dbStats;
    } catch (error) {
      logger.error("Failed to get stats from database, falling back to memory", { error });
      // Fallback to memory stats if database fails
      const all = this.getAll();
      return {
        total: all.length,
        pending: all.filter((g) => g.result.status === "pending").length,
        running: all.filter((g) => g.result.status === "running").length,
        completed: all.filter((g) => g.result.status === "completed").length,
        failed: all.filter((g) => g.result.status === "failed").length,
        cancelled: all.filter((g) => g.result.status === "cancelled").length,
      };
    }
  }

  /**
   * Get task group history from database
   */
  async getHistory(filter?: {
    status?: GroupStatus;
    sessionId?: string;
    startedAfter?: Date;
    startedBefore?: Date;
    limit?: number;
    offset?: number;
  }) {
    return this.historyRepository.findWithFilter(filter || {});
  }

  /**
   * Get task group with tasks from database
   */
  async getHistoryById(groupId: string) {
    return this.historyRepository.findByIdWithTasks(groupId);
  }

  /**
   * Get logs for a task group from database
   */
  async getLogsForGroup(groupId: string) {
    return this.historyRepository.getLogsForGroup(groupId);
  }
}

export const taskGroupStore = TaskGroupStore.getInstance();

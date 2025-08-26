import type { TaskGroup, TaskGroupResult, GroupStatus } from "../types/task-groups";
import { EventEmitter } from "events";
import type { WebSocketServer } from "../websocket/websocket-server";

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

  static getInstance(): TaskGroupStore {
    if (!TaskGroupStore.instance) {
      TaskGroupStore.instance = new TaskGroupStore();
    }
    return TaskGroupStore.instance;
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

      // Broadcast via WebSocket
      if (this.wsServer) {
        this.wsServer.broadcastTaskGroupProgress({
          groupId,
          completedTasks: completedCount,
          totalTasks: record.group.tasks.length,
          progress: record.progress.percentage,
          currentTask: record.currentTask,
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
  getStats() {
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

export const taskGroupStore = TaskGroupStore.getInstance();

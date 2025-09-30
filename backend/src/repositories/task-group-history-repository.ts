import type { Database } from "better-sqlite3";
import { BaseRepository } from "./base-repository.js";
import type {
  TaskGroupHistoryRecord,
  TaskGroupTaskRecord,
  TaskGroupFilter,
  TaskGroupStatistics,
  TaskGroupLogRecord,
} from "../types/task-group-history.js";
import type { TaskGroup, TaskGroupResult } from "../types/task-groups.js";
import { logger } from "../utils/logger.js";

export class TaskGroupHistoryRepository extends BaseRepository<TaskGroupHistoryRecord> {
  protected tableName = "task_groups";

  constructor(db: Database) {
    super(db);
  }

  /**
   * Save a complete task group with all its tasks in a transaction
   */
  async saveTaskGroup(group: TaskGroup, result: TaskGroupResult): Promise<TaskGroupHistoryRecord> {
    const transaction = this.db.transaction(() => {
      const groupRecord = this.createGroupRecord(group, result);

      // Insert main task group record
      const groupData = this.serializeEntity(groupRecord);
      const groupColumns = Object.keys(groupData).join(", ");
      const groupPlaceholders = Object.keys(groupData)
        .map(() => "?")
        .join(", ");
      const groupValues = Object.values(groupData);

      const groupStmt = this.db.prepare(
        `INSERT INTO ${this.tableName} (${groupColumns}) VALUES (${groupPlaceholders})`,
      );
      groupStmt.run(...groupValues);

      // Insert task records
      for (let i = 0; i < group.tasks.length; i++) {
        const task = group.tasks[i];
        if (!task) continue; // Skip undefined tasks

        const taskResult = result.tasks.find((t) => t.id === task.id);

        const taskRecord: TaskGroupTaskRecord = {
          id: task.id,
          groupId: result.groupId,
          name: task.name,
          instruction: task.instruction,
          dependencies: task.dependencies,
          context: task.context,
          options: task.options,
          status: taskResult?.status || "pending",
          result: taskResult?.result,
          error: taskResult?.error,
          executionOrder: i,
          startedAt: taskResult?.startedAt,
          completedAt: taskResult?.completedAt,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        const taskData = this.serializeTaskEntity(taskRecord);
        const taskColumns = Object.keys(taskData).join(", ");
        const taskPlaceholders = Object.keys(taskData)
          .map(() => "?")
          .join(", ");
        const taskValues = Object.values(taskData);

        const taskStmt = this.db.prepare(
          `INSERT INTO task_group_tasks (${taskColumns}) VALUES (${taskPlaceholders})`,
        );
        taskStmt.run(...taskValues);
      }

      return groupRecord;
    });

    try {
      const result = transaction();
      const saved = await this.findByIdWithTasks(result.id);
      if (!saved) {
        throw new Error("Failed to retrieve saved task group");
      }
      return saved;
    } catch (error) {
      logger.error("Error saving task group", { groupId: result.groupId, error });
      throw error;
    }
  }

  /**
   * Update task group status and progress
   */
  async updateGroupStatus(
    groupId: string,
    status: TaskGroupHistoryRecord["status"],
    error?: string,
  ): Promise<TaskGroupHistoryRecord | null> {
    const updates: Partial<TaskGroupHistoryRecord> = {
      status,
      updatedAt: new Date(),
    };

    if (error) {
      updates.error = error;
    }

    if (status === "completed" || status === "failed" || status === "cancelled") {
      updates.completedAt = new Date();
    }

    return this.update(groupId, updates);
  }

  /**
   * Update task status and result
   */
  async updateTaskStatus(
    taskId: string,
    status: TaskGroupTaskRecord["status"],
    result?: any,
    error?: string,
  ): Promise<void> {
    const taskData: Record<string, any> = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (result !== undefined) {
      taskData.result = JSON.stringify(result);
    }

    if (error) {
      taskData.error = error;
    }

    if (status === "running") {
      taskData.started_at = new Date().toISOString();
    }

    if (status === "completed" || status === "failed") {
      taskData.completed_at = new Date().toISOString();
    }

    const setClause = Object.keys(taskData)
      .map((key) => `${key} = ?`)
      .join(", ");
    const values = Object.values(taskData);

    const stmt = this.db.prepare(`UPDATE task_group_tasks SET ${setClause} WHERE id = ?`);
    stmt.run(...values, taskId);
  }

  /**
   * Update task group progress
   */
  async updateProgress(
    groupId: string,
    progressCompleted: number,
    progressTotal: number,
    currentTask?: string,
  ): Promise<void> {
    const progressPercentage = Math.round((progressCompleted / progressTotal) * 100);

    const updates: Record<string, any> = {
      progress_completed: progressCompleted,
      progress_total: progressTotal,
      progress_percentage: progressPercentage,
      updated_at: new Date().toISOString(),
    };

    if (currentTask !== undefined) {
      updates.current_task = currentTask;
    }

    const setClause = Object.keys(updates)
      .map((key) => `${key} = ?`)
      .join(", ");
    const values = Object.values(updates);

    const stmt = this.db.prepare(`UPDATE ${this.tableName} SET ${setClause} WHERE id = ?`);
    stmt.run(...values, groupId);
  }

  /**
   * Find task group by ID with all tasks
   */
  async findByIdWithTasks(id: string): Promise<TaskGroupHistoryRecord | null> {
    const group = await this.findById(id);
    if (!group) {
      return null;
    }

    const tasksStmt = this.db.prepare(
      `SELECT * FROM task_group_tasks WHERE group_id = ? ORDER BY execution_order`,
    );
    const taskRows = tasksStmt.all(id);

    group.tasks = taskRows.map((row) => this.mapTaskRowToEntity(row));

    return group;
  }

  /**
   * Find task groups with filters
   */
  async findWithFilter(filter: TaskGroupFilter): Promise<TaskGroupHistoryRecord[]> {
    let query = `SELECT * FROM ${this.tableName} WHERE 1=1`;
    const values: any[] = [];

    if (filter.status) {
      query += " AND status = ?";
      values.push(filter.status);
    }

    if (filter.sessionId) {
      query += " AND session_id = ?";
      values.push(filter.sessionId);
    }

    if (filter.startedAfter) {
      query += " AND started_at >= ?";
      values.push(filter.startedAfter.toISOString());
    }

    if (filter.startedBefore) {
      query += " AND started_at <= ?";
      values.push(filter.startedBefore.toISOString());
    }

    query += " ORDER BY started_at DESC";

    if (filter.limit) {
      query += " LIMIT ?";
      values.push(filter.limit);

      if (filter.offset) {
        query += " OFFSET ?";
        values.push(filter.offset);
      }
    }

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...values);

    return rows.map((row) => this.mapRowToEntity(row));
  }

  /**
   * Get statistics for task groups
   */
  async getStatistics(): Promise<TaskGroupStatistics> {
    const statsQuery = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) as running,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
        AVG(CASE 
          WHEN completed_at IS NOT NULL AND started_at IS NOT NULL 
          THEN (julianday(completed_at) - julianday(started_at)) * 86400000
          ELSE NULL 
        END) as avg_execution_time
      FROM ${this.tableName}
    `;

    const stmt = this.db.prepare(statsQuery);
    const result = stmt.get() as any;

    const total = result.total || 0;
    const completed = result.completed || 0;
    const failed = result.failed || 0;

    return {
      total,
      pending: result.pending || 0,
      running: result.running || 0,
      completed,
      failed,
      cancelled: result.cancelled || 0,
      averageExecutionTime: result.avg_execution_time || undefined,
      successRate: total > 0 ? (completed / (completed + failed)) * 100 : undefined,
    };
  }

  /**
   * Save a log record for a task group
   */
  async saveLog(log: TaskGroupLogRecord): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO task_group_logs (group_id, task_id, task_name, log_message, log_level, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      log.groupId,
      log.taskId,
      log.taskName,
      log.logMessage,
      log.logLevel || "info",
      log.timestamp.toISOString(),
    );
  }

  /**
   * Get logs for a task group
   */
  async getLogsForGroup(groupId: string): Promise<TaskGroupLogRecord[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM task_group_logs 
      WHERE group_id = ? 
      ORDER BY timestamp ASC
    `);

    const rows = stmt.all(groupId);

    return rows.map((row: any) => ({
      id: row.id,
      groupId: row.group_id,
      taskId: row.task_id,
      taskName: row.task_name,
      logMessage: row.log_message,
      logLevel: row.log_level,
      timestamp: new Date(row.timestamp),
    }));
  }

  /**
   * Clean up old task group history
   */
  async cleanupOldHistory(daysToKeep: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const stmt = this.db.prepare(`DELETE FROM ${this.tableName} WHERE created_at < ?`);
    const result = stmt.run(cutoffDate.toISOString());

    return result.changes;
  }

  protected mapRowToEntity(row: any): TaskGroupHistoryRecord {
    return {
      id: row.id,
      name: row.name,
      description: row.description || undefined,
      executionMode: row.execution_mode,
      maxParallel: row.max_parallel || undefined,
      sessionId: row.session_id || undefined,
      status: row.status,
      error: row.error || undefined,
      progressCompleted: row.progress_completed || 0,
      progressTotal: row.progress_total,
      progressPercentage: row.progress_percentage || 0,
      currentTask: row.current_task || undefined,
      startedAt: new Date(row.started_at),
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      tasks: [],
    };
  }

  private mapTaskRowToEntity(row: any): TaskGroupTaskRecord {
    return {
      id: row.id,
      groupId: row.group_id,
      name: row.name,
      instruction: row.instruction,
      dependencies: row.dependencies ? JSON.parse(row.dependencies) : undefined,
      context: row.context ? JSON.parse(row.context) : undefined,
      options: row.options ? JSON.parse(row.options) : undefined,
      status: row.status,
      result: row.result ? JSON.parse(row.result) : undefined,
      error: row.error || undefined,
      executionOrder: row.execution_order,
      startedAt: row.started_at ? new Date(row.started_at) : undefined,
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private createGroupRecord(group: TaskGroup, result: TaskGroupResult): TaskGroupHistoryRecord {
    return {
      id: result.groupId,
      name: group.name,
      description: group.description,
      executionMode: group.execution.mode,
      maxParallel: group.execution.maxParallel,
      sessionId: result.sessionId,
      status: result.status,
      error: result.error,
      progressCompleted: 0,
      progressTotal: group.tasks.length,
      progressPercentage: 0,
      currentTask: undefined,
      startedAt: new Date(),
      completedAt: undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
      tasks: [],
    };
  }

  private serializeTaskEntity(entity: TaskGroupTaskRecord): Record<string, unknown> {
    const data: Record<string, unknown> = {
      id: entity.id,
      group_id: entity.groupId,
      name: entity.name,
      instruction: entity.instruction,
      status: entity.status,
      execution_order: entity.executionOrder,
      created_at: entity.createdAt.toISOString(),
      updated_at: entity.updatedAt.toISOString(),
    };

    if (entity.dependencies) {
      data.dependencies = JSON.stringify(entity.dependencies);
    }

    if (entity.context) {
      data.context = JSON.stringify(entity.context);
    }

    if (entity.options) {
      data.options = JSON.stringify(entity.options);
    }

    if (entity.result !== undefined) {
      data.result = JSON.stringify(entity.result);
    }

    if (entity.error) {
      data.error = entity.error;
    }

    if (entity.startedAt) {
      data.started_at = entity.startedAt.toISOString();
    }

    if (entity.completedAt) {
      data.completed_at = entity.completedAt.toISOString();
    }

    return data;
  }

  protected serializeEntity(entity: Partial<TaskGroupHistoryRecord>): Record<string, unknown> {
    const data: Record<string, unknown> = {};

    if (entity.id !== undefined) data.id = entity.id;
    if (entity.name !== undefined) data.name = entity.name;
    if (entity.description !== undefined) data.description = entity.description;
    if (entity.executionMode !== undefined) data.execution_mode = entity.executionMode;
    if (entity.maxParallel !== undefined) data.max_parallel = entity.maxParallel;
    if (entity.sessionId !== undefined) data.session_id = entity.sessionId;
    if (entity.status !== undefined) data.status = entity.status;
    if (entity.error !== undefined) data.error = entity.error;
    if (entity.progressCompleted !== undefined) data.progress_completed = entity.progressCompleted;
    if (entity.progressTotal !== undefined) data.progress_total = entity.progressTotal;
    if (entity.progressPercentage !== undefined)
      data.progress_percentage = entity.progressPercentage;
    if (entity.currentTask !== undefined) data.current_task = entity.currentTask;
    if (entity.startedAt !== undefined) data.started_at = entity.startedAt.toISOString();
    if (entity.completedAt !== undefined) data.completed_at = entity.completedAt.toISOString();
    if (entity.createdAt !== undefined) data.created_at = entity.createdAt.toISOString();
    if (entity.updatedAt !== undefined) data.updated_at = entity.updatedAt.toISOString();

    return data;
  }
}

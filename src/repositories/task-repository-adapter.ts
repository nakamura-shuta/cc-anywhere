/**
 * Adapter to provide backward compatibility for legacy TaskRepository interface
 */

import type Database from "better-sqlite3";
// Adapter implementation
import type { TaskEntity } from "./types";
import { TaskStatus, type TaskRequest, type TaskResponse } from "../claude/types";
import type { QueuedTask } from "../queue/types";
import type { TaskRecord, TaskFilter, PaginationOptions, PaginatedResult } from "../db/types";

/**
 * TaskRepositoryAdapter provides backward compatibility for legacy code
 * while using the new repository pattern underneath
 */
export class TaskRepositoryAdapter {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  // Legacy method: create
  create(task: {
    id: string;
    instruction: string;
    context?: TaskRequest["context"];
    options?: TaskRequest["options"];
    priority?: number;
    status?: TaskStatus;
    retryMetadata?: TaskResponse["retryMetadata"];
    groupId?: string;
    repositoryName?: string;
    conversationHistory?: any;
  }): TaskRecord {
    const entity: TaskEntity = {
      id: task.id,
      instruction: task.instruction,
      context: task.context || undefined,
      options: task.options || undefined,
      priority: task.priority ?? 0,
      status: task.status || "pending",
      result: undefined,
      error: undefined,
      retryMetadata: task.retryMetadata || undefined,
      groupId: task.groupId || undefined,
      repositoryName: task.repositoryName || undefined,
      conversationHistory: task.conversationHistory || undefined,
      continuedFrom:
        (task.context as any)?.continuedFrom || (task.context as any)?.parentTaskId || undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
      completedAt: undefined,
      startedAt: undefined,
    };

    // For synchronous compatibility, we'll use the db directly
    const stmt = this.db.prepare(`
      INSERT INTO tasks (
        id, instruction, context, options, priority, status, 
        result, error, created_at, updated_at, completed_at, 
        started_at, cancelled_at, retry_count, max_retries,
        retry_metadata, group_id, repository_name, conversation_history, continued_from
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
    `);

    stmt.run(
      entity.id,
      entity.instruction,
      entity.context ? JSON.stringify(entity.context) : null,
      entity.options ? JSON.stringify(entity.options) : null,
      entity.priority,
      entity.status,
      entity.result,
      entity.error ? JSON.stringify(entity.error) : null,
      entity.createdAt.toISOString(),
      entity.updatedAt.toISOString(),
      null,
      null,
      null,
      0, // retryCount
      task.retryMetadata?.maxRetries || task.options?.retry?.maxRetries || 0,
      entity.retryMetadata ? JSON.stringify(entity.retryMetadata) : null,
      entity.groupId || null,
      entity.repositoryName || null,
      entity.conversationHistory ? JSON.stringify(entity.conversationHistory) : null,
      entity.continuedFrom || task.context?.continuedFrom || task.context?.parentTaskId || null,
    );

    return this.entityToRecord(entity);
  }

  // Legacy method: find
  find(filter: TaskFilter = {}, options?: PaginationOptions): PaginatedResult<TaskRecord> {
    const queryFilters: any[] = [];

    if (filter.status) {
      queryFilters.push({ field: "status", operator: "eq", value: filter.status });
    }
    if (filter.priority !== undefined) {
      queryFilters.push({ field: "priority", operator: "eq", value: filter.priority });
    }
    if (filter.groupId) {
      queryFilters.push({ field: "group_id", operator: "eq", value: filter.groupId });
    }
    if (filter.repositoryName) {
      queryFilters.push({ field: "repository_name", operator: "eq", value: filter.repositoryName });
    }

    // Direct SQL query since we need synchronous behavior

    // Build WHERE clause
    const whereClauses: string[] = [];
    const params: any[] = [];

    if (filter.status) {
      if (Array.isArray(filter.status)) {
        whereClauses.push(`status IN (${filter.status.map(() => "?").join(",")})`);
        params.push(...filter.status);
      } else {
        whereClauses.push("status = ?");
        params.push(filter.status);
      }
    }

    if (filter.priority !== undefined) {
      whereClauses.push("priority = ?");
      params.push(filter.priority);
    }

    if (filter.groupId) {
      whereClauses.push("group_id = ?");
      params.push(filter.groupId);
    }

    if (filter.repositoryName) {
      whereClauses.push("repository_name = ?");
      params.push(filter.repositoryName);
    }

    if (filter.createdAfter) {
      whereClauses.push("created_at > ?");
      params.push(filter.createdAfter.toISOString());
    }

    if (filter.createdBefore) {
      whereClauses.push("created_at < ?");
      params.push(filter.createdBefore.toISOString());
    }

    if (filter.search) {
      whereClauses.push("instruction LIKE ?");
      params.push(`%${filter.search}%`);
    }

    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
    const orderBy = options?.orderBy || "created_at";
    const orderDirection = options?.orderDirection || "DESC";
    const limit = options?.limit || 20;
    const offset = options?.offset || 0;

    // Get total count
    const countStmt = this.db.prepare(`SELECT COUNT(*) as count FROM tasks ${whereClause}`);
    const countResult = countStmt.get(...params) as { count: number };
    const total = countResult.count;

    // Get data
    const dataStmt = this.db.prepare(`
      SELECT * FROM tasks ${whereClause}
      ORDER BY ${orderBy} ${orderDirection}
      LIMIT ? OFFSET ?
    `);
    const rows = dataStmt.all(...params, limit, offset) as any[];
    const data = rows.map((row) => this.rowToRecord(row));

    return {
      data,
      total,
      limit,
      offset,
      hasNext: offset + limit < total,
      hasPrev: offset > 0,
    };
  }

  // Legacy method: getById
  getById(id: string): TaskRecord | undefined {
    const stmt = this.db.prepare("SELECT * FROM tasks WHERE id = ?");
    const row = stmt.get(id) as any;
    return row ? this.rowToRecord(row) : undefined;
  }

  // Legacy method: update
  update(id: string, updates: Partial<TaskRecord>): TaskRecord | null {
    const entityUpdates: Partial<TaskEntity> = {
      ...updates,
      context: updates.context ? JSON.stringify(updates.context) : undefined,
      options: updates.options ? JSON.stringify(updates.options) : undefined,
      result: updates.result ? JSON.stringify(updates.result) : undefined,
      retryMetadata: updates.retryMetadata ? JSON.stringify(updates.retryMetadata) : undefined,
      updatedAt: new Date(),
    };

    // Build UPDATE statement dynamically
    const setClauses: string[] = [];
    const params: any[] = [];

    Object.entries(entityUpdates).forEach(([key, value]) => {
      if (value !== undefined) {
        setClauses.push(`${key} = ?`);
        params.push(value instanceof Date ? value.toISOString() : value);
      }
    });

    if (setClauses.length === 0) return null;

    params.push(id);
    const stmt = this.db.prepare(`
      UPDATE tasks SET ${setClauses.join(", ")} WHERE id = ?
    `);

    const result = stmt.run(...params);
    return result.changes > 0 ? this.getById(id) || null : null;
  }

  // Legacy method: delete
  delete(id: string): boolean {
    const stmt = this.db.prepare("DELETE FROM tasks WHERE id = ?");
    const result = stmt.run(id);
    return result.changes > 0;
  }

  // Legacy method: getPendingTasks
  getPendingTasks(): QueuedTask[] {
    const stmt = this.db.prepare(`
      SELECT * FROM tasks 
      WHERE status IN ('pending', 'running')
      ORDER BY priority DESC, created_at ASC
    `);
    const rows = stmt.all() as any[];
    return rows.map((row) => this.toQueuedTask(this.rowToRecord(row)));
  }

  // Legacy method: getTasksReadyForRetry
  getTasksReadyForRetry(): TaskRecord[] {
    const stmt = this.db.prepare(`
      SELECT * FROM tasks 
      WHERE status = 'failed' 
      AND retry_count < max_retries
      ORDER BY created_at ASC
    `);
    const rows = stmt.all() as any[];
    return rows.map((row) => this.rowToRecord(row));
  }

  // Legacy method: cleanupOldTasks
  cleanupOldTasks(daysOld: number): number {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const stmt = this.db.prepare(`
      DELETE FROM tasks 
      WHERE created_at < ? 
      AND status IN ('completed', 'failed', 'cancelled')
    `);

    const result = stmt.run(cutoffDate.toISOString());
    return result.changes;
  }

  // Legacy method: updateStatus
  updateStatus(id: string, status: TaskStatus, error?: Error): void {
    const updates: any = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (error) {
      updates.error = JSON.stringify({
        message: error.message,
        stack: error.stack,
        name: error.name,
      });
    }

    if (status === TaskStatus.RUNNING) {
      updates.started_at = new Date().toISOString();
    } else if (
      status === TaskStatus.COMPLETED ||
      status === TaskStatus.FAILED ||
      status === TaskStatus.CANCELLED
    ) {
      updates.completed_at = new Date().toISOString();
    }

    const setClauses = Object.keys(updates)
      .map((key) => `${key} = ?`)
      .join(", ");
    const params = [...Object.values(updates), id];

    const stmt = this.db.prepare(`UPDATE tasks SET ${setClauses} WHERE id = ?`);
    stmt.run(...params);
  }

  // Legacy method: updateResult
  updateResult(id: string, result: TaskResponse): void {
    const stmt = this.db.prepare(`
      UPDATE tasks SET result = ?, updated_at = ? WHERE id = ?
    `);
    stmt.run(JSON.stringify(result), new Date().toISOString(), id);
  }

  // Legacy method: updateRetryMetadata
  updateRetryMetadata(id: string, metadata: TaskResponse["retryMetadata"]): void {
    const stmt = this.db.prepare(`
      UPDATE tasks 
      SET retry_metadata = ?, 
          retry_count = ?,
          max_retries = ?,
          updated_at = ?
      WHERE id = ?
    `);
    stmt.run(
      JSON.stringify(metadata),
      metadata?.currentAttempt || 0,
      metadata?.maxRetries || 0,
      new Date().toISOString(),
      id,
    );
  }

  // New method: updateConversationHistory
  updateConversationHistory(id: string, conversationHistory: any): void {
    const stmt = this.db.prepare(`
      UPDATE tasks SET conversation_history = ?, updated_at = ? WHERE id = ?
    `);
    stmt.run(JSON.stringify(conversationHistory), new Date().toISOString(), id);
  }

  // Legacy method: resetTaskForRetry
  resetTaskForRetry(id: string): void {
    const stmt = this.db.prepare(`
      UPDATE tasks 
      SET status = 'pending',
          started_at = NULL,
          completed_at = NULL,
          error = NULL,
          result = NULL,
          updated_at = ?
      WHERE id = ?
    `);
    stmt.run(new Date().toISOString(), id);
  }

  // Legacy method: toQueuedTask
  toQueuedTask(record: TaskRecord): QueuedTask {
    return {
      id: record.id,
      request: {
        instruction: record.instruction,
        context: record.context,
        options: record.options,
      },
      status: record.status,
      priority: record.priority,
      addedAt: record.createdAt,
      startedAt: record.startedAt,
      completedAt: record.completedAt,
      retryMetadata: record.retryMetadata,
      result: record.result
        ? {
            taskId: record.id,
            status: record.status,
            instruction: record.instruction,
            createdAt: record.createdAt,
            startedAt: record.startedAt,
            completedAt: record.completedAt,
            result: record.result.result,
            error: record.error,
            logs: record.result.logs,
            todos: record.result.todos,
          }
        : undefined,
      error: record.error ? new Error(record.error.message || record.error) : undefined,
    };
  }

  // Legacy method: findByGroupId
  findByGroupId(groupId: string): TaskRecord[] {
    const stmt = this.db.prepare(`
      SELECT * FROM tasks 
      WHERE group_id = ?
      ORDER BY created_at ASC
    `);
    const rows = stmt.all(groupId) as any[];
    return rows.map((row) => this.rowToRecord(row));
  }

  // Helper: Convert entity to record
  private entityToRecord(entity: TaskEntity): TaskRecord {
    return {
      id: entity.id,
      instruction: entity.instruction,
      context: entity.context,
      options: entity.options,
      priority: entity.priority,
      status: entity.status as TaskStatus,
      result: entity.result,
      error: entity.error,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      completedAt: entity.completedAt,
      startedAt: entity.startedAt,
      cancelledAt: undefined, // Not in TaskEntity
      retryCount: 0, // Not in TaskEntity
      maxRetries: 0, // Not in TaskEntity
      retryMetadata: entity.retryMetadata,
      groupId: entity.groupId,
      repositoryName: entity.repositoryName,
      conversationHistory: entity.conversationHistory,
      continuedFrom: entity.continuedFrom,
    };
  }

  // Helper: Convert database row to record
  private rowToRecord(row: any): TaskRecord {
    return {
      id: row.id,
      instruction: row.instruction,
      context: row.context ? JSON.parse(row.context) : undefined,
      options: row.options ? JSON.parse(row.options) : undefined,
      priority: row.priority,
      status: row.status,
      result: row.result ? JSON.parse(row.result) : undefined,
      error: row.error ? JSON.parse(row.error) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      startedAt: row.started_at ? new Date(row.started_at) : undefined,
      cancelledAt: row.cancelled_at ? new Date(row.cancelled_at) : undefined,
      retryCount: row.retry_count || 0,
      maxRetries: row.max_retries || 0,
      retryMetadata: row.retry_metadata ? JSON.parse(row.retry_metadata) : undefined,
      groupId: row.group_id || undefined,
      repositoryName: row.repository_name || undefined,
      conversationHistory: row.conversation_history
        ? JSON.parse(row.conversation_history)
        : undefined,
      continuedFrom: row.continued_from || undefined,
    };
  }
}

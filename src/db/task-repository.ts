import { DatabaseConnection } from "./database.js";
import type { TaskRecord, TaskFilter, PaginationOptions, PaginatedResult } from "./types.js";
import type { TaskRequest, TaskResponse } from "../claude/types.js";
import { TaskStatus } from "../claude/types.js";
import type { QueuedTask } from "../queue/types.js";

export class TaskRepository {
  private db: DatabaseConnection;

  constructor(dbPath?: string) {
    this.db = DatabaseConnection.getInstance(dbPath);
  }

  // Create a new task
  create(task: {
    id: string;
    instruction: string;
    context?: TaskRequest["context"];
    options?: TaskRequest["options"];
    priority?: number;
    status?: TaskStatus;
    retryMetadata?: TaskResponse["retryMetadata"];
  }): TaskRecord {
    const maxRetries = task.options?.retry?.maxRetries ?? 0;

    const stmt = this.db.getDb().prepare(`
      INSERT INTO tasks (
        id, instruction, context, options, priority, status,
        retry_metadata, current_attempt, max_retries
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      task.id,
      task.instruction,
      task.context ? JSON.stringify(task.context) : null,
      task.options ? JSON.stringify(task.options) : null,
      task.priority ?? 0,
      task.status ?? TaskStatus.PENDING,
      task.retryMetadata ? JSON.stringify(task.retryMetadata) : null,
      0, // current_attempt starts at 0
      maxRetries,
    );

    if (result.changes === 0) {
      throw new Error("Failed to create task");
    }

    return this.getById(task.id)!;
  }

  // Get task by ID
  getById(id: string): TaskRecord | undefined {
    const stmt = this.db.getDb().prepare("SELECT * FROM tasks WHERE id = ?");
    return stmt.get(id) as TaskRecord | undefined;
  }

  // Update task status
  updateStatus(id: string, status: TaskStatus, error?: Error): void {
    const now = new Date().toISOString();
    let stmt;

    if (status === TaskStatus.RUNNING) {
      stmt = this.db.getDb().prepare(`
        UPDATE tasks 
        SET status = ?, started_at = ? 
        WHERE id = ?
      `);
      stmt.run(status, now, id);
    } else if (
      status === TaskStatus.COMPLETED ||
      status === TaskStatus.FAILED ||
      status === TaskStatus.CANCELLED
    ) {
      stmt = this.db.getDb().prepare(`
        UPDATE tasks 
        SET status = ?, completed_at = ?, error = ?
        WHERE id = ?
      `);
      stmt.run(
        status,
        now,
        error ? JSON.stringify({ message: error.message, stack: error.stack }) : null,
        id,
      );
    } else {
      stmt = this.db.getDb().prepare("UPDATE tasks SET status = ? WHERE id = ?");
      stmt.run(status, id);
    }
  }

  // Update task result
  updateResult(id: string, result: TaskResponse): void {
    const stmt = this.db.getDb().prepare(`
      UPDATE tasks 
      SET result = ?, status = 'completed', completed_at = ?
      WHERE id = ?
    `);

    stmt.run(JSON.stringify(result), new Date().toISOString(), id);
  }

  // Find tasks with filters and pagination
  find(filter: TaskFilter = {}, pagination: PaginationOptions): PaginatedResult<TaskRecord> {
    const conditions: string[] = [];
    const params: unknown[] = [];

    // Build WHERE conditions
    if (filter.status) {
      if (Array.isArray(filter.status)) {
        conditions.push(`status IN (${filter.status.map(() => "?").join(", ")})`);
        params.push(...filter.status);
      } else {
        conditions.push("status = ?");
        params.push(filter.status);
      }
    }

    if (filter.priority !== undefined) {
      conditions.push("priority >= ?");
      params.push(filter.priority);
    }

    if (filter.createdAfter) {
      conditions.push("created_at >= ?");
      params.push(filter.createdAfter.toISOString());
    }

    if (filter.createdBefore) {
      conditions.push("created_at <= ?");
      params.push(filter.createdBefore.toISOString());
    }

    if (filter.search) {
      conditions.push("instruction LIKE ?");
      params.push(`%${filter.search}%`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // Count total matching records
    const countStmt = this.db.getDb().prepare(`
      SELECT COUNT(*) as total FROM tasks ${whereClause}
    `);
    const { total } = countStmt.get(...params) as { total: number };

    // Get paginated results
    const orderBy = pagination.orderBy || "created_at";
    const orderDirection = pagination.orderDirection || "DESC";

    const dataStmt = this.db.getDb().prepare(`
      SELECT * FROM tasks 
      ${whereClause}
      ORDER BY ${orderBy} ${orderDirection}
      LIMIT ? OFFSET ?
    `);

    const data = dataStmt.all(...params, pagination.limit, pagination.offset) as TaskRecord[];

    return {
      data,
      total,
      limit: pagination.limit,
      offset: pagination.offset,
      hasNext: pagination.offset + pagination.limit < total,
      hasPrev: pagination.offset > 0,
    };
  }

  // Delete old completed tasks
  cleanupOldTasks(daysToKeep: number = 30): number {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const stmt = this.db.getDb().prepare(`
      DELETE FROM tasks 
      WHERE status IN ('completed', 'failed', 'cancelled') 
      AND completed_at < ?
    `);

    const result = stmt.run(cutoffDate.toISOString());
    return result.changes;
  }

  // Convert database record to QueuedTask
  toQueuedTask(record: TaskRecord): QueuedTask {
    return {
      id: record.id,
      request: {
        instruction: record.instruction,
        context: record.context
          ? (JSON.parse(record.context) as TaskRequest["context"])
          : undefined,
        options: record.options
          ? (JSON.parse(record.options) as TaskRequest["options"])
          : undefined,
      },
      priority: record.priority,
      addedAt: new Date(record.created_at),
      startedAt: record.started_at ? new Date(record.started_at) : undefined,
      completedAt: record.completed_at ? new Date(record.completed_at) : undefined,
      status: record.status as TaskStatus,
      result: record.result ? (JSON.parse(record.result) as TaskResponse) : undefined,
      error: record.error ? new Error(JSON.parse(record.error) as string) : undefined,
      retryMetadata: record.retry_metadata
        ? (JSON.parse(record.retry_metadata) as TaskResponse["retryMetadata"])
        : undefined,
    };
  }

  // Get all pending tasks for queue restoration
  getPendingTasks(): QueuedTask[] {
    const stmt = this.db.getDb().prepare(`
      SELECT * FROM tasks 
      WHERE status IN ('pending', 'running')
      ORDER BY priority DESC, created_at ASC
    `);

    const records = stmt.all() as TaskRecord[];
    return records.map((record) => this.toQueuedTask(record));
  }

  // Update retry metadata
  updateRetryMetadata(
    id: string,
    retryMetadata: TaskResponse["retryMetadata"],
    nextRetryAt?: Date,
  ): void {
    if (!retryMetadata) {
      throw new Error("Retry metadata is required");
    }

    const stmt = this.db.getDb().prepare(`
      UPDATE tasks 
      SET retry_metadata = ?, current_attempt = ?, next_retry_at = ?
      WHERE id = ?
    `);

    stmt.run(
      JSON.stringify(retryMetadata),
      retryMetadata.currentAttempt,
      nextRetryAt ? nextRetryAt.toISOString() : null,
      id,
    );
  }

  // Get tasks ready for retry
  getTasksReadyForRetry(): TaskRecord[] {
    const now = new Date().toISOString();
    const stmt = this.db.getDb().prepare(`
      SELECT * FROM tasks 
      WHERE status = 'failed' 
      AND current_attempt < max_retries
      AND (next_retry_at IS NULL OR next_retry_at <= ?)
      ORDER BY priority DESC, next_retry_at ASC
    `);

    return stmt.all(now) as TaskRecord[];
  }

  // Reset task for retry
  resetTaskForRetry(id: string): void {
    const stmt = this.db.getDb().prepare(`
      UPDATE tasks 
      SET status = 'pending', 
          started_at = NULL, 
          completed_at = NULL,
          error = NULL,
          result = NULL
      WHERE id = ?
    `);

    stmt.run(id);
  }
}

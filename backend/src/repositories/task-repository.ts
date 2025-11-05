import type { Database } from "better-sqlite3";
import { BaseRepository } from "./base-repository.js";
import type { ITaskRepository, TaskEntity } from "./types.js";
import { TaskStatus } from "../claude/types.js";
import { logger } from "../utils/logger.js";

/**
 * Task repository implementation
 */
export class TaskRepositoryImpl extends BaseRepository<TaskEntity> implements ITaskRepository {
  protected tableName = "tasks";

  constructor(db: Database) {
    super(db);
    this.ensureTable();
  }

  async findByStatus(status: string): Promise<TaskEntity[]> {
    return this.findMany([{ field: "status", operator: "eq", value: status }]).then(
      (result) => result.items,
    );
  }

  async findPendingTasks(): Promise<TaskEntity[]> {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM ${this.tableName} 
        WHERE status IN (?, ?)
        ORDER BY priority DESC, createdAt ASC
      `);
      const rows = stmt.all(TaskStatus.PENDING, TaskStatus.RUNNING);
      return rows.map((row) => this.mapRowToEntity(row));
    } catch (error) {
      logger.error("Error finding pending tasks", { error });
      throw error;
    }
  }

  async updateStatus(id: string, status: string, error?: Error): Promise<void> {
    try {
      const updates: Partial<TaskEntity> = {
        status,
        updatedAt: new Date(),
      };

      if (error) {
        updates.error = {
          message: error.message,
          stack: error.stack,
          name: error.name,
        };
      }

      if (status === TaskStatus.RUNNING) {
        updates.startedAt = new Date();
      } else if (
        status === TaskStatus.COMPLETED ||
        status === TaskStatus.FAILED ||
        status === TaskStatus.CANCELLED
      ) {
        updates.completedAt = new Date();
      }

      await this.update(id, updates);
    } catch (error) {
      logger.error("Error updating task status", { id, status, error });
      throw error;
    }
  }

  async updateResult(id: string, result: unknown): Promise<void> {
    try {
      await this.update(id, {
        result,
        updatedAt: new Date(),
      });
    } catch (error) {
      logger.error("Error updating task result", { id, error });
      throw error;
    }
  }

  async updateRetryMetadata(id: string, metadata: unknown, nextRetryAt?: Date): Promise<void> {
    try {
      const updates: Partial<TaskEntity> = {
        retryMetadata: metadata,
        nextRetryAt,
        updatedAt: new Date(),
      };
      await this.update(id, updates);
    } catch (error) {
      logger.error("Error updating retry metadata", { id, error });
      throw error;
    }
  }

  async resetTaskForRetry(id: string): Promise<void> {
    try {
      await this.update(id, {
        status: TaskStatus.PENDING,
        startedAt: undefined,
        completedAt: undefined,
        error: undefined,
        result: undefined,
        updatedAt: new Date(),
      });
    } catch (error) {
      logger.error("Error resetting task for retry", { id, error });
      throw error;
    }
  }

  async updateConversationHistory(id: string, conversationHistory: unknown): Promise<void> {
    try {
      await this.update(id, {
        conversationHistory,
        updatedAt: new Date(),
      });
    } catch (error) {
      logger.error("Error updating conversation history", { id, error });
      throw error;
    }
  }

  protected mapRowToEntity(row: any): TaskEntity {
    return {
      id: row.id,
      instruction: row.instruction,
      context: row.context ? JSON.parse(row.context) : undefined,
      options: row.options ? JSON.parse(row.options) : undefined,
      priority: row.priority,
      status: row.status,
      result: row.result ? JSON.parse(row.result) : undefined,
      error: row.error ? JSON.parse(row.error) : undefined,
      startedAt: row.startedAt ? new Date(row.startedAt) : undefined,
      completedAt: row.completedAt ? new Date(row.completedAt) : undefined,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
      retryMetadata: row.retryMetadata ? JSON.parse(row.retryMetadata) : undefined,
      nextRetryAt: row.nextRetryAt ? new Date(row.nextRetryAt) : undefined,
      groupId: row.groupId,
      repositoryName: row.repositoryName,
      conversationHistory: row.conversationHistory
        ? JSON.parse(row.conversationHistory)
        : undefined,
    };
  }

  private ensureTable(): void {
    const stmt = this.db.prepare(`
      CREATE TABLE IF NOT EXISTS ${this.tableName} (
        id TEXT PRIMARY KEY,
        instruction TEXT NOT NULL,
        context TEXT,
        options TEXT,
        priority INTEGER DEFAULT 0,
        status TEXT NOT NULL,
        result TEXT,
        error TEXT,
        startedAt TEXT,
        completedAt TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        retryMetadata TEXT,
        nextRetryAt TEXT,
        groupId TEXT,
        repositoryName TEXT,
        conversationHistory TEXT
      )
    `);
    stmt.run();

    // Add conversationHistory column if it doesn't exist (for existing databases)
    try {
      this.db.prepare(`ALTER TABLE ${this.tableName} ADD COLUMN conversationHistory TEXT`).run();
    } catch (error) {
      // Column already exists, ignore error
    }

    // Create indexes
    this.db
      .prepare(`CREATE INDEX IF NOT EXISTS idx_tasks_status ON ${this.tableName} (status)`)
      .run();
    this.db
      .prepare(`CREATE INDEX IF NOT EXISTS idx_tasks_groupId ON ${this.tableName} (groupId)`)
      .run();
    this.db
      .prepare(
        `CREATE INDEX IF NOT EXISTS idx_tasks_nextRetryAt ON ${this.tableName} (nextRetryAt)`,
      )
      .run();
  }
}

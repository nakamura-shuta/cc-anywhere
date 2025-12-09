import type { Database } from "better-sqlite3";
import { BaseRepository } from "./base-repository.js";
import type { ICompareTaskRepository, CompareTaskEntity, CompareTaskStatus } from "./types.js";
import { logger } from "../utils/logger.js";

/**
 * Compare task repository implementation for LLM comparison mode
 */
export class CompareTaskRepositoryImpl
  extends BaseRepository<CompareTaskEntity>
  implements ICompareTaskRepository
{
  protected tableName = "compare_tasks";

  constructor(db: Database) {
    super(db);
    this.ensureTable();
  }

  async findByStatus(status: CompareTaskStatus): Promise<CompareTaskEntity[]> {
    const result = await this.findMany([{ field: "status", operator: "eq", value: status }]);
    return result.items;
  }

  async findRunningTasks(): Promise<CompareTaskEntity[]> {
    const result = await this.findMany([
      {
        field: "status",
        operator: "in",
        value: ["pending", "running", "cancelling"],
      },
    ]);
    return result.items;
  }

  async countRunningTasks(): Promise<number> {
    return this.count([
      {
        field: "status",
        operator: "in",
        value: ["pending", "running", "cancelling"],
      },
    ]);
  }

  /**
   * タスクIDから関連する比較タスクを検索
   * Claude, Codex, Geminiのいずれかのタスクに一致するものを返す
   */
  async findByTaskId(taskId: string): Promise<CompareTaskEntity[]> {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM ${this.tableName}
        WHERE claude_task_id = ? OR codex_task_id = ? OR gemini_task_id = ?
      `);
      const rows = stmt.all(taskId, taskId, taskId) as any[];
      return rows.map((row) => this.mapRowToEntity(row));
    } catch (error) {
      logger.error("Error finding compare tasks by task ID", { taskId, error });
      return [];
    }
  }

  async updateStatus(id: string, status: CompareTaskStatus): Promise<void> {
    try {
      const stmt = this.db.prepare(`UPDATE ${this.tableName} SET status = ? WHERE id = ?`);
      stmt.run(status, id);
    } catch (error) {
      logger.error("Error updating compare task status", { id, status, error });
      throw error;
    }
  }

  async markCompleted(id: string, status: CompareTaskStatus): Promise<void> {
    try {
      const stmt = this.db.prepare(
        `UPDATE ${this.tableName} SET status = ?, completed_at = datetime('now') WHERE id = ?`,
      );
      stmt.run(status, id);
    } catch (error) {
      logger.error("Error marking compare task completed", { id, status, error });
      throw error;
    }
  }

  protected mapRowToEntity(row: any): CompareTaskEntity {
    return {
      id: row.id,
      instruction: row.instruction,
      repositoryId: row.repository_id,
      repositoryPath: row.repository_path,
      baseCommit: row.base_commit,
      claudeTaskId: row.claude_task_id,
      codexTaskId: row.codex_task_id,
      geminiTaskId: row.gemini_task_id,
      status: row.status as CompareTaskStatus,
      createdAt: new Date(row.created_at),
      completedAt: row.completed_at ? new Date(row.completed_at) : null,
    };
  }

  protected override serializeEntity(entity: Partial<CompareTaskEntity>): Record<string, unknown> {
    const data: Record<string, unknown> = {};

    if (entity.id !== undefined) data.id = entity.id;
    if (entity.instruction !== undefined) data.instruction = entity.instruction;
    if (entity.repositoryId !== undefined) data.repository_id = entity.repositoryId;
    if (entity.repositoryPath !== undefined) data.repository_path = entity.repositoryPath;
    if (entity.baseCommit !== undefined) data.base_commit = entity.baseCommit;
    if (entity.claudeTaskId !== undefined) data.claude_task_id = entity.claudeTaskId;
    if (entity.codexTaskId !== undefined) data.codex_task_id = entity.codexTaskId;
    if (entity.geminiTaskId !== undefined) data.gemini_task_id = entity.geminiTaskId;
    if (entity.status !== undefined) data.status = entity.status;
    if (entity.createdAt !== undefined) data.created_at = entity.createdAt.toISOString();
    if (entity.completedAt !== undefined) {
      data.completed_at = entity.completedAt ? entity.completedAt.toISOString() : null;
    }

    return data;
  }

  private ensureTable(): void {
    const stmt = this.db.prepare(`
      CREATE TABLE IF NOT EXISTS ${this.tableName} (
        id TEXT PRIMARY KEY,
        instruction TEXT NOT NULL,
        repository_id TEXT NOT NULL,
        repository_path TEXT NOT NULL,
        base_commit TEXT NOT NULL,
        claude_task_id TEXT,
        codex_task_id TEXT,
        gemini_task_id TEXT,
        status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'running', 'completed', 'partial_success', 'failed', 'cancelling', 'cancelled')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME
      )
    `);
    stmt.run();

    // Create indexes
    this.db
      .prepare(`CREATE INDEX IF NOT EXISTS idx_compare_tasks_status ON ${this.tableName} (status)`)
      .run();
    this.db
      .prepare(
        `CREATE INDEX IF NOT EXISTS idx_compare_tasks_repository_id ON ${this.tableName} (repository_id)`,
      )
      .run();
    this.db
      .prepare(
        `CREATE INDEX IF NOT EXISTS idx_compare_tasks_created_at ON ${this.tableName} (created_at)`,
      )
      .run();
  }
}

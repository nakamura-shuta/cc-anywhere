import type { Database } from "better-sqlite3";
import { BaseRepository } from "./base-repository.js";
import type { IWorktreeRepository, WorktreeEntity } from "./types.js";
import { logger } from "../utils/logger.js";

/**
 * Worktree repository implementation
 */
export class WorktreeRepositoryImpl
  extends BaseRepository<WorktreeEntity>
  implements IWorktreeRepository
{
  protected tableName = "worktrees";

  constructor(db: Database) {
    super(db);
    this.ensureTable();
  }

  async findByTaskId(taskId: string): Promise<WorktreeEntity | null> {
    return this.findOne([{ field: "taskId", operator: "eq", value: taskId }]);
  }

  async findByPath(path: string): Promise<WorktreeEntity | null> {
    return this.findOne([{ field: "path", operator: "eq", value: path }]);
  }

  async findStaleWorktrees(olderThan: Date): Promise<WorktreeEntity[]> {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM ${this.tableName} 
        WHERE lastUsedAt < ? AND isActive = 0
        ORDER BY lastUsedAt ASC
      `);
      const rows = stmt.all(olderThan.toISOString());
      return rows.map((row) => this.mapRowToEntity(row));
    } catch (error) {
      logger.error("Error finding stale worktrees", { olderThan, error });
      throw error;
    }
  }

  async markAsActive(id: string): Promise<void> {
    await this.update(id, {
      isActive: true,
      lastUsedAt: new Date(),
      updatedAt: new Date(),
    } as Partial<WorktreeEntity>);
  }

  async markAsInactive(id: string): Promise<void> {
    await this.update(id, {
      isActive: false,
      updatedAt: new Date(),
    } as Partial<WorktreeEntity>);
  }

  protected mapRowToEntity(row: any): WorktreeEntity {
    return {
      id: row.id,
      taskId: row.taskId,
      path: row.path,
      baseBranch: row.baseBranch,
      worktreeBranch: row.worktreeBranch,
      isActive: row.isActive === 1,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
      lastUsedAt: new Date(row.lastUsedAt),
    };
  }

  private ensureTable(): void {
    const stmt = this.db.prepare(`
      CREATE TABLE IF NOT EXISTS ${this.tableName} (
        id TEXT PRIMARY KEY,
        taskId TEXT NOT NULL,
        path TEXT NOT NULL UNIQUE,
        baseBranch TEXT NOT NULL,
        worktreeBranch TEXT NOT NULL,
        isActive INTEGER DEFAULT 0,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        lastUsedAt TEXT NOT NULL
      )
    `);
    stmt.run();

    // Create indexes
    this.db
      .prepare(`CREATE INDEX IF NOT EXISTS idx_worktrees_taskId ON ${this.tableName} (taskId)`)
      .run();
    this.db
      .prepare(`CREATE INDEX IF NOT EXISTS idx_worktrees_path ON ${this.tableName} (path)`)
      .run();
    this.db
      .prepare(
        `CREATE INDEX IF NOT EXISTS idx_worktrees_lastUsedAt ON ${this.tableName} (lastUsedAt)`,
      )
      .run();
  }
}

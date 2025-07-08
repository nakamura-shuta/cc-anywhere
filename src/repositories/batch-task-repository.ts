import type { Database } from "better-sqlite3";
import { BaseRepository } from "./base-repository.js";
import type { IBatchTaskRepository, BatchTaskEntity } from "./types.js";

/**
 * Batch task repository implementation
 */
export class BatchTaskRepositoryImpl
  extends BaseRepository<BatchTaskEntity>
  implements IBatchTaskRepository
{
  protected tableName = "batch_tasks";

  constructor(db: Database) {
    super(db);
    this.ensureTable();
  }

  async findByGroupId(groupId: string): Promise<BatchTaskEntity[]> {
    return this.findMany([{ field: "groupId", operator: "eq", value: groupId }]).then(
      (result) => result.items,
    );
  }

  async countByGroupIdAndStatus(groupId: string, status: string): Promise<number> {
    return this.count([
      { field: "groupId", operator: "eq", value: groupId },
      { field: "status", operator: "eq", value: status },
    ]);
  }

  protected mapRowToEntity(row: any): BatchTaskEntity {
    return {
      id: row.id,
      groupId: row.groupId,
      taskId: row.taskId,
      repositoryName: row.repositoryName,
      status: row.status,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    };
  }

  private ensureTable(): void {
    const stmt = this.db.prepare(`
      CREATE TABLE IF NOT EXISTS ${this.tableName} (
        id TEXT PRIMARY KEY,
        groupId TEXT NOT NULL,
        taskId TEXT NOT NULL,
        repositoryName TEXT NOT NULL,
        status TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        FOREIGN KEY (taskId) REFERENCES tasks(id)
      )
    `);
    stmt.run();

    // Create indexes
    this.db
      .prepare(`CREATE INDEX IF NOT EXISTS idx_batch_tasks_groupId ON ${this.tableName} (groupId)`)
      .run();
    this.db
      .prepare(`CREATE INDEX IF NOT EXISTS idx_batch_tasks_taskId ON ${this.tableName} (taskId)`)
      .run();
    this.db
      .prepare(
        `CREATE INDEX IF NOT EXISTS idx_batch_tasks_groupId_status ON ${this.tableName} (groupId, status)`,
      )
      .run();
  }
}

import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { DatabaseProvider } from "../../../src/db/database-provider";

describe("DatabaseProvider", () => {
  let provider: DatabaseProvider;

  beforeEach(() => {
    // Use in-memory database for tests
    provider = new DatabaseProvider(":memory:");
  });

  afterEach(() => {
    provider.close();
  });

  it("should create database instance", () => {
    const db = provider.getDb();
    expect(db).toBeDefined();

    // Test basic database operation
    const result = db.prepare("SELECT 1 as value").get() as { value: number };
    expect(result.value).toBe(1);
  });

  it("should run migrations on initialization", () => {
    const db = provider.getDb();

    // Check if tasks table exists
    const tableInfo = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='tasks'")
      .get();
    expect(tableInfo).toBeDefined();

    // Check if batch_tasks table exists
    const batchTableInfo = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='batch_tasks'")
      .get();
    expect(batchTableInfo).toBeDefined();

    // Check if worktrees table exists
    const worktreeTableInfo = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='worktrees'")
      .get();
    expect(worktreeTableInfo).toBeDefined();

    // Check if indexes exist
    const indexes = db
      .prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='tasks'")
      .all();
    const indexNames = indexes.map((idx) => (idx as { name: string }).name);

    expect(indexNames).toContain("idx_tasks_status");
    expect(indexNames).toContain("idx_tasks_created_at");
    expect(indexNames).toContain("idx_tasks_groupId");
    expect(indexNames).toContain("idx_tasks_repositoryName");
  });

  it("should set journal mode appropriately", () => {
    const db = provider.getDb();

    const result = db.pragma("journal_mode") as Array<{ journal_mode: string }>;
    // In-memory databases use 'memory' mode
    expect(["memory", "delete"]).toContain(result[0].journal_mode.toLowerCase());
  });

  it("should enable foreign keys", () => {
    const db = provider.getDb();

    const result = db.pragma("foreign_keys") as Array<{ foreign_keys: number }>;
    expect(result[0].foreign_keys).toBe(1);
  });

  it("should close database connection", () => {
    const db = provider.getDb();
    expect(db.open).toBe(true);

    provider.close();
    // After closing, database operations should throw
    expect(() => db.prepare("SELECT 1").get()).toThrow("The database connection is not open");
  });
});

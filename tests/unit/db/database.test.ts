import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { DatabaseConnection } from "../../../src/db/database";

// Type for accessing private static instance
interface DatabaseConnectionStatic {
  instance?: DatabaseConnection;
}

describe("DatabaseConnection", () => {
  // Use in-memory database for tests
  const testDbPath = ":memory:";

  beforeEach(() => {
    // Reset singleton instance before each test
    const dbClass = DatabaseConnection as unknown as DatabaseConnectionStatic;
    if (dbClass.instance) {
      dbClass.instance.close();
      dbClass.instance = undefined;
    }
  });

  afterEach(() => {
    // Clean up after each test
    const dbClass = DatabaseConnection as unknown as DatabaseConnectionStatic;
    if (dbClass.instance) {
      dbClass.instance.close();
      dbClass.instance = undefined;
    }
  });

  it("should create singleton instance", () => {
    const instance1 = DatabaseConnection.getInstance(testDbPath);
    const instance2 = DatabaseConnection.getInstance(testDbPath);

    expect(instance1).toBe(instance2);
  });

  it("should initialize database with proper settings", () => {
    const connection = DatabaseConnection.getInstance(testDbPath);
    const db = connection.getDb();

    // Test basic database operation
    const result = db.prepare("SELECT 1 as value").get() as { value: number };
    expect(result.value).toBe(1);
  });

  it("should run migrations on initialization", () => {
    const connection = DatabaseConnection.getInstance(testDbPath);
    const db = connection.getDb();

    // Check if tasks table exists
    const tableInfo = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='tasks'")
      .get();
    expect(tableInfo).toBeDefined();

    // Check if indexes exist
    const indexes = db
      .prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='tasks'")
      .all();
    const indexNames = indexes.map((idx) => (idx as { name: string }).name);

    expect(indexNames).toContain("idx_tasks_status");
    expect(indexNames).toContain("idx_tasks_priority");
    expect(indexNames).toContain("idx_tasks_created_at");
  });

  it("should set journal mode appropriately", () => {
    const connection = DatabaseConnection.getInstance(testDbPath);
    const db = connection.getDb();

    const result = db.pragma("journal_mode") as Array<{ journal_mode: string }>;
    // In-memory databases use 'memory' mode instead of WAL
    expect(result[0].journal_mode).toBe("memory");
  });

  it("should provide transaction utility", () => {
    const connection = DatabaseConnection.getInstance(testDbPath);
    const db = connection.getDb();

    // Prepare test statements
    const insert = db.prepare("INSERT INTO tasks (id, instruction) VALUES (?, ?)");

    // Test successful transaction
    const result = connection.transaction(() => {
      insert.run("test-1", "Task 1");
      insert.run("test-2", "Task 2");
      return "success";
    });

    expect(result).toBe("success");

    const count = db.prepare("SELECT COUNT(*) as count FROM tasks").get() as { count: number };
    expect(count.count).toBe(2);
  });
});

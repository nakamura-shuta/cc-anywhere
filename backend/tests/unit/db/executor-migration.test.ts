/**
 * Database migration test for executor fields
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type Database from "better-sqlite3";
import { DatabaseProvider } from "../../../src/db/database-provider.js";
import fs from "fs";
import path from "path";
import os from "os";

describe("Executor Migration", () => {
  let db: Database.Database;
  let dbPath: string;
  let provider: DatabaseProvider;

  beforeEach(() => {
    // Create a temporary database file
    dbPath = path.join(os.tmpdir(), `test-db-${Date.now()}.sqlite`);
    provider = new DatabaseProvider(dbPath);
    db = provider.getDb();
  });

  afterEach(() => {
    // Close database and clean up
    provider.close();
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
  });

  it("should add executor column to tasks table", () => {
    const columns = db.pragma("table_info(tasks)") as Array<{ name: string; dflt_value?: string }>;
    const columnNames = columns.map((c) => c.name);

    expect(columnNames).toContain("executor");
  });

  it("should add executor_metadata column to tasks table", () => {
    const columns = db.pragma("table_info(tasks)") as Array<{ name: string }>;
    const columnNames = columns.map((c) => c.name);

    expect(columnNames).toContain("executor_metadata");
  });

  it("should set default value for executor column to 'claude'", () => {
    const columns = db.pragma("table_info(tasks)") as Array<{
      name: string;
      dflt_value: string | null;
    }>;
    const executorColumn = columns.find((c) => c.name === "executor");

    expect(executorColumn).toBeDefined();
    expect(executorColumn?.dflt_value).toBe("'claude'");
  });

  it("should create index on executor field", () => {
    const indexes = db.pragma("index_list(tasks)") as Array<{ name: string }>;
    const indexNames = indexes.map((i) => i.name);

    expect(indexNames).toContain("idx_tasks_executor");
  });

  it("should allow storing executor information", () => {
    const stmt = db.prepare(`
      INSERT INTO tasks (id, instruction, status, executor, executor_metadata, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const taskId = "test-task-1";
    const executorMetadata = JSON.stringify({
      codex: {
        sandboxMode: "workspace-write",
        threadId: "thread-abc123",
      },
    });

    stmt.run(
      taskId,
      "test instruction",
      "pending",
      "codex",
      executorMetadata,
      new Date().toISOString(),
      new Date().toISOString(),
    );

    const row = db
      .prepare("SELECT executor, executor_metadata FROM tasks WHERE id = ?")
      .get(taskId) as {
      executor: string;
      executor_metadata: string;
    };

    expect(row.executor).toBe("codex");
    expect(JSON.parse(row.executor_metadata)).toEqual({
      codex: {
        sandboxMode: "workspace-write",
        threadId: "thread-abc123",
      },
    });
  });

  it("should use claude as default executor for new tasks", () => {
    const stmt = db.prepare(`
      INSERT INTO tasks (id, instruction, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    const taskId = "test-task-2";
    stmt.run(
      taskId,
      "test instruction",
      "pending",
      new Date().toISOString(),
      new Date().toISOString(),
    );

    const row = db.prepare("SELECT executor FROM tasks WHERE id = ?").get(taskId) as {
      executor: string;
    };

    expect(row.executor).toBe("claude");
  });

  it("should allow filtering tasks by executor", () => {
    // Insert test data
    const insertStmt = db.prepare(`
      INSERT INTO tasks (id, instruction, status, executor, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const now = new Date().toISOString();
    insertStmt.run("task-1", "instruction 1", "pending", "claude", now, now);
    insertStmt.run("task-2", "instruction 2", "pending", "codex", now, now);
    insertStmt.run("task-3", "instruction 3", "pending", "claude", now, now);

    // Query by executor
    const claudeTasks = db.prepare("SELECT id FROM tasks WHERE executor = ?").all("claude");
    const codexTasks = db.prepare("SELECT id FROM tasks WHERE executor = ?").all("codex");

    expect(claudeTasks).toHaveLength(2);
    expect(codexTasks).toHaveLength(1);
  });
});

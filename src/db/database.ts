import Database from "better-sqlite3";
import { dirname } from "path";
import { mkdirSync } from "fs";
import { config } from "../config/index.js";

export class DatabaseConnection {
  private static instance: DatabaseConnection;
  private db: Database.Database;

  private constructor(dbPath: string) {
    // Ensure the data directory exists
    const dataDir = dirname(dbPath);
    mkdirSync(dataDir, { recursive: true });

    // Initialize database connection
    try {
      this.db = new Database(dbPath, {
        // verbose: console.log, // Temporarily disable verbose logging
        timeout: 5000, // 5 seconds timeout
      });
    } catch (error) {
      console.error(`[DatabaseConnection] Failed to create database instance:`, error);
      throw error;
    }

    // Disable WAL mode to avoid concurrency issues
    // this.db.pragma("journal_mode = WAL"); // Write-Ahead Logging for better concurrency
    this.db.pragma("journal_mode = DELETE"); // Use default DELETE mode for simplicity
    this.db.pragma("foreign_keys = ON");

    // Run migrations
    this.migrate();
  }

  static getInstance(dbPath?: string): DatabaseConnection {
    const finalPath = dbPath || config.database.path;

    // If instance exists but with different path, recreate it
    if (DatabaseConnection.instance) {
      const currentPath = DatabaseConnection.instance.db.name;
      if (currentPath !== finalPath) {
        DatabaseConnection.instance.close();
        DatabaseConnection.instance = new DatabaseConnection(finalPath);
      }
    } else {
      DatabaseConnection.instance = new DatabaseConnection(finalPath);
    }

    return DatabaseConnection.instance;
  }

  private migrate(): void {
    try {
      // Define schema inline to avoid module resolution issues
      const schema = `
-- Tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  instruction TEXT NOT NULL,
  context TEXT, -- JSON object containing workingDirectory, files, etc.
  options TEXT, -- JSON object containing timeout, async, allowedTools, etc.
  priority INTEGER DEFAULT 0,
  status TEXT CHECK(status IN ('pending', 'running', 'completed', 'failed', 'cancelled')) NOT NULL DEFAULT 'pending',
  result TEXT, -- JSON object containing the task result
  error TEXT, -- JSON object containing error details
  retry_metadata TEXT, -- JSON object containing retry history and configuration
  current_attempt INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 0,
  next_retry_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  started_at DATETIME,
  completed_at DATETIME,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_updated_at ON tasks(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_next_retry_at ON tasks(next_retry_at);

-- Full-text search index on instruction
CREATE INDEX IF NOT EXISTS idx_tasks_instruction ON tasks(instruction);

-- Trigger to update updated_at timestamp
CREATE TRIGGER IF NOT EXISTS update_tasks_updated_at 
  AFTER UPDATE ON tasks
BEGIN
  UPDATE tasks SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;`;

      this.db.exec(schema);
    } catch (error) {
      console.error("Failed to run migrations:", error);
      throw error;
    }
  }

  getDb(): Database.Database {
    return this.db;
  }

  close(): void {
    this.db.close();
  }

  // Reset singleton instance (mainly for testing)
  static reset(): void {
    if (DatabaseConnection.instance) {
      DatabaseConnection.instance.close();
      (DatabaseConnection as any).instance = undefined;
    }
  }

  // Utility method for transactions
  transaction<T>(fn: () => T): T {
    const transaction = this.db.transaction(fn);
    return transaction();
  }
}

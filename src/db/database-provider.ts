/**
 * Database provider for SQLite connections
 */

import Database from "better-sqlite3";
import { dirname } from "path";
import { mkdirSync } from "fs";
import { logger } from "../utils/logger.js";

/**
 * Database provider that manages SQLite connections
 */
export class DatabaseProvider {
  private db: Database.Database;

  constructor(dbPath: string) {
    // Ensure the data directory exists
    const dataDir = dirname(dbPath);
    mkdirSync(dataDir, { recursive: true });

    // Initialize database connection
    try {
      this.db = new Database(dbPath, {
        timeout: 5000, // 5 seconds timeout
      });
      logger.info("Database connection established", { path: dbPath });
    } catch (error) {
      logger.error("Failed to create database instance", { error });
      throw error;
    }

    // Configure database settings
    this.db.pragma("journal_mode = DELETE"); // Use default DELETE mode for simplicity
    this.db.pragma("foreign_keys = ON");

    // Run migrations
    this.migrate();
  }

  /**
   * Get the database instance
   */
  getDb(): Database.Database {
    return this.db;
  }

  /**
   * Close the database connection
   */
  close(): void {
    if (this.db) {
      try {
        this.db.close();
        logger.info("Database connection closed");
      } catch (error) {
        logger.error("Error closing database", { error });
      }
    }
  }

  /**
   * Run database migrations
   */
  private migrate(): void {
    try {
      // Create tasks table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS tasks (
          id TEXT PRIMARY KEY,
          instruction TEXT NOT NULL,
          context TEXT,
          options TEXT,
          priority INTEGER DEFAULT 0,
          status TEXT DEFAULT 'pending',
          result TEXT,
          error TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
          completed_at TEXT,
          started_at TEXT,
          cancelled_at TEXT,
          retry_count INTEGER DEFAULT 0,
          max_retries INTEGER DEFAULT 0,
          retry_metadata TEXT,
          group_id TEXT,
          repository_name TEXT,
          UNIQUE(id)
        )
      `);

      // Create indexes
      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
        CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at);
        CREATE INDEX IF NOT EXISTS idx_tasks_groupId ON tasks(group_id);
        CREATE INDEX IF NOT EXISTS idx_tasks_repositoryName ON tasks(repository_name);
      `);

      // Create batch_tasks table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS batch_tasks (
          id TEXT PRIMARY KEY,
          groupId TEXT NOT NULL,
          taskIds TEXT NOT NULL,
          status TEXT DEFAULT 'pending',
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
          completed_at TEXT
        )
      `);

      // Create indexes for batch_tasks
      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_batch_tasks_groupId ON batch_tasks(groupId);
        CREATE INDEX IF NOT EXISTS idx_batch_tasks_status ON batch_tasks(status);
      `);

      // Create worktrees table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS worktrees (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          path TEXT NOT NULL,
          branchName TEXT NOT NULL,
          baseBranch TEXT,
          repositoryPath TEXT NOT NULL,
          status TEXT DEFAULT 'active',
          metadata TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(name, repositoryPath)
        )
      `);

      // Create indexes for worktrees
      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_worktrees_repositoryPath ON worktrees(repositoryPath);
        CREATE INDEX IF NOT EXISTS idx_worktrees_status ON worktrees(status);
      `);

      // Create sessions table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY,
          user_id TEXT,
          status TEXT DEFAULT 'active' CHECK(status IN ('active', 'paused', 'completed', 'expired')),
          context TEXT,
          metadata TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          expires_at DATETIME
        )
      `);

      // Create conversation_turns table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS conversation_turns (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          session_id TEXT NOT NULL,
          turn_number INTEGER NOT NULL,
          instruction TEXT NOT NULL,
          response TEXT,
          metadata TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
        )
      `);

      // Add session_id to tasks table if not exists
      try {
        this.db.exec(`ALTER TABLE tasks ADD COLUMN session_id TEXT REFERENCES sessions(id)`);
      } catch (error) {
        // Column may already exist
      }

      // Create indexes for sessions
      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
        CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
        CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
        CREATE INDEX IF NOT EXISTS idx_conversation_turns_session_id ON conversation_turns(session_id);
        CREATE INDEX IF NOT EXISTS idx_tasks_session_id ON tasks(session_id);
      `);

      logger.debug("Database migrations completed");
    } catch (error) {
      logger.error("Database migration failed", { error });
      throw error;
    }
  }
}

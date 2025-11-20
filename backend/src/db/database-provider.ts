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
          sdk_session_id TEXT,
          UNIQUE(id)
        )
      `);

      // Create indexes
      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
        CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at);
        CREATE INDEX IF NOT EXISTS idx_tasks_groupId ON tasks(group_id);
        CREATE INDEX IF NOT EXISTS idx_tasks_repositoryName ON tasks(repository_name);
        CREATE INDEX IF NOT EXISTS idx_tasks_sdk_session_id ON tasks(sdk_session_id);
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

      // Add conversation_history column to tasks table if not exists
      try {
        this.db.exec(`ALTER TABLE tasks ADD COLUMN conversation_history TEXT`);
      } catch (error) {
        // Column may already exist
      }

      // Add continued_from column to tasks table if not exists
      try {
        this.db.exec(`ALTER TABLE tasks ADD COLUMN continued_from TEXT`);
      } catch (error) {
        // Column may already exist
      }

      // Add progress_data column to tasks table if not exists
      try {
        this.db.exec(`ALTER TABLE tasks ADD COLUMN progress_data TEXT`);
      } catch (error) {
        // Column may already exist
      }

      // Add executor column to tasks table if not exists (Multi-Agent SDK support)
      try {
        this.db.exec(`ALTER TABLE tasks ADD COLUMN executor TEXT DEFAULT 'claude'`);
      } catch (error) {
        // Column may already exist
      }

      // Add executor_metadata column to tasks table if not exists (Multi-Agent SDK support)
      try {
        this.db.exec(`ALTER TABLE tasks ADD COLUMN executor_metadata TEXT`);
      } catch (error) {
        // Column may already exist
      }

      // Create indexes for sessions and executor
      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
        CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
        CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
        CREATE INDEX IF NOT EXISTS idx_conversation_turns_session_id ON conversation_turns(session_id);
        CREATE INDEX IF NOT EXISTS idx_tasks_session_id ON tasks(session_id);
        CREATE INDEX IF NOT EXISTS idx_tasks_has_conversation ON tasks(id) WHERE conversation_history IS NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_tasks_executor ON tasks(executor);
      `);

      // Create task_groups table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS task_groups (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          execution_mode TEXT NOT NULL CHECK(execution_mode IN ('sequential', 'parallel', 'mixed')),
          max_parallel INTEGER,
          session_id TEXT,
          status TEXT NOT NULL CHECK(status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
          error TEXT,
          progress_completed INTEGER DEFAULT 0,
          progress_total INTEGER NOT NULL,
          progress_percentage INTEGER DEFAULT 0,
          current_task TEXT,
          started_at DATETIME NOT NULL,
          completed_at DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create task_group_tasks table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS task_group_tasks (
          id TEXT PRIMARY KEY,
          group_id TEXT NOT NULL,
          name TEXT NOT NULL,
          instruction TEXT NOT NULL,
          dependencies TEXT,
          context TEXT,
          options TEXT,
          status TEXT NOT NULL CHECK(status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
          result TEXT,
          error TEXT,
          execution_order INTEGER NOT NULL,
          started_at DATETIME,
          completed_at DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (group_id) REFERENCES task_groups(id) ON DELETE CASCADE
        )
      `);

      // Create indexes for task groups
      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_task_groups_status ON task_groups(status);
        CREATE INDEX IF NOT EXISTS idx_task_groups_session_id ON task_groups(session_id);
        CREATE INDEX IF NOT EXISTS idx_task_groups_started_at ON task_groups(started_at);
        CREATE INDEX IF NOT EXISTS idx_task_group_tasks_group_id ON task_group_tasks(group_id);
        CREATE INDEX IF NOT EXISTS idx_task_group_tasks_status ON task_group_tasks(status);
      `);

      // Create task_group_logs table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS task_group_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          group_id TEXT NOT NULL,
          task_id TEXT NOT NULL,
          task_name TEXT NOT NULL,
          log_message TEXT NOT NULL,
          log_level TEXT CHECK(log_level IN ('info', 'warning', 'error', 'debug')),
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (group_id) REFERENCES task_groups(id) ON DELETE CASCADE
        )
      `);

      // Create index for task_group_logs
      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_task_group_logs_group_id ON task_group_logs(group_id);
        CREATE INDEX IF NOT EXISTS idx_task_group_logs_task_id ON task_group_logs(task_id);
      `);

      // Create triggers for updated_at columns
      this.db.exec(`
        CREATE TRIGGER IF NOT EXISTS update_task_groups_timestamp 
        AFTER UPDATE ON task_groups 
        BEGIN
          UPDATE task_groups SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
        END;

        CREATE TRIGGER IF NOT EXISTS update_task_group_tasks_timestamp 
        AFTER UPDATE ON task_group_tasks 
        BEGIN
          UPDATE task_group_tasks SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
        END;
      `);

      // Schedule persistence migration (010_add_schedule_persistence.sql)
      this.db.exec(`
        -- スケジュール設定テーブル
        CREATE TABLE IF NOT EXISTS schedules (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          task_request TEXT NOT NULL,  -- JSON: TaskRequest
          schedule_type TEXT NOT NULL CHECK(schedule_type IN ('cron', 'once')),
          cron_expression TEXT,
          execute_at DATETIME,
          timezone TEXT DEFAULT 'Asia/Tokyo',
          status TEXT NOT NULL CHECK(status IN ('active', 'inactive', 'completed', 'failed')),
          metadata TEXT NOT NULL,      -- JSON: metadata (createdAt, updatedAt, etc.)
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        -- スケジュール実行履歴テーブル
        CREATE TABLE IF NOT EXISTS schedule_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          schedule_id TEXT NOT NULL,
          executed_at DATETIME NOT NULL,
          task_id TEXT NOT NULL,
          status TEXT NOT NULL CHECK(status IN ('success', 'failure')),
          error TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE
        );

        -- スケジュールのセッション状態管理テーブル
        CREATE TABLE IF NOT EXISTS schedule_session_state (
          schedule_id TEXT PRIMARY KEY,
          execution_count INTEGER DEFAULT 0,
          last_session_reset DATETIME,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE
        );
      `);

      // Create indexes for schedule tables
      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_schedules_status ON schedules(status);
        CREATE INDEX IF NOT EXISTS idx_schedules_schedule_type ON schedules(schedule_type);
        CREATE INDEX IF NOT EXISTS idx_schedule_history_schedule_id ON schedule_history(schedule_id);
        CREATE INDEX IF NOT EXISTS idx_schedule_history_executed_at ON schedule_history(executed_at);
        CREATE INDEX IF NOT EXISTS idx_schedule_session_state_updated_at ON schedule_session_state(updated_at);
      `);

      // Chat sessions table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS chat_sessions (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          character_id TEXT NOT NULL,
          working_directory TEXT,
          executor TEXT DEFAULT 'claude',
          sdk_session_id TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Chat messages table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS chat_messages (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          role TEXT NOT NULL CHECK(role IN ('user', 'agent')),
          content TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
        )
      `);

      // Custom characters table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS custom_characters (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          name TEXT NOT NULL,
          avatar TEXT,
          description TEXT,
          system_prompt TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create indexes for chat tables
      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);
        CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);
        CREATE INDEX IF NOT EXISTS idx_custom_characters_user_id ON custom_characters(user_id);
      `);

      logger.debug("Database migrations completed");
    } catch (error) {
      logger.error("Database migration failed", { error });
      throw error;
    }
  }
}

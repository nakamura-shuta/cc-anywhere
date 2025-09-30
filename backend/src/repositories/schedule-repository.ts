import type { Database } from "better-sqlite3";
import { BaseRepository } from "./base-repository.js";
import type {
  ScheduledTask,
  ScheduleFilter,
  ScheduleSessionState,
  PersistentScheduledTaskHistory,
} from "../types/scheduled-task.js";
import type { TaskRequest } from "../claude/types.js";
import { logger } from "../utils/logger.js";

export class ScheduleRepository extends BaseRepository<ScheduledTask, string> {
  protected tableName = "schedules";

  constructor(db: Database) {
    super(db);
  }

  protected mapRowToEntity(row: any): ScheduledTask {
    return {
      id: row.id,
      name: row.name,
      description: row.description || undefined,
      taskRequest: JSON.parse(row.task_request) as TaskRequest,
      schedule: {
        type: row.schedule_type,
        expression: row.cron_expression || undefined,
        executeAt: row.execute_at ? new Date(row.execute_at) : undefined,
        timezone: row.timezone || "Asia/Tokyo",
      },
      status: row.status,
      metadata: JSON.parse(row.metadata),
      history: [], // History is loaded separately
    };
  }

  protected override serializeEntity(entity: Partial<ScheduledTask>): Record<string, unknown> {
    const data: Record<string, unknown> = {};

    if (entity.id !== undefined) data.id = entity.id;
    if (entity.name !== undefined) data.name = entity.name;
    if (entity.description !== undefined) data.description = entity.description;
    if (entity.taskRequest !== undefined) data.task_request = JSON.stringify(entity.taskRequest);
    if (entity.schedule !== undefined) {
      data.schedule_type = entity.schedule.type;
      data.cron_expression = entity.schedule.expression || null;
      data.execute_at = entity.schedule.executeAt ? entity.schedule.executeAt.toISOString() : null;
      data.timezone = entity.schedule.timezone || "Asia/Tokyo";
    }
    if (entity.status !== undefined) data.status = entity.status;
    if (entity.metadata !== undefined) {
      data.metadata = JSON.stringify({
        createdAt:
          entity.metadata.createdAt instanceof Date
            ? entity.metadata.createdAt.toISOString()
            : entity.metadata.createdAt,
        updatedAt:
          entity.metadata.updatedAt instanceof Date
            ? entity.metadata.updatedAt.toISOString()
            : entity.metadata.updatedAt,
        lastExecutedAt:
          entity.metadata.lastExecutedAt instanceof Date
            ? entity.metadata.lastExecutedAt.toISOString()
            : entity.metadata.lastExecutedAt,
        nextExecuteAt:
          entity.metadata.nextExecuteAt instanceof Date
            ? entity.metadata.nextExecuteAt.toISOString()
            : entity.metadata.nextExecuteAt,
        executionCount: entity.metadata.executionCount,
      });
    }

    return data;
  }

  async findWithFilter(filter: ScheduleFilter): Promise<ScheduledTask[]> {
    try {
      const conditions: string[] = [];
      const values: unknown[] = [];

      if (filter.status) {
        conditions.push("status = ?");
        values.push(filter.status);
      }

      if (filter.scheduleType) {
        conditions.push("schedule_type = ?");
        values.push(filter.scheduleType);
      }

      if (filter.createdAfter) {
        conditions.push("created_at >= ?");
        values.push(filter.createdAfter.toISOString());
      }

      if (filter.createdBefore) {
        conditions.push("created_at <= ?");
        values.push(filter.createdBefore.toISOString());
      }

      let query = `SELECT * FROM ${this.tableName}`;
      if (conditions.length > 0) {
        query += ` WHERE ${conditions.join(" AND ")}`;
      }

      if (filter.limit) {
        const offset = filter.offset || 0;
        query += ` LIMIT ${filter.limit} OFFSET ${offset}`;
      }

      const stmt = this.db.prepare(query);
      const rows = stmt.all(...values);
      return rows.map((row) => this.mapRowToEntity(row));
    } catch (error) {
      logger.error("Error finding schedules with filter", { filter, error });
      throw error;
    }
  }

  async addHistory(entry: Omit<PersistentScheduledTaskHistory, "id" | "createdAt">): Promise<void> {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO schedule_history (schedule_id, executed_at, task_id, status, error)
        VALUES (?, ?, ?, ?, ?)
      `);

      stmt.run(
        entry.scheduleId,
        entry.executedAt.toISOString(),
        entry.taskId,
        entry.status,
        entry.error || null,
      );
    } catch (error) {
      logger.error("Error adding schedule history", { entry, error });
      throw error;
    }
  }

  async getHistory(scheduleId: string): Promise<PersistentScheduledTaskHistory[]> {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM schedule_history 
        WHERE schedule_id = ? 
        ORDER BY executed_at ASC
      `);

      const rows = stmt.all(scheduleId);
      return rows.map((row: any) => ({
        id: row.id,
        scheduleId: row.schedule_id,
        executedAt: new Date(row.executed_at),
        taskId: row.task_id,
        status: row.status,
        error: row.error ? row.error : undefined,
        createdAt: new Date(row.created_at),
      }));
    } catch (error) {
      logger.error("Error getting schedule history", { scheduleId, error });
      throw error;
    }
  }

  async deleteOldHistory(cutoffDate: Date): Promise<void> {
    try {
      const stmt = this.db.prepare(`
        DELETE FROM schedule_history 
        WHERE executed_at < ?
      `);

      stmt.run(cutoffDate.toISOString());
    } catch (error) {
      logger.error("Error deleting old schedule history", { cutoffDate, error });
      throw error;
    }
  }

  async getSessionState(scheduleId: string): Promise<ScheduleSessionState> {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM schedule_session_state 
        WHERE schedule_id = ?
      `);

      const row = stmt.get(scheduleId) as any;

      if (!row) {
        // Initialize session state if not exists
        const initStmt = this.db.prepare(`
          INSERT INTO schedule_session_state (schedule_id, execution_count, updated_at)
          VALUES (?, 0, ?)
        `);

        const now = new Date();
        initStmt.run(scheduleId, now.toISOString());

        return {
          scheduleId,
          executionCount: 0,
          lastSessionReset: undefined,
          updatedAt: now,
        };
      }

      return {
        scheduleId: row.schedule_id,
        executionCount: row.execution_count,
        lastSessionReset: row.last_session_reset ? new Date(row.last_session_reset) : undefined,
        updatedAt: new Date(row.updated_at),
      };
    } catch (error) {
      logger.error("Error getting session state", { scheduleId, error });
      throw error;
    }
  }

  async updateSessionState(state: ScheduleSessionState): Promise<void> {
    try {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO schedule_session_state 
        (schedule_id, execution_count, last_session_reset, updated_at)
        VALUES (?, ?, ?, ?)
      `);

      stmt.run(
        state.scheduleId,
        state.executionCount,
        state.lastSessionReset ? state.lastSessionReset.toISOString() : null,
        state.updatedAt.toISOString(),
      );
    } catch (error) {
      logger.error("Error updating session state", { state, error });
      throw error;
    }
  }

  async incrementExecutionCount(scheduleId: string): Promise<void> {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO schedule_session_state (schedule_id, execution_count, updated_at)
        VALUES (?, 1, ?)
        ON CONFLICT(schedule_id) DO UPDATE SET
          execution_count = execution_count + 1,
          updated_at = ?
      `);

      const now = new Date().toISOString();
      stmt.run(scheduleId, now, now);
    } catch (error) {
      logger.error("Error incrementing execution count", { scheduleId, error });
      throw error;
    }
  }

  async resetExecutionCount(scheduleId: string): Promise<void> {
    try {
      const now = new Date();
      const stmt = this.db.prepare(`
        INSERT INTO schedule_session_state (schedule_id, execution_count, last_session_reset, updated_at)
        VALUES (?, 0, ?, ?)
        ON CONFLICT(schedule_id) DO UPDATE SET
          execution_count = 0,
          last_session_reset = ?,
          updated_at = ?
      `);

      const nowIso = now.toISOString();
      stmt.run(scheduleId, nowIso, nowIso, nowIso, nowIso);
    } catch (error) {
      logger.error("Error resetting execution count", { scheduleId, error });
      throw error;
    }
  }
}

/**
 * SessionStore - sessions テーブルの CRUD
 */

import type { Database } from "better-sqlite3";
import { v4 as uuidv4 } from "uuid";
import type {
  Session,
  CreateSessionParams,
  SessionState,
} from "./types.js";

export class SessionStore {
  constructor(private db: Database) {}

  create(params: CreateSessionParams): Session {
    const id = uuidv4();
    const now = new Date();
    const expiresAt = params.expiresIn
      ? new Date(now.getTime() + params.expiresIn * 1000)
      : undefined;

    this.db.prepare(`
      INSERT INTO sessions (id, user_id, session_type, status, executor, character_id,
        working_directory, sdk_session_id, context, metadata, created_at, updated_at, expires_at)
      VALUES (?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      params.userId || null,
      params.type,
      params.executor || "claude",
      params.characterId || null,
      params.workingDirectory || null,
      params.sdkSessionId || null,
      params.context ? JSON.stringify(params.context) : null,
      params.metadata ? JSON.stringify(params.metadata) : null,
      now.toISOString(),
      now.toISOString(),
      expiresAt?.toISOString() || null,
    );

    return this.get(id)!;
  }

  get(id: string): Session | null {
    const row = this.db.prepare("SELECT * FROM sessions WHERE id = ?").get(id) as any;
    return row ? this.mapRow(row) : null;
  }

  list(filter?: { type?: string; userId?: string; status?: string }): Session[] {
    let sql = "SELECT * FROM sessions WHERE 1=1";
    const params: any[] = [];

    if (filter?.type) {
      sql += " AND session_type = ?";
      params.push(filter.type);
    }
    if (filter?.userId) {
      sql += " AND user_id = ?";
      params.push(filter.userId);
    }
    if (filter?.status) {
      sql += " AND status = ?";
      params.push(filter.status);
    }

    sql += " ORDER BY updated_at DESC";

    return this.db.prepare(sql).all(...params).map((row: any) => this.mapRow(row));
  }

  update(id: string, updates: Partial<Pick<Session, "status" | "context" | "metadata">>): void {
    const sets: string[] = ["updated_at = ?"];
    const params: any[] = [new Date().toISOString()];

    if (updates.status !== undefined) {
      sets.push("status = ?");
      params.push(updates.status);
    }
    if (updates.context !== undefined) {
      sets.push("context = ?");
      params.push(JSON.stringify(updates.context));
    }
    if (updates.metadata !== undefined) {
      sets.push("metadata = ?");
      params.push(JSON.stringify(updates.metadata));
    }

    params.push(id);
    this.db.prepare(`UPDATE sessions SET ${sets.join(", ")} WHERE id = ?`).run(...params);
  }

  delete(id: string): void {
    this.db.prepare("DELETE FROM sessions WHERE id = ?").run(id);
  }

  updateSdkSessionId(id: string, sdkSessionId: string): void {
    this.db.prepare(
      "UPDATE sessions SET sdk_session_id = ?, updated_at = ? WHERE id = ?",
    ).run(sdkSessionId, new Date().toISOString(), id);
  }

  updateSdkState(id: string, state: SessionState): void {
    this.db.prepare(
      "UPDATE sessions SET sdk_session_state = ?, updated_at = ? WHERE id = ?",
    ).run(state, new Date().toISOString(), id);
  }

  private mapRow(row: any): Session {
    return {
      id: row.id,
      userId: row.user_id || undefined,
      sessionType: row.session_type,
      status: row.status,
      executor: row.executor,
      characterId: row.character_id || undefined,
      workingDirectory: row.working_directory || undefined,
      sdkSessionId: row.sdk_session_id || undefined,
      sdkSessionState: row.sdk_session_state || undefined,
      context: row.context ? JSON.parse(row.context) : undefined,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      expiresAt: row.expires_at ? new Date(row.expires_at) : undefined,
    };
  }
}

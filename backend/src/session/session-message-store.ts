/**
 * SessionMessageStore - session_messages テーブルの CRUD
 */

import type { Database } from "better-sqlite3";
import { v4 as uuidv4 } from "uuid";
import type { SessionMessage, AddMessageParams } from "./types.js";

export class SessionMessageStore {
  constructor(private db: Database) {}

  add(params: AddMessageParams): SessionMessage {
    const id = uuidv4();
    const now = new Date();

    this.db.prepare(`
      INSERT INTO session_messages (id, session_id, turn_number, role, content, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      params.sessionId,
      params.turnNumber ?? null,
      params.role,
      params.content,
      params.metadata ? JSON.stringify(params.metadata) : null,
      now.toISOString(),
    );

    return {
      id,
      sessionId: params.sessionId,
      turnNumber: params.turnNumber,
      role: params.role,
      content: params.content,
      metadata: params.metadata,
      createdAt: now,
    };
  }

  list(sessionId: string, limit = 100, offset = 0): SessionMessage[] {
    return this.db.prepare(
      "SELECT * FROM session_messages WHERE session_id = ? ORDER BY created_at ASC LIMIT ? OFFSET ?",
    ).all(sessionId, limit, offset).map((row: any) => this.mapRow(row));
  }

  getNextTurnNumber(sessionId: string): number {
    const row = this.db.prepare(
      "SELECT MAX(turn_number) as max_turn FROM session_messages WHERE session_id = ?",
    ).get(sessionId) as any;
    return (row?.max_turn ?? 0) + 1;
  }

  private mapRow(row: any): SessionMessage {
    return {
      id: row.id,
      sessionId: row.session_id,
      turnNumber: row.turn_number ?? undefined,
      role: row.role,
      content: row.content,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      createdAt: new Date(row.created_at),
    };
  }
}

import { v4 as uuidv4 } from "uuid";
import { getSharedDbProvider } from "../db/shared-instance";
import type {
  Session,
  SessionStatus,
  CreateSessionRequest,
  ConversationTurn,
} from "../types/session";
import { logger } from "../utils/logger";

/**
 * セッション管理サービス
 * セッションの作成、更新、削除、会話履歴の管理を行う
 */
export class SessionManager {
  private db = getSharedDbProvider().getDb();

  /**
   * 新しいセッションを作成
   */
  async createSession(request: CreateSessionRequest): Promise<Session> {
    const sessionId = uuidv4();
    const now = new Date();
    const expiresAt = request.expiresIn ? new Date(now.getTime() + request.expiresIn * 1000) : null;

    const stmt = this.db.prepare(`
      INSERT INTO sessions (id, user_id, status, context, metadata, created_at, updated_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      sessionId,
      request.userId || null,
      "active",
      request.context ? JSON.stringify(request.context) : null,
      request.metadata ? JSON.stringify(request.metadata) : null,
      now.toISOString(),
      now.toISOString(),
      expiresAt ? expiresAt.toISOString() : null,
    );

    logger.info("Session created", { sessionId, userId: request.userId });

    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error("Failed to retrieve created session");
    }
    return session;
  }

  /**
   * セッション情報を取得
   */
  async getSession(sessionId: string): Promise<Session | null> {
    const stmt = this.db.prepare(`
      SELECT * FROM sessions WHERE id = ?
    `);

    const row = stmt.get(sessionId);
    if (!row) {
      return null;
    }

    return this.mapRowToSession(row);
  }

  /**
   * セッション情報を更新
   */
  async updateSession(
    sessionId: string,
    updates: Partial<Pick<Session, "status" | "context" | "metadata">>,
  ): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.status !== undefined) {
      fields.push("status = ?");
      values.push(updates.status);
    }

    if (updates.context !== undefined) {
      fields.push("context = ?");
      values.push(JSON.stringify(updates.context));
    }

    if (updates.metadata !== undefined) {
      fields.push("metadata = ?");
      values.push(JSON.stringify(updates.metadata));
    }

    if (fields.length === 0) {
      return;
    }

    fields.push("updated_at = ?");
    values.push(new Date().toISOString());
    values.push(sessionId);

    const sql = `UPDATE sessions SET ${fields.join(", ")} WHERE id = ?`;
    const stmt = this.db.prepare(sql);
    const result = stmt.run(...values);

    if (result.changes === 0) {
      throw new Error("Session not found");
    }

    logger.info("Session updated", { sessionId, updates });
  }

  /**
   * 会話ターンを追加
   */
  async addConversationTurn(turn: Omit<ConversationTurn, "id" | "createdAt">): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO conversation_turns (session_id, turn_number, instruction, response, metadata)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(
      turn.sessionId,
      turn.turnNumber,
      turn.instruction,
      turn.response || null,
      turn.metadata ? JSON.stringify(turn.metadata) : null,
    );

    // セッションのメタデータを更新（最終活動時刻とターン数）
    const session = await this.getSession(turn.sessionId);
    if (session) {
      const metadata = session.metadata || {};
      metadata.lastActivityAt = new Date();
      metadata.totalTurns = (metadata.totalTurns || 0) + 1;

      await this.updateSession(turn.sessionId, { metadata });
    }

    logger.info("Conversation turn added", {
      sessionId: turn.sessionId,
      turnNumber: turn.turnNumber,
    });
  }

  /**
   * 会話履歴を取得
   */
  async getConversationHistory(
    sessionId: string,
    limit?: number,
    offset?: number,
  ): Promise<ConversationTurn[]> {
    let sql = `
      SELECT * FROM conversation_turns 
      WHERE session_id = ? 
      ORDER BY turn_number ASC
    `;

    const params: any[] = [sessionId];

    if (limit !== undefined) {
      sql += " LIMIT ?";
      params.push(limit);

      if (offset !== undefined) {
        sql += " OFFSET ?";
        params.push(offset);
      }
    }

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params);

    return rows.map(this.mapRowToConversationTurn);
  }

  /**
   * アクティブなセッション一覧を取得
   */
  async getActiveSessions(userId?: string): Promise<Session[]> {
    let sql = `
      SELECT * FROM sessions 
      WHERE status = 'active' 
        AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
    `;

    const params: any[] = [];

    if (userId) {
      sql += " AND user_id = ?";
      params.push(userId);
    }

    sql += " ORDER BY updated_at DESC";

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params);

    return rows.map(this.mapRowToSession);
  }

  /**
   * 期限切れのセッションを無効化
   */
  async expireOldSessions(): Promise<number> {
    const stmt = this.db.prepare(`
      UPDATE sessions 
      SET status = 'expired', updated_at = CURRENT_TIMESTAMP
      WHERE status = 'active' 
        AND expires_at IS NOT NULL 
        AND expires_at <= CURRENT_TIMESTAMP
    `);

    const result = stmt.run();
    const expiredCount = result.changes;

    if (expiredCount > 0) {
      logger.info("Expired sessions", { count: expiredCount });
    }

    return expiredCount;
  }

  /**
   * セッションを削除
   */
  async deleteSession(sessionId: string): Promise<void> {
    const stmt = this.db.prepare(`
      DELETE FROM sessions WHERE id = ?
    `);

    const result = stmt.run(sessionId);

    if (result.changes === 0) {
      throw new Error("Session not found");
    }

    logger.info("Session deleted", { sessionId });
  }

  /**
   * 次のターン番号を取得
   */
  async getNextTurnNumber(sessionId: string): Promise<number> {
    const stmt = this.db.prepare(`
      SELECT MAX(turn_number) as max_turn FROM conversation_turns WHERE session_id = ?
    `);

    const row = stmt.get(sessionId) as { max_turn?: number } | undefined;
    return (row?.max_turn || 0) + 1;
  }

  /**
   * データベース行をSessionオブジェクトにマッピング
   */
  private mapRowToSession(row: any): Session {
    return {
      id: row.id,
      userId: row.user_id,
      status: row.status as SessionStatus,
      context: row.context ? JSON.parse(row.context) : undefined,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      expiresAt: row.expires_at ? new Date(row.expires_at) : undefined,
    };
  }

  /**
   * データベース行をConversationTurnオブジェクトにマッピング
   */
  private mapRowToConversationTurn(row: any): ConversationTurn {
    return {
      id: row.id,
      sessionId: row.session_id,
      turnNumber: row.turn_number,
      instruction: row.instruction,
      response: row.response,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      createdAt: new Date(row.created_at),
    };
  }
}

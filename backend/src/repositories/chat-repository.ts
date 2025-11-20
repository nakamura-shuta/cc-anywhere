/**
 * Chat repository for managing chat sessions, messages, and custom characters
 */

import type { Database } from "better-sqlite3";
import { BaseRepository } from "./base-repository.js";
import type { PaginatedResult, PaginationOptions } from "./types.js";
import { logger } from "../utils/logger.js";
import type { ExecutorType } from "../agents/types.js";

/**
 * Chat session entity
 */
export interface ChatSession {
  id: string;
  userId: string;
  characterId: string;
  workingDirectory?: string;
  executor: ExecutorType;
  sdkSessionId?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Chat message entity
 */
export interface ChatMessage {
  id: string;
  sessionId: string;
  role: "user" | "agent";
  content: string;
  createdAt: Date;
}

/**
 * Custom character entity
 */
export interface CustomCharacter {
  id: string;
  userId: string;
  name: string;
  avatar?: string;
  description?: string;
  systemPrompt: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Chat session repository
 */
export class ChatSessionRepository extends BaseRepository<ChatSession> {
  protected tableName = "chat_sessions";

  protected mapRowToEntity(row: any): ChatSession {
    return {
      id: row.id,
      userId: row.user_id,
      characterId: row.character_id,
      workingDirectory: row.working_directory || undefined,
      executor: row.executor || "claude",
      sdkSessionId: row.sdk_session_id || undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  protected serializeEntity(entity: Partial<ChatSession>): Record<string, unknown> {
    const data: Record<string, unknown> = {};

    if (entity.id !== undefined) data.id = entity.id;
    if (entity.userId !== undefined) data.user_id = entity.userId;
    if (entity.characterId !== undefined) data.character_id = entity.characterId;
    if (entity.workingDirectory !== undefined) data.working_directory = entity.workingDirectory;
    if (entity.executor !== undefined) data.executor = entity.executor;
    if (entity.sdkSessionId !== undefined) data.sdk_session_id = entity.sdkSessionId;
    if (entity.createdAt !== undefined) data.created_at = entity.createdAt.toISOString();
    if (entity.updatedAt !== undefined) data.updated_at = entity.updatedAt.toISOString();

    return data;
  }

  /**
   * Find sessions by user ID
   */
  async findByUserId(
    userId: string,
    options?: PaginationOptions,
  ): Promise<PaginatedResult<ChatSession>> {
    return this.findMany([{ field: "user_id", operator: "eq", value: userId }], options);
  }

  /**
   * Find sessions by user ID (simple array)
   */
  async findSessionsByUserId(userId: string): Promise<ChatSession[]> {
    try {
      const stmt = this.db.prepare(
        `SELECT * FROM ${this.tableName} WHERE user_id = ? ORDER BY updated_at DESC`,
      );
      const rows = stmt.all(userId);
      return rows.map((row) => this.mapRowToEntity(row));
    } catch (error) {
      logger.error("Error finding sessions by user id", { userId, error });
      throw error;
    }
  }

  /**
   * Update SDK session ID
   */
  async updateSdkSessionId(id: string, sdkSessionId: string): Promise<void> {
    try {
      const stmt = this.db.prepare(
        `UPDATE ${this.tableName} SET sdk_session_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      );
      stmt.run(sdkSessionId, id);
    } catch (error) {
      logger.error("Error updating SDK session ID", { id, sdkSessionId, error });
      throw error;
    }
  }

  /**
   * Touch session to update updated_at timestamp
   */
  async touchSession(id: string): Promise<void> {
    try {
      const stmt = this.db.prepare(
        `UPDATE ${this.tableName} SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      );
      stmt.run(id);
    } catch (error) {
      logger.error("Error touching session", { id, error });
      throw error;
    }
  }
}

/**
 * Chat message repository
 */
export class ChatMessageRepository extends BaseRepository<ChatMessage> {
  protected tableName = "chat_messages";

  protected mapRowToEntity(row: any): ChatMessage {
    return {
      id: row.id,
      sessionId: row.session_id,
      role: row.role,
      content: row.content,
      createdAt: new Date(row.created_at),
    };
  }

  protected serializeEntity(entity: Partial<ChatMessage>): Record<string, unknown> {
    const data: Record<string, unknown> = {};

    if (entity.id !== undefined) data.id = entity.id;
    if (entity.sessionId !== undefined) data.session_id = entity.sessionId;
    if (entity.role !== undefined) data.role = entity.role;
    if (entity.content !== undefined) data.content = entity.content;
    if (entity.createdAt !== undefined) data.created_at = entity.createdAt.toISOString();

    return data;
  }

  /**
   * Find messages by session ID
   */
  async findBySessionId(sessionId: string): Promise<ChatMessage[]> {
    try {
      const stmt = this.db.prepare(
        `SELECT * FROM ${this.tableName} WHERE session_id = ? ORDER BY created_at ASC`,
      );
      const rows = stmt.all(sessionId);
      return rows.map((row) => this.mapRowToEntity(row));
    } catch (error) {
      logger.error("Error finding messages by session id", { sessionId, error });
      throw error;
    }
  }

  /**
   * Get message count by session ID
   */
  async countBySessionId(sessionId: string): Promise<number> {
    try {
      const stmt = this.db.prepare(
        `SELECT COUNT(*) as count FROM ${this.tableName} WHERE session_id = ?`,
      );
      const result = stmt.get(sessionId) as { count: number };
      return result.count;
    } catch (error) {
      logger.error("Error counting messages by session id", { sessionId, error });
      throw error;
    }
  }

  /**
   * Delete all messages for a session
   */
  async deleteBySessionId(sessionId: string): Promise<number> {
    try {
      const stmt = this.db.prepare(`DELETE FROM ${this.tableName} WHERE session_id = ?`);
      const result = stmt.run(sessionId);
      return result.changes;
    } catch (error) {
      logger.error("Error deleting messages by session id", { sessionId, error });
      throw error;
    }
  }
}

/**
 * Custom character repository
 */
export class CustomCharacterRepository extends BaseRepository<CustomCharacter> {
  protected tableName = "custom_characters";

  protected mapRowToEntity(row: any): CustomCharacter {
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      avatar: row.avatar || undefined,
      description: row.description || undefined,
      systemPrompt: row.system_prompt,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  protected serializeEntity(entity: Partial<CustomCharacter>): Record<string, unknown> {
    const data: Record<string, unknown> = {};

    if (entity.id !== undefined) data.id = entity.id;
    if (entity.userId !== undefined) data.user_id = entity.userId;
    if (entity.name !== undefined) data.name = entity.name;
    if (entity.avatar !== undefined) data.avatar = entity.avatar;
    if (entity.description !== undefined) data.description = entity.description;
    if (entity.systemPrompt !== undefined) data.system_prompt = entity.systemPrompt;
    if (entity.createdAt !== undefined) data.created_at = entity.createdAt.toISOString();
    if (entity.updatedAt !== undefined) data.updated_at = entity.updatedAt.toISOString();

    return data;
  }

  /**
   * Find characters by user ID
   */
  async findByUserId(userId: string): Promise<CustomCharacter[]> {
    try {
      const stmt = this.db.prepare(
        `SELECT * FROM ${this.tableName} WHERE user_id = ? ORDER BY name ASC`,
      );
      const rows = stmt.all(userId);
      return rows.map((row) => this.mapRowToEntity(row));
    } catch (error) {
      logger.error("Error finding characters by user id", { userId, error });
      throw error;
    }
  }

  /**
   * Find character by ID and user ID (for authorization)
   */
  async findByIdAndUserId(id: string, userId: string): Promise<CustomCharacter | null> {
    try {
      const stmt = this.db.prepare(`SELECT * FROM ${this.tableName} WHERE id = ? AND user_id = ?`);
      const row = stmt.get(id, userId);
      return row ? this.mapRowToEntity(row) : null;
    } catch (error) {
      logger.error("Error finding character by id and user id", { id, userId, error });
      throw error;
    }
  }
}

/**
 * Combined chat repository for convenience
 */
export class ChatRepository {
  public readonly sessions: ChatSessionRepository;
  public readonly messages: ChatMessageRepository;
  public readonly characters: CustomCharacterRepository;

  constructor(db: Database) {
    this.sessions = new ChatSessionRepository(db);
    this.messages = new ChatMessageRepository(db);
    this.characters = new CustomCharacterRepository(db);
  }
}

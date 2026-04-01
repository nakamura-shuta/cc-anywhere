/**
 * UserService - ユーザー登録・認証・管理
 */

import type { Database } from "better-sqlite3";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";

export interface User {
  id: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  authProvider: string;
  createdAt: Date;
  lastLoginAt?: Date;
}

export class UserService {
  constructor(private db: Database) {}

  /** ユーザー登録。API Key を生成して返す */
  register(username: string): { user: User; apiKey: string } {
    const id = uuidv4();
    const apiKey = `cc-${crypto.randomBytes(24).toString("hex")}`;
    const now = new Date();

    this.db.prepare(`
      INSERT INTO users (id, username, api_key, auth_provider, created_at)
      VALUES (?, ?, ?, 'local', ?)
    `).run(id, username, apiKey, now.toISOString());

    return { user: this.getById(id)!, apiKey };
  }

  /** API Key でユーザーを検索 */
  getByApiKey(apiKey: string): User | null {
    const row = this.db.prepare("SELECT * FROM users WHERE api_key = ?").get(apiKey) as any;
    return row ? this.mapRow(row) : null;
  }

  /** ID でユーザーを検索 */
  getById(id: string): User | null {
    const row = this.db.prepare("SELECT * FROM users WHERE id = ?").get(id) as any;
    return row ? this.mapRow(row) : null;
  }

  /** ユーザー名でユーザーを検索 */
  getByUsername(username: string): User | null {
    const row = this.db.prepare("SELECT * FROM users WHERE username = ?").get(username) as any;
    return row ? this.mapRow(row) : null;
  }

  /** last_login_at を更新 */
  updateLastLogin(id: string): void {
    this.db.prepare("UPDATE users SET last_login_at = ? WHERE id = ?")
      .run(new Date().toISOString(), id);
  }

  /** API Key を再発行 */
  regenerateApiKey(id: string): string {
    const newKey = `cc-${crypto.randomBytes(24).toString("hex")}`;
    this.db.prepare("UPDATE users SET api_key = ? WHERE id = ?").run(newKey, id);
    return newKey;
  }

  /** ユーザー数を取得 */
  count(): number {
    const row = this.db.prepare("SELECT COUNT(*) as count FROM users").get() as any;
    return row.count;
  }

  private mapRow(row: any): User {
    return {
      id: row.id,
      username: row.username,
      displayName: row.display_name || undefined,
      avatarUrl: row.avatar_url || undefined,
      authProvider: row.auth_provider,
      createdAt: new Date(row.created_at),
      lastLoginAt: row.last_login_at ? new Date(row.last_login_at) : undefined,
    };
  }
}

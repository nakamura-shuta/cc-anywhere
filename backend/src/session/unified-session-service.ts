/**
 * UnifiedSessionService - 統合セッション管理のファサード
 *
 * 3つの内部モジュールを公開:
 * - sessions: SessionStore (sessions テーブル CRUD)
 * - messages: SessionMessageStore (session_messages テーブル CRUD)
 * - runtime: V2SessionRuntime (SDKSession pool + SDK utilities)
 */

import type { Database } from "better-sqlite3";
import { SessionStore } from "./session-store.js";
import { SessionMessageStore } from "./session-message-store.js";
import { V2SessionRuntime } from "./v2-session-runtime.js";

export class UnifiedSessionService {
  readonly sessions: SessionStore;
  readonly messages: SessionMessageStore;
  readonly runtime: V2SessionRuntime;

  constructor(db: Database) {
    this.sessions = new SessionStore(db);
    this.messages = new SessionMessageStore(db);
    this.runtime = new V2SessionRuntime();
  }
}

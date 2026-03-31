import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { SessionStore } from "../../../src/session/session-store.js";

function createTestDb(): Database.Database {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      session_type TEXT NOT NULL DEFAULT 'task',
      status TEXT NOT NULL DEFAULT 'active',
      executor TEXT NOT NULL DEFAULT 'claude',
      character_id TEXT,
      working_directory TEXT,
      sdk_session_id TEXT,
      sdk_session_state TEXT DEFAULT 'idle',
      context TEXT,
      metadata TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME
    )
  `);
  return db;
}

describe("SessionStore", () => {
  let db: Database.Database;
  let store: SessionStore;

  beforeEach(() => {
    db = createTestDb();
    store = new SessionStore(db);
  });

  describe("create", () => {
    it("should create a task session", () => {
      const session = store.create({ type: "task" });
      expect(session.id).toBeDefined();
      expect(session.sessionType).toBe("task");
      expect(session.status).toBe("active");
      expect(session.executor).toBe("claude");
    });

    it("should create a chat session with characterId", () => {
      const session = store.create({
        type: "chat",
        characterId: "assistant-1",
        workingDirectory: "/my/project",
      });
      expect(session.sessionType).toBe("chat");
      expect(session.characterId).toBe("assistant-1");
      expect(session.workingDirectory).toBe("/my/project");
    });

    it("should set sdkSessionId when provided", () => {
      const session = store.create({ type: "chat", sdkSessionId: "sdk-123" });
      expect(session.sdkSessionId).toBe("sdk-123");
    });

    it("should set expiresAt when expiresIn provided", () => {
      const session = store.create({ type: "task", expiresIn: 3600 });
      expect(session.expiresAt).toBeDefined();
    });
  });

  describe("get", () => {
    it("should return session by id", () => {
      const created = store.create({ type: "task" });
      const found = store.get(created.id);
      expect(found).not.toBeNull();
      expect(found!.id).toBe(created.id);
    });

    it("should return null for unknown id", () => {
      expect(store.get("nonexistent")).toBeNull();
    });
  });

  describe("list", () => {
    it("should list all sessions", () => {
      store.create({ type: "task" });
      store.create({ type: "chat" });
      expect(store.list()).toHaveLength(2);
    });

    it("should filter by type", () => {
      store.create({ type: "task" });
      store.create({ type: "chat" });
      expect(store.list({ type: "chat" })).toHaveLength(1);
    });

    it("should filter by userId", () => {
      store.create({ type: "task", userId: "user-1" });
      store.create({ type: "task", userId: "user-2" });
      expect(store.list({ userId: "user-1" })).toHaveLength(1);
    });
  });

  describe("update", () => {
    it("should update status", () => {
      const session = store.create({ type: "task" });
      store.update(session.id, { status: "completed" });
      expect(store.get(session.id)!.status).toBe("completed");
    });
  });

  describe("delete", () => {
    it("should delete session", () => {
      const session = store.create({ type: "task" });
      store.delete(session.id);
      expect(store.get(session.id)).toBeNull();
    });
  });

  describe("updateSdkSessionId", () => {
    it("should update sdk_session_id", () => {
      const session = store.create({ type: "chat" });
      store.updateSdkSessionId(session.id, "new-sdk-id");
      expect(store.get(session.id)!.sdkSessionId).toBe("new-sdk-id");
    });
  });

  describe("updateSdkState", () => {
    it("should update sdk_session_state", () => {
      const session = store.create({ type: "chat" });
      store.updateSdkState(session.id, "running");
      expect(store.get(session.id)!.sdkSessionState).toBe("running");
    });
  });
});

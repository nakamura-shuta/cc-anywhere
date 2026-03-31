import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { SessionMessageStore } from "../../../src/session/session-message-store.js";

function createTestDb(): Database.Database {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE sessions (id TEXT PRIMARY KEY);
    CREATE TABLE session_messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      turn_number INTEGER,
      role TEXT NOT NULL CHECK(role IN ('user','agent','system')),
      content TEXT NOT NULL,
      metadata TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.prepare("INSERT INTO sessions (id) VALUES (?)").run("sess-1");
  return db;
}

describe("SessionMessageStore", () => {
  let db: Database.Database;
  let store: SessionMessageStore;

  beforeEach(() => {
    db = createTestDb();
    store = new SessionMessageStore(db);
  });

  describe("add", () => {
    it("should add a message", () => {
      const msg = store.add({ sessionId: "sess-1", role: "user", content: "hello" });
      expect(msg.id).toBeDefined();
      expect(msg.role).toBe("user");
      expect(msg.content).toBe("hello");
    });

    it("should add message with turn number", () => {
      const msg = store.add({ sessionId: "sess-1", role: "agent", content: "reply", turnNumber: 1 });
      expect(msg.turnNumber).toBe(1);
    });

    it("should add message with metadata", () => {
      const msg = store.add({
        sessionId: "sess-1",
        role: "user",
        content: "test",
        metadata: { taskId: "t-1" },
      });
      expect(msg.metadata).toEqual({ taskId: "t-1" });
    });
  });

  describe("list", () => {
    it("should list messages in order", () => {
      store.add({ sessionId: "sess-1", role: "user", content: "msg1" });
      store.add({ sessionId: "sess-1", role: "agent", content: "msg2" });
      const messages = store.list("sess-1");
      expect(messages).toHaveLength(2);
      expect(messages[0].content).toBe("msg1");
      expect(messages[1].content).toBe("msg2");
    });

    it("should respect limit and offset", () => {
      for (let i = 0; i < 5; i++) {
        store.add({ sessionId: "sess-1", role: "user", content: `msg${i}` });
      }
      expect(store.list("sess-1", 2)).toHaveLength(2);
      expect(store.list("sess-1", 10, 3)).toHaveLength(2);
    });
  });

  describe("getNextTurnNumber", () => {
    it("should return 1 for empty session", () => {
      expect(store.getNextTurnNumber("sess-1")).toBe(1);
    });

    it("should return next number after existing turns", () => {
      store.add({ sessionId: "sess-1", role: "user", content: "a", turnNumber: 1 });
      store.add({ sessionId: "sess-1", role: "agent", content: "b", turnNumber: 2 });
      expect(store.getNextTurnNumber("sess-1")).toBe(3);
    });
  });
});

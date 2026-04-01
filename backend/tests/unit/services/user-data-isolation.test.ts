/**
 * Data isolation tests - verify users cannot access each other's data
 */

import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { UserService } from "../../../src/services/user-service";
import { SessionStore } from "../../../src/session/session-store";
import { SessionMessageStore } from "../../../src/session/session-message-store";
import { WorkspaceService } from "../../../src/services/workspace-service";
import fs from "fs";
import path from "path";
import os from "os";
import AdmZip from "adm-zip";

function createTestDb(): Database.Database {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, api_key TEXT UNIQUE,
      display_name TEXT, avatar_url TEXT, auth_provider TEXT DEFAULT 'local',
      external_id TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, last_login_at DATETIME
    );
    CREATE TABLE sessions (
      id TEXT PRIMARY KEY, user_id TEXT, session_type TEXT NOT NULL DEFAULT 'task',
      status TEXT NOT NULL DEFAULT 'active', executor TEXT NOT NULL DEFAULT 'claude',
      character_id TEXT, working_directory TEXT, sdk_session_id TEXT,
      sdk_session_state TEXT DEFAULT 'idle', context TEXT, metadata TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME
    );
    CREATE TABLE session_messages (
      id TEXT PRIMARY KEY, session_id TEXT NOT NULL, turn_number INTEGER,
      role TEXT NOT NULL, content TEXT NOT NULL, metadata TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    );
    CREATE TABLE workspaces (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT NOT NULL, path TEXT NOT NULL,
      file_count INTEGER DEFAULT 0, total_size INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP, expires_at DATETIME
    );
  `);
  return db;
}

describe("Data Isolation", () => {
  let db: Database.Database;
  let userService: UserService;
  let sessionStore: SessionStore;
  let messageStore: SessionMessageStore;

  beforeEach(() => {
    db = createTestDb();
    userService = new UserService(db);
    sessionStore = new SessionStore(db);
    messageStore = new SessionMessageStore(db);
  });

  describe("User Registration", () => {
    it("should create users with unique API keys", () => {
      const user1 = userService.register("alice");
      const user2 = userService.register("bob");

      expect(user1.user.id).not.toBe(user2.user.id);
      expect(user1.apiKey).not.toBe(user2.apiKey);
      expect(user1.apiKey).toMatch(/^cc-/);
    });

    it("should reject duplicate usernames", () => {
      userService.register("alice");
      expect(() => userService.register("alice")).toThrow();
    });

    it("should find user by API key", () => {
      const { user, apiKey } = userService.register("alice");
      const found = userService.getByApiKey(apiKey);
      expect(found).not.toBeNull();
      expect(found!.id).toBe(user.id);
    });
  });

  describe("Session Isolation", () => {
    it("should separate chat sessions by user_id", () => {
      const user1 = userService.register("alice");
      const user2 = userService.register("bob");

      // Create sessions for each user
      sessionStore.create({ type: "chat", userId: user1.user.id, characterId: "assistant" });
      sessionStore.create({ type: "chat", userId: user1.user.id, characterId: "coder" });
      sessionStore.create({ type: "chat", userId: user2.user.id, characterId: "assistant" });

      // Each user sees only their own
      const aliceSessions = sessionStore.list({ userId: user1.user.id });
      const bobSessions = sessionStore.list({ userId: user2.user.id });

      expect(aliceSessions).toHaveLength(2);
      expect(bobSessions).toHaveLength(1);
    });

    it("should separate task sessions by user_id", () => {
      const user1 = userService.register("alice");
      const user2 = userService.register("bob");

      sessionStore.create({ type: "task", userId: user1.user.id });
      sessionStore.create({ type: "task", userId: user2.user.id });
      sessionStore.create({ type: "task", userId: user2.user.id });

      expect(sessionStore.list({ type: "task", userId: user1.user.id })).toHaveLength(1);
      expect(sessionStore.list({ type: "task", userId: user2.user.id })).toHaveLength(2);
    });
  });

  describe("Message Isolation", () => {
    it("should isolate messages via session ownership", () => {
      const user1 = userService.register("alice");
      const user2 = userService.register("bob");

      const sess1 = sessionStore.create({ type: "chat", userId: user1.user.id });
      const sess2 = sessionStore.create({ type: "chat", userId: user2.user.id });

      messageStore.add({ sessionId: sess1.id, role: "user", content: "Alice's message" });
      messageStore.add({ sessionId: sess2.id, role: "user", content: "Bob's message" });

      // Messages are scoped to session
      const aliceMessages = messageStore.list(sess1.id);
      const bobMessages = messageStore.list(sess2.id);

      expect(aliceMessages).toHaveLength(1);
      expect(aliceMessages[0].content).toBe("Alice's message");
      expect(bobMessages).toHaveLength(1);
      expect(bobMessages[0].content).toBe("Bob's message");
    });
  });

  describe("Workspace Isolation", () => {
    let workspaceService: WorkspaceService;
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ws-isolation-"));
      workspaceService = new WorkspaceService(db, tmpDir);
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    function createZip(files: Record<string, string>): Buffer {
      const zip = new AdmZip();
      for (const [name, content] of Object.entries(files)) {
        zip.addFile(name, Buffer.from(content));
      }
      return zip.toBuffer();
    }

    it("should separate workspaces by user_id", async () => {
      const user1 = userService.register("alice");
      const user2 = userService.register("bob");

      await workspaceService.create(user1.user.id, createZip({ "a.txt": "alice" }), "alice-ws");
      await workspaceService.create(user2.user.id, createZip({ "b.txt": "bob" }), "bob-ws");

      expect(workspaceService.listByUser(user1.user.id)).toHaveLength(1);
      expect(workspaceService.listByUser(user2.user.id)).toHaveLength(1);
      expect(workspaceService.listByUser(user1.user.id)[0].name).toBe("alice-ws");
    });

    it("should enforce ownership in getByUserAndId", async () => {
      const user1 = userService.register("alice");
      const user2 = userService.register("bob");

      const ws = await workspaceService.create(user1.user.id, createZip({ "a.txt": "test" }), "ws");

      expect(workspaceService.getByUserAndId(user1.user.id, ws.id)).not.toBeNull();
      expect(workspaceService.getByUserAndId(user2.user.id, ws.id)).toBeNull();
    });
  });

  describe("API Key Regeneration", () => {
    it("should invalidate old key and create new one", () => {
      const { user, apiKey: oldKey } = userService.register("alice");

      const newKey = userService.regenerateApiKey(user.id);

      expect(newKey).not.toBe(oldKey);
      expect(userService.getByApiKey(oldKey)).toBeNull();
      expect(userService.getByApiKey(newKey)).not.toBeNull();
    });
  });
});

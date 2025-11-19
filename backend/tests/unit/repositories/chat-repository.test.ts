import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import {
  ChatRepository,
  ChatSessionRepository,
  ChatMessageRepository,
  CustomCharacterRepository,
  type ChatSession,
  type ChatMessage,
  type CustomCharacter,
} from "../../../src/repositories/chat-repository";

describe("ChatRepository", () => {
  let db: Database.Database;
  let chatRepository: ChatRepository;

  beforeEach(() => {
    // Create in-memory database
    db = new Database(":memory:");

    // Create tables
    db.exec(`
      CREATE TABLE IF NOT EXISTS chat_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        character_id TEXT NOT NULL,
        working_directory TEXT,
        executor TEXT DEFAULT 'claude',
        sdk_session_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS chat_messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('user', 'agent')),
        content TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS custom_characters (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        avatar TEXT,
        description TEXT,
        system_prompt TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);
      CREATE INDEX IF NOT EXISTS idx_custom_characters_user_id ON custom_characters(user_id);
    `);

    chatRepository = new ChatRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  describe("ChatSessionRepository", () => {
    const testSession: ChatSession = {
      id: "session-1",
      userId: "user-1",
      characterId: "char-1",
      workingDirectory: "/test/dir",
      executor: "claude",
      sdkSessionId: undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it("should create a session", async () => {
      const created = await chatRepository.sessions.create(testSession);
      expect(created.id).toBe(testSession.id);
      expect(created.userId).toBe(testSession.userId);
    });

    it("should find session by id", async () => {
      await chatRepository.sessions.create(testSession);
      const found = await chatRepository.sessions.findById(testSession.id);
      expect(found).not.toBeNull();
      expect(found?.id).toBe(testSession.id);
      expect(found?.characterId).toBe(testSession.characterId);
    });

    it("should find sessions by user id", async () => {
      await chatRepository.sessions.create(testSession);
      await chatRepository.sessions.create({
        ...testSession,
        id: "session-2",
      });

      const sessions = await chatRepository.sessions.findSessionsByUserId("user-1");
      expect(sessions).toHaveLength(2);
    });

    it("should update SDK session id", async () => {
      await chatRepository.sessions.create(testSession);
      await chatRepository.sessions.updateSdkSessionId(testSession.id, "sdk-123");

      const found = await chatRepository.sessions.findById(testSession.id);
      expect(found?.sdkSessionId).toBe("sdk-123");
    });

    it("should delete a session", async () => {
      await chatRepository.sessions.create(testSession);
      const deleted = await chatRepository.sessions.delete(testSession.id);
      expect(deleted).toBe(true);

      const found = await chatRepository.sessions.findById(testSession.id);
      expect(found).toBeNull();
    });

    it("should return null for non-existent session", async () => {
      const found = await chatRepository.sessions.findById("non-existent");
      expect(found).toBeNull();
    });
  });

  describe("ChatMessageRepository", () => {
    const testSession: ChatSession = {
      id: "session-1",
      userId: "user-1",
      characterId: "char-1",
      executor: "claude",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const testMessage: ChatMessage = {
      id: "msg-1",
      sessionId: "session-1",
      role: "user",
      content: "Hello, world!",
      createdAt: new Date(),
    };

    beforeEach(async () => {
      await chatRepository.sessions.create(testSession);
    });

    it("should create a message", async () => {
      const created = await chatRepository.messages.create(testMessage);
      expect(created.id).toBe(testMessage.id);
      expect(created.content).toBe(testMessage.content);
    });

    it("should find messages by session id", async () => {
      await chatRepository.messages.create(testMessage);
      await chatRepository.messages.create({
        ...testMessage,
        id: "msg-2",
        role: "agent",
        content: "Hi there!",
      });

      const messages = await chatRepository.messages.findBySessionId("session-1");
      expect(messages).toHaveLength(2);
      // Should be ordered by created_at ASC
      expect(messages[0].id).toBe("msg-1");
      expect(messages[1].id).toBe("msg-2");
    });

    it("should count messages by session id", async () => {
      await chatRepository.messages.create(testMessage);
      await chatRepository.messages.create({
        ...testMessage,
        id: "msg-2",
      });

      const count = await chatRepository.messages.countBySessionId("session-1");
      expect(count).toBe(2);
    });

    it("should delete messages by session id", async () => {
      await chatRepository.messages.create(testMessage);
      await chatRepository.messages.create({
        ...testMessage,
        id: "msg-2",
      });

      const deleted = await chatRepository.messages.deleteBySessionId("session-1");
      expect(deleted).toBe(2);

      const messages = await chatRepository.messages.findBySessionId("session-1");
      expect(messages).toHaveLength(0);
    });

    it("should return empty array for non-existent session", async () => {
      const messages = await chatRepository.messages.findBySessionId("non-existent");
      expect(messages).toHaveLength(0);
    });
  });

  describe("CustomCharacterRepository", () => {
    const testCharacter: CustomCharacter = {
      id: "char-1",
      userId: "user-1",
      name: "Test Character",
      avatar: "https://example.com/avatar.png",
      description: "A test character",
      systemPrompt: "You are a helpful assistant.",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it("should create a character", async () => {
      const created = await chatRepository.characters.create(testCharacter);
      expect(created.id).toBe(testCharacter.id);
      expect(created.name).toBe(testCharacter.name);
    });

    it("should find character by id", async () => {
      await chatRepository.characters.create(testCharacter);
      const found = await chatRepository.characters.findById(testCharacter.id);
      expect(found).not.toBeNull();
      expect(found?.systemPrompt).toBe(testCharacter.systemPrompt);
    });

    it("should find characters by user id", async () => {
      await chatRepository.characters.create(testCharacter);
      await chatRepository.characters.create({
        ...testCharacter,
        id: "char-2",
        name: "Another Character",
      });

      const characters = await chatRepository.characters.findByUserId("user-1");
      expect(characters).toHaveLength(2);
      // Should be ordered by name ASC
      expect(characters[0].name).toBe("Another Character");
      expect(characters[1].name).toBe("Test Character");
    });

    it("should find character by id and user id for authorization", async () => {
      await chatRepository.characters.create(testCharacter);

      // Should find with correct user
      const found = await chatRepository.characters.findByIdAndUserId("char-1", "user-1");
      expect(found).not.toBeNull();

      // Should not find with wrong user
      const notFound = await chatRepository.characters.findByIdAndUserId("char-1", "user-2");
      expect(notFound).toBeNull();
    });

    it("should update a character", async () => {
      await chatRepository.characters.create(testCharacter);
      const updated = await chatRepository.characters.update(testCharacter.id, {
        name: "Updated Name",
        systemPrompt: "Updated prompt",
      });

      expect(updated).not.toBeNull();
      expect(updated?.name).toBe("Updated Name");
      expect(updated?.systemPrompt).toBe("Updated prompt");
    });

    it("should delete a character", async () => {
      await chatRepository.characters.create(testCharacter);
      const deleted = await chatRepository.characters.delete(testCharacter.id);
      expect(deleted).toBe(true);

      const found = await chatRepository.characters.findById(testCharacter.id);
      expect(found).toBeNull();
    });

    it("should handle character without optional fields", async () => {
      const minimalCharacter: CustomCharacter = {
        id: "char-minimal",
        userId: "user-1",
        name: "Minimal",
        systemPrompt: "You are minimal.",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const created = await chatRepository.characters.create(minimalCharacter);
      expect(created.avatar).toBeUndefined();
      expect(created.description).toBeUndefined();

      const found = await chatRepository.characters.findById(minimalCharacter.id);
      expect(found?.avatar).toBeUndefined();
      expect(found?.description).toBeUndefined();
    });
  });

  describe("Combined operations", () => {
    it("should handle session with messages flow", async () => {
      // Create session
      const session: ChatSession = {
        id: "session-flow",
        userId: "user-1",
        characterId: "char-1",
        executor: "claude",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await chatRepository.sessions.create(session);

      // Add messages
      await chatRepository.messages.create({
        id: "msg-1",
        sessionId: session.id,
        role: "user",
        content: "Hello",
        createdAt: new Date(),
      });

      await chatRepository.messages.create({
        id: "msg-2",
        sessionId: session.id,
        role: "agent",
        content: "Hi there!",
        createdAt: new Date(),
      });

      // Verify
      const messages = await chatRepository.messages.findBySessionId(session.id);
      expect(messages).toHaveLength(2);

      // Count
      const count = await chatRepository.messages.countBySessionId(session.id);
      expect(count).toBe(2);
    });

    it("should handle pagination for sessions", async () => {
      // Create multiple sessions
      for (let i = 1; i <= 5; i++) {
        await chatRepository.sessions.create({
          id: `session-${i}`,
          userId: "user-1",
          characterId: "char-1",
          executor: "claude",
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      // Get paginated results
      const result = await chatRepository.sessions.findByUserId("user-1", {
        page: 1,
        limit: 3,
      });

      expect(result.items).toHaveLength(3);
      expect(result.total).toBe(5);
      expect(result.totalPages).toBe(2);
    });
  });
});

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import type {
  SessionStatus,
  CreateSessionRequest,
  ConversationTurn,
} from "../../../src/types/session";

// モックデータベース
const mockDb = {
  prepare: vi.fn(),
  transaction: vi.fn((fn: any) => fn()),
};

vi.mock("../../../src/db/shared-instance", () => ({
  getDatabaseInstance: vi.fn(() => mockDb),
}));

// SessionManagerをモック後にimport
import { SessionManager } from "../../../src/services/session-manager";

describe("SessionManager", () => {
  let sessionManager: SessionManager;

  beforeEach(() => {
    vi.clearAllMocks();
    sessionManager = new SessionManager();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("createSession", () => {
    it("should create a new session with default values", async () => {
      const request: CreateSessionRequest = {
        metadata: { title: "Test Session" },
      };

      const mockSession = {
        id: "session-123",
        status: "active",
        context: null,
        metadata: JSON.stringify(request.metadata),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        expires_at: null,
      };

      mockDb.prepare
        .mockReturnValueOnce({
          run: vi.fn(() => ({ lastInsertRowid: 1 })),
        })
        .mockReturnValueOnce({
          get: vi.fn(() => mockSession),
        });

      const session = await sessionManager.createSession(request);

      expect(session).toBeDefined();
      expect(session.id).toBe("session-123");
      expect(session.status).toBe("active");
      expect(session.metadata?.title).toBe("Test Session");
      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO sessions"));
    });

    it("should create session with custom expiration", async () => {
      const request: CreateSessionRequest = {
        expiresIn: 3600, // 1時間
      };

      mockDb.prepare
        .mockReturnValueOnce({
          run: vi.fn(() => ({ lastInsertRowid: 1 })),
        })
        .mockReturnValueOnce({
          get: vi.fn(() => ({
            id: "session-456",
            status: "active",
            context: null,
            metadata: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 3600000).toISOString(),
          })),
        });

      const session = await sessionManager.createSession(request);

      expect(session.expiresAt).toBeDefined();
      expect(session.expiresAt!.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe("getSession", () => {
    it("should retrieve an existing session", async () => {
      const sessionId = "session-123";
      const mockSession = {
        id: sessionId,
        user_id: "user-1",
        status: "active",
        context: JSON.stringify({ workingDirectory: "/test" }),
        metadata: JSON.stringify({ title: "Test" }),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        expires_at: null,
      };

      mockDb.prepare.mockReturnValue({
        get: vi.fn(() => mockSession),
      });

      const session = await sessionManager.getSession(sessionId);

      expect(session).toBeDefined();
      expect(session!.id).toBe(sessionId);
      expect(session!.context?.workingDirectory).toBe("/test");
      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining("SELECT * FROM sessions"),
      );
    });

    it("should return null for non-existent session", async () => {
      mockDb.prepare.mockReturnValue({
        get: vi.fn(() => null),
      });

      const session = await sessionManager.getSession("non-existent");

      expect(session).toBeNull();
    });
  });

  describe("updateSession", () => {
    it("should update session status", async () => {
      const sessionId = "session-123";
      const updates = { status: "completed" as SessionStatus };

      mockDb.prepare.mockReturnValue({
        run: vi.fn(() => ({ changes: 1 })),
      });

      await sessionManager.updateSession(sessionId, updates);

      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining("UPDATE sessions"));
    });

    it("should throw error if session not found", async () => {
      mockDb.prepare.mockReturnValue({
        run: vi.fn(() => ({ changes: 0 })),
      });

      await expect(
        sessionManager.updateSession("non-existent", { status: "completed" }),
      ).rejects.toThrow("Session not found");
    });
  });

  describe("addConversationTurn", () => {
    it("should add a new conversation turn", async () => {
      const turn: Omit<ConversationTurn, "id" | "createdAt"> = {
        sessionId: "session-123",
        turnNumber: 1,
        instruction: "Test instruction",
        response: "Test response",
        metadata: { duration: 1000 },
      };

      const mockRun = vi.fn(() => ({ lastInsertRowid: 1 }));
      const mockGet = vi.fn(() => ({
        id: "session-123",
        user_id: null,
        status: "active",
        context: null,
        metadata: JSON.stringify({ totalTurns: 0 }),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        expires_at: null,
      }));

      mockDb.prepare
        .mockReturnValueOnce({ run: mockRun }) // INSERT INTO conversation_turns
        .mockReturnValueOnce({ get: mockGet }) // SELECT * FROM sessions
        .mockReturnValueOnce({ run: vi.fn(() => ({ changes: 1 })) }); // UPDATE sessions

      await sessionManager.addConversationTurn(turn);

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO conversation_turns"),
      );
      expect(mockRun).toHaveBeenCalledWith(
        turn.sessionId,
        turn.turnNumber,
        turn.instruction,
        turn.response,
        JSON.stringify(turn.metadata),
      );
    });
  });

  describe("getConversationHistory", () => {
    it("should retrieve conversation history for a session", async () => {
      const sessionId = "session-123";
      const mockTurns = [
        {
          id: 1,
          session_id: sessionId,
          turn_number: 1,
          instruction: "First instruction",
          response: "First response",
          metadata: JSON.stringify({ duration: 1000 }),
          created_at: new Date().toISOString(),
        },
        {
          id: 2,
          session_id: sessionId,
          turn_number: 2,
          instruction: "Second instruction",
          response: "Second response",
          metadata: null,
          created_at: new Date().toISOString(),
        },
      ];

      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => mockTurns),
      });

      const history = await sessionManager.getConversationHistory(sessionId);

      expect(history).toHaveLength(2);
      expect(history[0].instruction).toBe("First instruction");
      expect(history[0].metadata?.duration).toBe(1000);
      expect(history[1].turnNumber).toBe(2);
    });

    it("should respect limit and offset parameters", async () => {
      const sessionId = "session-123";
      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => []),
      });

      await sessionManager.getConversationHistory(sessionId, 10, 20);

      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining("LIMIT ? OFFSET ?"));
    });
  });

  describe("getActiveSessions", () => {
    it("should retrieve active sessions", async () => {
      const mockSessions = [
        {
          id: "session-1",
          status: "active",
          context: null,
          metadata: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          expires_at: null,
        },
        {
          id: "session-2",
          status: "active",
          context: null,
          metadata: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 3600000).toISOString(),
        },
      ];

      mockDb.prepare.mockReturnValue({
        all: vi.fn(() => mockSessions),
      });

      const sessions = await sessionManager.getActiveSessions();

      expect(sessions).toHaveLength(2);
      expect(sessions.every((s) => s.status === "active")).toBe(true);
    });
  });

  describe("expireOldSessions", () => {
    it("should expire sessions past their expiration date", async () => {
      const mockRun = vi.fn(() => ({ changes: 3 }));
      mockDb.prepare.mockReturnValue({ run: mockRun });

      const expiredCount = await sessionManager.expireOldSessions();

      expect(expiredCount).toBe(3);
      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining("UPDATE sessions"));
      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining("status = 'expired'"));
    });
  });
});

/**
 * ChatSessionService unit tests
 *
 * V2 Session API のライフサイクル管理をテスト
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { ChatSessionService } from "../../../../src/claude/session/chat-session-service.js";
import type { ManagedSession, CreateSessionParams } from "../../../../src/claude/session/chat-session-service.js";

// Mock SDK functions
const mockSend = vi.fn().mockResolvedValue(undefined);
const mockClose = vi.fn();
const mockAsyncDispose = vi.fn().mockResolvedValue(undefined);

function createMockSDKSession(opts: {
  sessionId?: string;
  sessionIdThrows?: boolean;
} = {}): any {
  let _sessionId = opts.sessionId;
  const _throws = opts.sessionIdThrows ?? false;

  return {
    get sessionId() {
      if (_throws && !_sessionId) {
        throw new Error("Session not initialized");
      }
      return _sessionId || "mock-session-id";
    },
    set _setSessionId(id: string) {
      _sessionId = id;
    },
    send: mockSend,
    stream: vi.fn(),
    close: mockClose,
    [Symbol.asyncDispose]: mockAsyncDispose,
  };
}

// Mock stream that yields events
async function* mockStream(events: any[]): AsyncGenerator<any, void> {
  for (const event of events) {
    yield event;
  }
}

vi.mock("@anthropic-ai/claude-agent-sdk", () => ({
  unstable_v2_createSession: vi.fn(),
  unstable_v2_resumeSession: vi.fn(),
  forkSession: vi.fn(),
}));

import {
  unstable_v2_createSession,
  unstable_v2_resumeSession,
  forkSession,
} from "@anthropic-ai/claude-agent-sdk";

const mockCreateSession = vi.mocked(unstable_v2_createSession);
const mockResumeSession = vi.mocked(unstable_v2_resumeSession);
const mockForkSession = vi.mocked(forkSession);

describe("ChatSessionService", () => {
  let service: ChatSessionService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ChatSessionService();
  });

  describe("create", () => {
    it("should create a draft session with sdkSessionId = null", () => {
      const mockSession = createMockSDKSession({ sessionIdThrows: true });
      mockCreateSession.mockReturnValue(mockSession);

      const managed = service.create({});

      expect(managed.sdkSessionId).toBeNull();
      expect(managed.state).toBe("idle");
      expect(managed.session).toBe(mockSession);
      expect(managed.lastActivityAt).toBeInstanceOf(Date);
    });

    it("should pass model to SDK", () => {
      const mockSession = createMockSDKSession({ sessionIdThrows: true });
      mockCreateSession.mockReturnValue(mockSession);

      service.create({ model: "claude-sonnet-4-6" });

      expect(mockCreateSession).toHaveBeenCalledWith(
        expect.objectContaining({ model: "claude-sonnet-4-6" }),
      );
    });

    it("should use default model from env", () => {
      const mockSession = createMockSDKSession({ sessionIdThrows: true });
      mockCreateSession.mockReturnValue(mockSession);
      process.env.CLAUDE_MODEL = "test-model";

      service.create({});

      expect(mockCreateSession).toHaveBeenCalledWith(
        expect.objectContaining({ model: "test-model" }),
      );

      delete process.env.CLAUDE_MODEL;
    });

    it("should pass allowedTools and disallowedTools", () => {
      const mockSession = createMockSDKSession({ sessionIdThrows: true });
      mockCreateSession.mockReturnValue(mockSession);

      service.create({
        allowedTools: ["Read", "Write"],
        disallowedTools: ["Bash"],
      });

      expect(mockCreateSession).toHaveBeenCalledWith(
        expect.objectContaining({
          allowedTools: ["Read", "Write"],
          disallowedTools: ["Bash"],
        }),
      );
    });

    it("should pass permissionMode", () => {
      const mockSession = createMockSDKSession({ sessionIdThrows: true });
      mockCreateSession.mockReturnValue(mockSession);

      service.create({ permissionMode: "bypassPermissions" as any });

      expect(mockCreateSession).toHaveBeenCalledWith(
        expect.objectContaining({ permissionMode: "bypassPermissions" }),
      );
    });

    it("should inject systemPrompt via hooks", () => {
      const mockSession = createMockSDKSession({ sessionIdThrows: true });
      mockCreateSession.mockReturnValue(mockSession);

      service.create({ systemPrompt: "You are a helpful assistant" });

      const callArgs = mockCreateSession.mock.calls[0][0];
      expect(callArgs.hooks).toBeDefined();
      expect(callArgs.hooks!.SessionStart).toBeDefined();
      expect(callArgs.hooks!.SessionStart!.length).toBeGreaterThan(0);
    });

    it("should not add hooks if no systemPrompt", () => {
      const mockSession = createMockSDKSession({ sessionIdThrows: true });
      mockCreateSession.mockReturnValue(mockSession);

      service.create({});

      const callArgs = mockCreateSession.mock.calls[0][0];
      expect(callArgs.hooks).toBeUndefined();
    });
  });

  describe("resume", () => {
    it("should resume with sdkSessionId immediately available", () => {
      const mockSession = createMockSDKSession({ sessionId: "existing-id" });
      mockResumeSession.mockReturnValue(mockSession);

      const managed = service.resume("existing-id", {});

      expect(managed.sdkSessionId).toBe("existing-id");
      expect(managed.state).toBe("idle");
      expect(managed.session).toBe(mockSession);
    });

    it("should register session in pool", () => {
      const mockSession = createMockSDKSession({ sessionId: "pool-test" });
      mockResumeSession.mockReturnValue(mockSession);

      service.resume("pool-test", {});

      expect(service.getPoolSize()).toBe(1);
    });

    it("should pass model and permissionMode", () => {
      const mockSession = createMockSDKSession({ sessionId: "test" });
      mockResumeSession.mockReturnValue(mockSession);

      service.resume("test", {
        model: "claude-opus-4-20250514",
        permissionMode: "bypassPermissions" as any,
      });

      expect(mockResumeSession).toHaveBeenCalledWith(
        "test",
        expect.objectContaining({
          model: "claude-opus-4-20250514",
          permissionMode: "bypassPermissions",
        }),
      );
    });
  });

  describe("sendAndStream", () => {
    it("should transition state to running then idle", async () => {
      const events = [
        { type: "system", sessionId: "new-id" },
        { type: "assistant", message: { content: [] } },
      ];
      const mockSession = createMockSDKSession({ sessionId: "new-id" });
      mockSession.stream.mockReturnValue(mockStream(events));
      mockCreateSession.mockReturnValue(mockSession);

      const managed = service.create({});
      const states: string[] = [];

      const collected: any[] = [];
      for await (const event of service.sendAndStream(managed, "hello", {
        onStateChanged: (s) => states.push(s),
      })) {
        collected.push(event);
      }

      expect(states[0]).toBe("running");
      expect(states[states.length - 1]).toBe("idle");
      expect(managed.state).toBe("idle");
    });

    it("should materialize draft session and call onMaterialized", async () => {
      const events = [
        { type: "system", session_id: "materialized-id" },
      ];
      const mockSession = createMockSDKSession({ sessionId: "materialized-id" });
      mockSession.stream.mockReturnValue(mockStream(events));
      mockCreateSession.mockReturnValue(mockSession);

      const managed = service.create({});
      expect(managed.sdkSessionId).toBeNull();

      const onMaterialized = vi.fn().mockResolvedValue(undefined);

      for await (const _event of service.sendAndStream(managed, "hello", {
        onMaterialized,
      })) {
        // consume
      }

      expect(onMaterialized).toHaveBeenCalledWith("materialized-id");
      expect(managed.sdkSessionId).toBe("materialized-id");
    });

    it("should await async onMaterialized callback", async () => {
      const events = [{ type: "system" }];
      const mockSession = createMockSDKSession({ sessionId: "async-test" });
      mockSession.stream.mockReturnValue(mockStream(events));
      mockCreateSession.mockReturnValue(mockSession);

      const managed = service.create({});
      let dbWritten = false;

      const onMaterialized = vi.fn().mockImplementation(async () => {
        await new Promise((r) => setTimeout(r, 10));
        dbWritten = true;
      });

      for await (const _event of service.sendAndStream(managed, "hello", {
        onMaterialized,
      })) {
        // consume
      }

      expect(dbWritten).toBe(true);
    });

    it("should not call onMaterialized for resumed sessions", async () => {
      const events = [{ type: "assistant", message: { content: [] } }];
      const mockSession = createMockSDKSession({ sessionId: "existing" });
      mockSession.stream.mockReturnValue(mockStream(events));
      mockResumeSession.mockReturnValue(mockSession);

      const managed = service.resume("existing", {});
      const onMaterialized = vi.fn();

      for await (const _event of service.sendAndStream(managed, "hello", {
        onMaterialized,
      })) {
        // consume
      }

      expect(onMaterialized).not.toHaveBeenCalled();
    });

    it("should update lastActivityAt on each stream event", async () => {
      const events = [
        { type: "system" },
        { type: "assistant", message: { content: [] } },
        { type: "result", subtype: "success" },
      ];
      const mockSession = createMockSDKSession({ sessionId: "ts-test" });
      mockSession.stream.mockReturnValue(mockStream(events));
      mockResumeSession.mockReturnValue(mockSession);

      const managed = service.resume("ts-test", {});
      const initialTime = managed.lastActivityAt.getTime();

      // Wait a tiny bit so timestamps differ
      await new Promise((r) => setTimeout(r, 5));

      for await (const _event of service.sendAndStream(managed, "hello")) {
        // consume
      }

      expect(managed.lastActivityAt.getTime()).toBeGreaterThan(initialTime);
    });

    it("should detect session_state_changed events", async () => {
      const events = [
        {
          type: "system",
          subtype: "session_state_changed",
          state: "requires_action",
        },
      ];
      const mockSession = createMockSDKSession({ sessionId: "state-test" });
      mockSession.stream.mockReturnValue(mockStream(events));
      mockResumeSession.mockReturnValue(mockSession);

      const managed = service.resume("state-test", {});
      const states: string[] = [];

      for await (const _event of service.sendAndStream(managed, "hello", {
        onStateChanged: (s) => states.push(s),
      })) {
        // consume
      }

      // running → requires_action → idle
      expect(states).toContain("running");
      expect(states).toContain("requires_action");
      expect(states).toContain("idle");
    });

    it("should call send with the message", async () => {
      const mockSession = createMockSDKSession({ sessionId: "send-test" });
      mockSession.stream.mockReturnValue(mockStream([]));
      mockResumeSession.mockReturnValue(mockSession);

      const managed = service.resume("send-test", {});
      for await (const _event of service.sendAndStream(managed, "test message")) {
        // consume
      }

      expect(mockSend).toHaveBeenCalledWith("test message");
    });

    it("should register draft session in pool after materialization", async () => {
      const events = [{ type: "system" }];
      const mockSession = createMockSDKSession({ sessionId: "pool-register" });
      mockSession.stream.mockReturnValue(mockStream(events));
      mockCreateSession.mockReturnValue(mockSession);

      const managed = service.create({});
      expect(service.getPoolSize()).toBe(0);

      for await (const _event of service.sendAndStream(managed, "hello")) {
        // consume
      }

      expect(service.getPoolSize()).toBe(1);
    });
  });

  describe("detach", () => {
    it("should remove session from pool without calling close", () => {
      const mockSession = createMockSDKSession({ sessionId: "detach-test" });
      mockResumeSession.mockReturnValue(mockSession);

      const managed = service.resume("detach-test", {});
      expect(service.getPoolSize()).toBe(1);

      service.detach(managed);

      expect(service.getPoolSize()).toBe(0);
      expect(mockClose).not.toHaveBeenCalled();
    });

    it("should handle draft sessions gracefully", () => {
      const mockSession = createMockSDKSession({ sessionIdThrows: true });
      mockCreateSession.mockReturnValue(mockSession);

      const managed = service.create({});
      expect(() => service.detach(managed)).not.toThrow();
    });
  });

  describe("terminate", () => {
    it("should call session.close and remove from pool", () => {
      const mockSession = createMockSDKSession({ sessionId: "term-test" });
      mockResumeSession.mockReturnValue(mockSession);

      const managed = service.resume("term-test", {});
      service.terminate(managed);

      expect(mockClose).toHaveBeenCalled();
      expect(service.getPoolSize()).toBe(0);
    });
  });

  describe("fork", () => {
    it("should call forkSession and return new sdkSessionId", async () => {
      mockForkSession.mockResolvedValue({ sessionId: "forked-id" });

      const result = await service.fork("original-id", { title: "fork" });

      expect(mockForkSession).toHaveBeenCalledWith("original-id", { title: "fork" });
      expect(result.sdkSessionId).toBe("forked-id");
    });
  });

  describe("evictIdle", () => {
    it("should terminate sessions idle longer than maxIdleMs", () => {
      const mockSession = createMockSDKSession({ sessionId: "evict-test" });
      mockResumeSession.mockReturnValue(mockSession);

      const managed = service.resume("evict-test", {});
      // Simulate old lastActivityAt
      managed.lastActivityAt = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago

      const count = service.evictIdle(30 * 60 * 1000); // 30 min threshold

      expect(count).toBe(1);
      expect(mockClose).toHaveBeenCalled();
      expect(service.getPoolSize()).toBe(0);
    });

    it("should not evict running sessions", () => {
      const mockSession = createMockSDKSession({ sessionId: "running-test" });
      mockResumeSession.mockReturnValue(mockSession);

      const managed = service.resume("running-test", {});
      managed.state = "running";
      managed.lastActivityAt = new Date(Date.now() - 60 * 60 * 1000);

      const count = service.evictIdle(30 * 60 * 1000);

      expect(count).toBe(0);
      expect(service.getPoolSize()).toBe(1);
    });

    it("should not evict recent idle sessions", () => {
      const mockSession = createMockSDKSession({ sessionId: "recent-test" });
      mockResumeSession.mockReturnValue(mockSession);

      service.resume("recent-test", {});
      // lastActivityAt is now, so it's recent

      const count = service.evictIdle(30 * 60 * 1000);

      expect(count).toBe(0);
      expect(service.getPoolSize()).toBe(1);
    });
  });

  describe("terminateAll", () => {
    it("should close all sessions and clear pool", () => {
      const sessions = ["s1", "s2", "s3"].map((id) => {
        const ms = createMockSDKSession({ sessionId: id });
        mockResumeSession.mockReturnValueOnce(ms);
        return service.resume(id, {});
      });

      expect(service.getPoolSize()).toBe(3);

      service.terminateAll();

      expect(service.getPoolSize()).toBe(0);
    });
  });
});

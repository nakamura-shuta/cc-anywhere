/**
 * Session V2 API routes unit tests
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock SDK functions before imports
vi.mock("@anthropic-ai/claude-agent-sdk", () => ({
  unstable_v2_createSession: vi.fn(),
  unstable_v2_resumeSession: vi.fn(),
  forkSession: vi.fn(),
  getSessionInfo: vi.fn(),
  getSessionMessages: vi.fn(),
  listSessions: vi.fn(),
  renameSession: vi.fn(),
  tagSession: vi.fn(),
}));

import {
  getSessionInfo,
  getSessionMessages,
  listSessions,
  renameSession,
  tagSession,
  forkSession,
} from "@anthropic-ai/claude-agent-sdk";
import { V2SessionRuntime } from "../../../../src/session/v2-session-runtime.js";

const mockGetSessionInfo = vi.mocked(getSessionInfo);
const mockGetSessionMessages = vi.mocked(getSessionMessages);
const mockListSessions = vi.mocked(listSessions);
const mockRenameSession = vi.mocked(renameSession);
const mockTagSession = vi.mocked(tagSession);
const mockForkSession = vi.mocked(forkSession);

describe("V2SessionRuntime SDK utils", () => {
  let service: V2SessionRuntime;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new V2SessionRuntime();
  });

  describe("getInfo", () => {
    it("should return session info", async () => {
      const mockInfo = {
        sessionId: "test-id",
        summary: "Test session",
        lastModified: Date.now(),
      };
      mockGetSessionInfo.mockResolvedValue(mockInfo as any);

      const result = await service.getInfo("test-id");

      expect(mockGetSessionInfo).toHaveBeenCalledWith("test-id");
      expect(result).toEqual(mockInfo);
    });

    it("should return undefined for non-existent session", async () => {
      mockGetSessionInfo.mockResolvedValue(undefined);

      const result = await service.getInfo("nonexistent");

      expect(result).toBeUndefined();
    });
  });

  describe("getMessages", () => {
    it("should return session messages", async () => {
      const mockMessages = [
        { type: "user", message: "hello" },
        { type: "assistant", message: { content: [] } },
      ];
      mockGetSessionMessages.mockResolvedValue(mockMessages as any);

      const result = await service.getMessages("test-id");

      expect(mockGetSessionMessages).toHaveBeenCalledWith("test-id");
      expect(result).toEqual(mockMessages);
    });
  });

  describe("list", () => {
    it("should return session list", async () => {
      const mockSessions = [
        { sessionId: "s1", summary: "Session 1", lastModified: 1000 },
        { sessionId: "s2", summary: "Session 2", lastModified: 2000 },
      ];
      mockListSessions.mockResolvedValue(mockSessions as any);

      const result = await service.listSessions();

      expect(mockListSessions).toHaveBeenCalled();
      expect(result).toHaveLength(2);
    });

    it("should pass dir option", async () => {
      mockListSessions.mockResolvedValue([]);

      await service.listSessions({ dir: "/some/path" });

      expect(mockListSessions).toHaveBeenCalledWith({ dir: "/some/path" });
    });
  });

  describe("fork", () => {
    it("should fork session and return new id", async () => {
      mockForkSession.mockResolvedValue({ sessionId: "forked-id" });

      const result = await service.fork("original-id", { title: "Fork title" });

      expect(mockForkSession).toHaveBeenCalledWith("original-id", { title: "Fork title" });
      expect(result).toEqual({ sdkSessionId: "forked-id" });
    });
  });

  describe("rename", () => {
    it("should rename session", async () => {
      mockRenameSession.mockResolvedValue(undefined);

      await service.rename("test-id", "New Title");

      expect(mockRenameSession).toHaveBeenCalledWith("test-id", "New Title");
    });
  });

  describe("tag", () => {
    it("should tag session", async () => {
      mockTagSession.mockResolvedValue(undefined);

      await service.tag("test-id", "my-tag");

      expect(mockTagSession).toHaveBeenCalledWith("test-id", "my-tag");
    });

    it("should remove tag with null", async () => {
      mockTagSession.mockResolvedValue(undefined);

      await service.tag("test-id", null);

      expect(mockTagSession).toHaveBeenCalledWith("test-id", null);
    });
  });
});

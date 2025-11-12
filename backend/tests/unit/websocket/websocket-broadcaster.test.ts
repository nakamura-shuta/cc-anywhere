import { describe, it, expect, beforeEach, vi } from "vitest";
import { WebSocketBroadcaster } from "../../../src/websocket/websocket-broadcaster.js";
import type { WebSocketServer } from "../../../src/websocket/websocket-server.js";

describe("WebSocketBroadcaster", () => {
  let broadcaster: WebSocketBroadcaster;
  let mockWsServer: Partial<WebSocketServer>;

  beforeEach(() => {
    mockWsServer = {
      broadcastToAll: vi.fn(),
    };
    broadcaster = new WebSocketBroadcaster(mockWsServer as WebSocketServer);
  });

  describe("broadcast", () => {
    it("should broadcast to all clients for global channel", () => {
      const payload = { message: "test" };
      broadcaster.broadcast("global", "test:message", payload);

      expect(mockWsServer.broadcastToAll).toHaveBeenCalledWith({
        type: "test:message",
        payload: expect.objectContaining({
          message: "test",
          timestamp: expect.any(String),
        }),
      });
    });

    it("should broadcast to all clients for * channel", () => {
      const payload = { data: "test" };
      broadcaster.broadcast("*", "test:event", payload);

      expect(mockWsServer.broadcastToAll).toHaveBeenCalledWith({
        type: "test:event",
        payload: expect.objectContaining({
          data: "test",
          timestamp: expect.any(String),
        }),
      });
    });

    it("should handle task channels", () => {
      const payload = { status: "running" };
      broadcaster.broadcast("task-123", "task:update", payload);

      expect(mockWsServer.broadcastToAll).toHaveBeenCalledWith({
        type: "task:update",
        payload: expect.objectContaining({
          status: "running",
          timestamp: expect.any(String),
        }),
      });
    });

    it("should handle group channels", () => {
      const payload = { progress: 50 };
      broadcaster.broadcast("group-456", "task_group:progress", payload);

      expect(mockWsServer.broadcastToAll).toHaveBeenCalledWith({
        type: "task_group:progress",
        payload: expect.objectContaining({
          progress: 50,
          timestamp: expect.any(String),
        }),
      });
    });

    it("should include custom timestamp when provided", () => {
      const customTimestamp = "2024-01-01T00:00:00.000Z";
      const payload = { test: true };
      broadcaster.broadcast("global", "test", payload, { timestamp: customTimestamp });

      expect(mockWsServer.broadcastToAll).toHaveBeenCalledWith({
        type: "test",
        payload: expect.objectContaining({
          test: true,
          timestamp: customTimestamp,
        }),
      });
    });

    it("should include metadata when provided", () => {
      const metadata = { version: "1.0", source: "test" };
      const payload = { data: "test" };
      broadcaster.broadcast("global", "test", payload, { metadata });

      expect(mockWsServer.broadcastToAll).toHaveBeenCalledWith({
        type: "test",
        payload: expect.objectContaining({
          data: "test",
          metadata,
          timestamp: expect.any(String),
        }),
      });
    });
  });

  describe("helper methods", () => {
    describe("task", () => {
      it("should broadcast task message with taskId", () => {
        const payload = { status: "completed" };
        broadcaster.task("task-123", "task:update", payload);

        expect(mockWsServer.broadcastToAll).toHaveBeenCalledWith({
          type: "task:update",
          payload: expect.objectContaining({
            taskId: "task-123",
            status: "completed",
            timestamp: expect.any(String),
          }),
        });
      });
    });

    describe("taskGroup", () => {
      it("should broadcast task group message with groupId", () => {
        const payload = { progress: 75 };
        broadcaster.taskGroup("group-456", "task_group:progress", payload);

        expect(mockWsServer.broadcastToAll).toHaveBeenCalledWith({
          type: "task_group:progress",
          payload: expect.objectContaining({
            groupId: "group-456",
            progress: 75,
            timestamp: expect.any(String),
          }),
        });
      });
    });

    describe("global", () => {
      it("should broadcast global message", () => {
        const payload = { event: "test" };
        broadcaster.global("system:event", payload);

        expect(mockWsServer.broadcastToAll).toHaveBeenCalledWith({
          type: "system:event",
          payload: expect.objectContaining({
            event: "test",
            timestamp: expect.any(String),
          }),
        });
      });
    });
  });
});

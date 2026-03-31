import { describe, it, expect, beforeEach } from "vitest";
import { MessageTracker } from "../../../src/claude/types/message-tracking.js";
import type { TrackedMessage } from "../../../src/claude/types/message-tracking.js";

/**
 * SDKMessageのモックを生成するヘルパー
 */
function createMockMessage(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    uuid: `uuid-${Math.random().toString(36).slice(2, 8)}`,
    type: "assistant",
    session_id: "session-1",
    message: { content: [{ type: "text", text: "Hello" }] },
    ...overrides,
  };
}

describe("MessageTracker", () => {
  let tracker: MessageTracker;

  beforeEach(() => {
    tracker = new MessageTracker();
  });

  describe("track", () => {
    it("should track a message with uuid", () => {
      const message = createMockMessage({ uuid: "test-uuid-1" });
      const result = tracker.track("task-1", message as any);

      expect(result).not.toBeNull();
      expect(result!.uuid).toBe("test-uuid-1");
      expect(result!.taskId).toBe("task-1");
      expect(result!.type).toBe("assistant");
    });

    it("should return null for messages without uuid", () => {
      const message = { type: "assistant" };
      const result = tracker.track("task-1", message as any);

      expect(result).toBeNull();
    });

    it("should reject duplicate uuids", () => {
      const message = createMockMessage({ uuid: "dup-uuid" });
      tracker.track("task-1", message as any);
      const result = tracker.track("task-1", message as any);

      expect(result).toBeNull();
    });

    it("should track session_id", () => {
      const message = createMockMessage({ session_id: "sess-abc" });
      const result = tracker.track("task-1", message as any);

      expect(result!.sessionId).toBe("sess-abc");
    });

    it("should default sessionId to empty string", () => {
      const message = createMockMessage({ session_id: undefined });
      const result = tracker.track("task-1", message as any);

      expect(result!.sessionId).toBe("");
    });

    it("should track parent_tool_use_id", () => {
      const message = createMockMessage({ parent_tool_use_id: "tool-123" });
      const result = tracker.track("task-1", message as any);

      expect(result!.parentToolUseId).toBe("tool-123");
    });
  });

  describe("message types", () => {
    const allTypes = [
      "system",
      "user",
      "assistant",
      "result",
      "stream_event",
      "tool_progress",
      "auth_status",
      "tool_use_summary",
      "rate_limit_event",
      "prompt_suggestion",
    ] as const;

    it.each(allTypes)("should accept message type: %s", (type) => {
      const message = createMockMessage({ type });
      const result = tracker.track("task-1", message as any);

      expect(result).not.toBeNull();
      expect(result!.type).toBe(type);
    });

    it("should track rate_limit_event messages (SDK 0.2.87+)", () => {
      const message = createMockMessage({
        type: "rate_limit_event",
        uuid: "rate-limit-uuid",
      });
      const result = tracker.track("task-1", message as any);

      expect(result).not.toBeNull();
      expect(result!.type).toBe("rate_limit_event");
    });

    it("should track prompt_suggestion messages (SDK 0.2.87+)", () => {
      const message = createMockMessage({
        type: "prompt_suggestion",
        uuid: "prompt-suggestion-uuid",
      });
      const result = tracker.track("task-1", message as any);

      expect(result).not.toBeNull();
      expect(result!.type).toBe("prompt_suggestion");
    });
  });

  describe("extractContent", () => {
    it("should extract assistant message content", () => {
      const message = createMockMessage({
        type: "assistant",
        message: { content: [{ type: "text", text: "test response" }] },
      });
      const result = tracker.track("task-1", message as any);

      expect(result!.content).toEqual([
        { type: "text", text: "test response" },
      ]);
    });

    it("should extract user message content", () => {
      const message = createMockMessage({
        type: "user",
        message: "user input",
      });
      const result = tracker.track("task-1", message as any);

      expect(result!.content).toBe("user input");
    });

    it("should extract result content with subtype and error", () => {
      const message = createMockMessage({
        type: "result",
        subtype: "success",
        result: "task completed",
        error: null,
      });
      const result = tracker.track("task-1", message as any);

      expect(result!.content).toEqual({
        subtype: "success",
        result: "task completed",
        error: null,
      });
    });

    it("should extract system content with model and tools", () => {
      const message = createMockMessage({
        type: "system",
        subtype: "init",
        model: "claude-opus-4-20250514",
        tools: ["Read", "Write"],
      });
      const result = tracker.track("task-1", message as any);

      expect(result!.content).toEqual({
        subtype: "init",
        model: "claude-opus-4-20250514",
        tools: ["Read", "Write"],
      });
    });

    it("should return raw message for unknown types", () => {
      const message = createMockMessage({
        type: "stream_event",
        data: "stream data",
      });
      const result = tracker.track("task-1", message as any);

      expect(result!.content).toEqual(message);
    });
  });

  describe("extractMetadata", () => {
    it("should extract duration from result messages", () => {
      const message = createMockMessage({
        type: "result",
        duration_ms: 1500,
      });
      const result = tracker.track("task-1", message as any);

      expect(result!.metadata).toEqual({ duration: 1500 });
    });

    it("should extract token count from result messages", () => {
      const message = createMockMessage({
        type: "result",
        usage: { total_tokens: 500 },
      });
      const result = tracker.track("task-1", message as any);

      expect(result!.metadata).toEqual({ tokenCount: 500 });
    });

    it("should return undefined metadata for non-result messages", () => {
      const message = createMockMessage({ type: "assistant" });
      const result = tracker.track("task-1", message as any);

      expect(result!.metadata).toBeUndefined();
    });
  });

  describe("getByUuid", () => {
    it("should retrieve tracked message by uuid", () => {
      const message = createMockMessage({ uuid: "lookup-uuid" });
      tracker.track("task-1", message as any);

      const found = tracker.getByUuid("lookup-uuid");
      expect(found).toBeDefined();
      expect(found!.uuid).toBe("lookup-uuid");
    });

    it("should return undefined for unknown uuid", () => {
      expect(tracker.getByUuid("nonexistent")).toBeUndefined();
    });
  });

  describe("getByTaskId", () => {
    it("should return all messages for a task sorted by timestamp", () => {
      const msg1 = createMockMessage({ uuid: "uuid-1" });
      const msg2 = createMockMessage({ uuid: "uuid-2" });
      const msg3 = createMockMessage({ uuid: "uuid-3" });

      tracker.track("task-1", msg1 as any);
      tracker.track("task-1", msg2 as any);
      tracker.track("task-1", msg3 as any);

      const messages = tracker.getByTaskId("task-1");
      expect(messages).toHaveLength(3);
    });

    it("should return empty array for unknown task", () => {
      expect(tracker.getByTaskId("nonexistent")).toEqual([]);
    });

    it("should not mix messages from different tasks", () => {
      tracker.track("task-1", createMockMessage({ uuid: "t1-1" }) as any);
      tracker.track("task-2", createMockMessage({ uuid: "t2-1" }) as any);
      tracker.track("task-1", createMockMessage({ uuid: "t1-2" }) as any);

      expect(tracker.getByTaskId("task-1")).toHaveLength(2);
      expect(tracker.getByTaskId("task-2")).toHaveLength(1);
    });
  });

  describe("isDuplicate", () => {
    it("should return true for tracked uuids", () => {
      tracker.track(
        "task-1",
        createMockMessage({ uuid: "dup-check" }) as any,
      );
      expect(tracker.isDuplicate("dup-check")).toBe(true);
    });

    it("should return false for unknown uuids", () => {
      expect(tracker.isDuplicate("unknown")).toBe(false);
    });
  });

  describe("getTaskStats", () => {
    it("should return correct message counts by type", () => {
      tracker.track(
        "task-1",
        createMockMessage({ uuid: "s1", type: "assistant" }) as any,
      );
      tracker.track(
        "task-1",
        createMockMessage({ uuid: "s2", type: "assistant" }) as any,
      );
      tracker.track(
        "task-1",
        createMockMessage({ uuid: "s3", type: "user" }) as any,
      );
      tracker.track(
        "task-1",
        createMockMessage({ uuid: "s4", type: "rate_limit_event" }) as any,
      );

      const stats = tracker.getTaskStats("task-1");
      expect(stats.totalMessages).toBe(4);
      expect(stats.messageTypes.assistant).toBe(2);
      expect(stats.messageTypes.user).toBe(1);
      expect(stats.messageTypes.rate_limit_event).toBe(1);
    });

    it("should aggregate duration and tokens from result messages", () => {
      tracker.track(
        "task-1",
        createMockMessage({
          uuid: "r1",
          type: "result",
          duration_ms: 1000,
          usage: { total_tokens: 200 },
        }) as any,
      );
      tracker.track(
        "task-1",
        createMockMessage({
          uuid: "r2",
          type: "result",
          duration_ms: 500,
          usage: { total_tokens: 300 },
        }) as any,
      );

      const stats = tracker.getTaskStats("task-1");
      expect(stats.totalDuration).toBe(1500);
      expect(stats.totalTokens).toBe(500);
    });

    it("should return zero stats for unknown task", () => {
      const stats = tracker.getTaskStats("nonexistent");
      expect(stats.totalMessages).toBe(0);
      expect(stats.messageTypes).toEqual({});
    });
  });

  describe("clearTask", () => {
    it("should remove all messages for a task", () => {
      tracker.track(
        "task-1",
        createMockMessage({ uuid: "c1" }) as any,
      );
      tracker.track(
        "task-1",
        createMockMessage({ uuid: "c2" }) as any,
      );

      tracker.clearTask("task-1");

      expect(tracker.getByTaskId("task-1")).toEqual([]);
      expect(tracker.getByUuid("c1")).toBeUndefined();
      expect(tracker.getByUuid("c2")).toBeUndefined();
      expect(tracker.isDuplicate("c1")).toBe(false);
    });

    it("should not affect other tasks", () => {
      tracker.track(
        "task-1",
        createMockMessage({ uuid: "k1" }) as any,
      );
      tracker.track(
        "task-2",
        createMockMessage({ uuid: "k2" }) as any,
      );

      tracker.clearTask("task-1");

      expect(tracker.getByTaskId("task-1")).toEqual([]);
      expect(tracker.getByTaskId("task-2")).toHaveLength(1);
    });

    it("should handle clearing nonexistent task gracefully", () => {
      expect(() => tracker.clearTask("nonexistent")).not.toThrow();
    });
  });
});

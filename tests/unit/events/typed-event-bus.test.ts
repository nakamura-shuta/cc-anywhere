import { describe, it, expect, beforeEach, vi } from "vitest";
import { EventBus } from "../../../src/events/event-bus";
import { TypedEventBus } from "../../../src/events/typed-event-bus";
import type { TaskCreatedEvent, TaskCompletedEvent } from "../../../src/events/domain-events";
import { TaskStatus } from "../../../src/claude/types";

describe("TypedEventBus", () => {
  let eventBus: EventBus;
  let typedEventBus: TypedEventBus;

  beforeEach(() => {
    eventBus = new EventBus();
    typedEventBus = new TypedEventBus(eventBus);
  });

  describe("type-safe event handling", () => {
    it("should emit and receive task.created events", async () => {
      const handler = vi.fn();
      const payload: TaskCreatedEvent = {
        taskId: "task-123",
        request: {
          instruction: "Test task",
        },
        priority: 1,
        createdAt: new Date(),
      };

      typedEventBus.on("task.created", handler);
      await typedEventBus.emit("task.created", payload);

      expect(handler).toHaveBeenCalledWith(
        payload,
        expect.objectContaining({
          type: "task.created",
          payload,
        }),
      );
    });

    it("should handle multiple event types", async () => {
      const createdHandler = vi.fn();
      const completedHandler = vi.fn();

      const createdPayload: TaskCreatedEvent = {
        taskId: "task-123",
        request: { instruction: "Test" },
        priority: 1,
        createdAt: new Date(),
      };

      const completedPayload: TaskCompletedEvent = {
        taskId: "task-123",
        result: {
          taskId: "task-123",
          status: TaskStatus.COMPLETED,
          instruction: "Test",
          createdAt: new Date(),
        },
        duration: 1000,
        completedAt: new Date(),
      };

      typedEventBus.on("task.created", createdHandler);
      typedEventBus.on("task.completed", completedHandler);

      await typedEventBus.emit("task.created", createdPayload);
      await typedEventBus.emit("task.completed", completedPayload);

      expect(createdHandler).toHaveBeenCalledWith(createdPayload, expect.any(Object));
      expect(completedHandler).toHaveBeenCalledWith(completedPayload, expect.any(Object));
    });

    it("should support once subscription", async () => {
      const handler = vi.fn();
      const payload: TaskCreatedEvent = {
        taskId: "task-123",
        request: { instruction: "Test" },
        priority: 1,
        createdAt: new Date(),
      };

      typedEventBus.once("task.created", handler);

      await typedEventBus.emit("task.created", payload);
      await typedEventBus.emit("task.created", payload);

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it("should support metadata", async () => {
      const handler = vi.fn();
      const payload: TaskCreatedEvent = {
        taskId: "task-123",
        request: { instruction: "Test" },
        priority: 1,
        createdAt: new Date(),
      };
      const metadata = { source: "api", userId: "user-123" };

      typedEventBus.on("task.created", (p, event) => {
        handler(event.metadata);
      });

      await typedEventBus.emit("task.created", payload, metadata);

      expect(handler).toHaveBeenCalledWith(metadata);
    });
  });

  describe("listener management", () => {
    it("should count listeners correctly", () => {
      typedEventBus.on("task.created", vi.fn());
      typedEventBus.on("task.created", vi.fn());
      typedEventBus.once("task.created", vi.fn());

      expect(typedEventBus.listenerCount("task.created")).toBe(3);
    });

    it("should remove all listeners for event type", () => {
      typedEventBus.on("task.created", vi.fn());
      typedEventBus.on("task.created", vi.fn());
      typedEventBus.on("task.completed", vi.fn());

      typedEventBus.removeAllListeners("task.created");

      expect(typedEventBus.listenerCount("task.created")).toBe(0);
      expect(typedEventBus.listenerCount("task.completed")).toBe(1);
    });

    it("should remove all listeners", () => {
      typedEventBus.on("task.created", vi.fn());
      typedEventBus.on("task.completed", vi.fn());

      typedEventBus.removeAllListeners();

      expect(typedEventBus.listenerCount("task.created")).toBe(0);
      expect(typedEventBus.listenerCount("task.completed")).toBe(0);
    });
  });
});

import { describe, it, expect, beforeEach, vi } from "vitest";
import { EventBus } from "../../../src/events/event-bus";
import { logger } from "../../../src/utils/logger";

describe("EventBus", () => {
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();
  });

  describe("emit", () => {
    it("should emit events to registered handlers", async () => {
      const handler = vi.fn();
      const event = EventBus.createEvent("test.event", { data: "test" });

      eventBus.on("test.event", handler);
      await eventBus.emit(event);

      expect(handler).toHaveBeenCalledWith(event);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it("should emit to multiple handlers", async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const event = EventBus.createEvent("test.event", { data: "test" });

      eventBus.on("test.event", handler1);
      eventBus.on("test.event", handler2);
      await eventBus.emit(event);

      expect(handler1).toHaveBeenCalledWith(event);
      expect(handler2).toHaveBeenCalledWith(event);
    });

    it("should not emit to handlers of different event types", async () => {
      const handler = vi.fn();
      const event = EventBus.createEvent("test.event", { data: "test" });

      eventBus.on("other.event", handler);
      await eventBus.emit(event);

      expect(handler).not.toHaveBeenCalled();
    });

    it("should handle async handlers", async () => {
      let resolved = false;
      const asyncHandler = vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        resolved = true;
      });
      const event = EventBus.createEvent("test.event", { data: "test" });

      eventBus.on("test.event", asyncHandler);
      await eventBus.emit(event);

      expect(asyncHandler).toHaveBeenCalled();
      expect(resolved).toBe(true);
    });

    it("should capture handler errors by default", async () => {
      const errorHandler = vi.fn();
      const bus = new EventBus({ errorHandler });
      const error = new Error("Handler error");
      const handler = vi.fn(() => {
        throw error;
      });
      const event = EventBus.createEvent("test.event", { data: "test" });

      bus.on("test.event", handler);
      await bus.emit(event);

      expect(errorHandler).toHaveBeenCalledWith(error, event);
    });
  });

  describe("once", () => {
    it("should only call handler once", async () => {
      const handler = vi.fn();
      const event1 = EventBus.createEvent("test.event", { data: "test1" });
      const event2 = EventBus.createEvent("test.event", { data: "test2" });

      eventBus.once("test.event", handler);
      await eventBus.emit(event1);
      await eventBus.emit(event2);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(event1);
    });
  });

  describe("off", () => {
    it("should remove specific handler", async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const event = EventBus.createEvent("test.event", { data: "test" });

      eventBus.on("test.event", handler1);
      eventBus.on("test.event", handler2);
      eventBus.off("test.event", handler1);
      await eventBus.emit(event);

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalledWith(event);
    });
  });

  describe("removeAllListeners", () => {
    it("should remove all listeners for specific event type", async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const handler3 = vi.fn();
      const event1 = EventBus.createEvent("test.event1", { data: "test1" });
      const event2 = EventBus.createEvent("test.event2", { data: "test2" });

      eventBus.on("test.event1", handler1);
      eventBus.on("test.event1", handler2);
      eventBus.on("test.event2", handler3);

      eventBus.removeAllListeners("test.event1");

      await eventBus.emit(event1);
      await eventBus.emit(event2);

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).not.toHaveBeenCalled();
      expect(handler3).toHaveBeenCalledWith(event2);
    });

    it("should remove all listeners when no type specified", async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const event1 = EventBus.createEvent("test.event1", { data: "test1" });
      const event2 = EventBus.createEvent("test.event2", { data: "test2" });

      eventBus.on("test.event1", handler1);
      eventBus.on("test.event2", handler2);

      eventBus.removeAllListeners();

      await eventBus.emit(event1);
      await eventBus.emit(event2);

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).not.toHaveBeenCalled();
    });
  });

  describe("listenerCount", () => {
    it("should return correct listener count", () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      expect(eventBus.listenerCount("test.event")).toBe(0);

      eventBus.on("test.event", handler1);
      expect(eventBus.listenerCount("test.event")).toBe(1);

      eventBus.on("test.event", handler2);
      expect(eventBus.listenerCount("test.event")).toBe(2);

      eventBus.once("test.event", handler1);
      expect(eventBus.listenerCount("test.event")).toBe(3);

      eventBus.off("test.event", handler1);
      expect(eventBus.listenerCount("test.event")).toBe(1); // handler1 was removed from regular handlers, handler2 remains
    });
  });

  describe("subscription", () => {
    it("should return working subscription object", async () => {
      const handler = vi.fn();
      const event = EventBus.createEvent("test.event", { data: "test" });

      const subscription = eventBus.on("test.event", handler);
      await eventBus.emit(event);
      expect(handler).toHaveBeenCalledTimes(1);

      subscription.unsubscribe();
      await eventBus.emit(event);
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe("maxListeners", () => {
    it("should warn when max listeners exceeded", () => {
      const warnSpy = vi.spyOn(logger, "warn").mockImplementation(() => {});
      const bus = new EventBus({ maxListeners: 2 });

      bus.on("test.event", vi.fn());
      bus.on("test.event", vi.fn());
      bus.on("test.event", vi.fn()); // This should trigger warning

      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TimeoutManager } from "../../src/services/timeout-manager";
import { TimeoutPhase, TimeoutBehavior } from "../../src/types/timeout";

describe("TimeoutManager", () => {
  let onWarning: ReturnType<typeof vi.fn>;
  let onTimeout: ReturnType<typeof vi.fn>;
  let manager: TimeoutManager;

  beforeEach(() => {
    vi.useFakeTimers();
    onWarning = vi.fn();
    onTimeout = vi.fn();
  });

  afterEach(() => {
    manager?.dispose();
    vi.useRealTimers();
  });

  describe("basic functionality", () => {
    it("should create manager with default config", () => {
      manager = new TimeoutManager({}, onWarning, onTimeout);
      const state = manager.getState();
      expect(state.phase).toBe(TimeoutPhase.SETUP);
    });
  });

  describe("timeout handling", () => {
    it("should trigger timeout when total time exceeded", () => {
      manager = new TimeoutManager(
        {
          total: 5000,
          behavior: TimeoutBehavior.HARD,
        },
        onWarning,
        onTimeout,
      );

      vi.advanceTimersByTime(5001);

      expect(onTimeout).toHaveBeenCalled();
    });

    it("should emit warning at threshold", () => {
      manager = new TimeoutManager(
        {
          total: 10000,
          warningThreshold: 0.8,
        },
        onWarning,
        onTimeout,
      );

      vi.advanceTimersByTime(8001);

      expect(onWarning).toHaveBeenCalled();
    });
  });

  describe("cleanup", () => {
    it("should dispose resources", () => {
      manager = new TimeoutManager(
        {
          total: 5000,
        },
        onWarning,
        onTimeout,
      );

      manager.dispose();

      // Advance time past timeout
      vi.advanceTimersByTime(10000);

      // Should not trigger any callbacks after disposal
      expect(onTimeout).not.toHaveBeenCalled();
      expect(onWarning).not.toHaveBeenCalled();
    });
  });
});

import { describe, it, expect } from "vitest";
import { FormattingHelpers } from "../../../src/utils/formatting-helpers";

describe("FormattingHelpers", () => {
  describe("formatJapaneseTimestamp", () => {
    it("should format Date object correctly", () => {
      const date = new Date("2025-11-06T14:30:45.123Z");
      const result = FormattingHelpers.formatJapaneseTimestamp(date);
      expect(result).toMatch(/2025/);
      expect(result).toMatch(/11/);
      expect(result).toMatch(/6/); // Japanese locale uses single digit for day
    });

    it("should format number timestamp correctly", () => {
      const timestamp = 1699265445123; // 2023-11-06 14:30:45
      const result = FormattingHelpers.formatJapaneseTimestamp(timestamp);
      expect(result).toMatch(/2023/);
      expect(result).toMatch(/11/);
      expect(result).toMatch(/6/); // Japanese locale uses single digit for day
    });

    it("should format string timestamp correctly", () => {
      const timestamp = "2025-11-06T14:30:45.123Z";
      const result = FormattingHelpers.formatJapaneseTimestamp(timestamp);
      expect(result).toMatch(/2025/);
      expect(result).toMatch(/11/);
      expect(result).toMatch(/6/); // Japanese locale uses single digit for day
    });
  });

  describe("generateTaskId", () => {
    it("should generate task ID with default prefix", () => {
      const taskId = FormattingHelpers.generateTaskId();
      expect(taskId).toMatch(/^task-\d+-[a-z0-9]+$/);
    });

    it("should generate task ID with custom prefix", () => {
      const taskId = FormattingHelpers.generateTaskId("codex-task");
      expect(taskId).toMatch(/^codex-task-\d+-[a-z0-9]+$/);
    });

    it("should generate unique task IDs", () => {
      const id1 = FormattingHelpers.generateTaskId();
      const id2 = FormattingHelpers.generateTaskId();
      expect(id1).not.toBe(id2);
    });

    it("should generate task ID with another custom prefix", () => {
      const taskId = FormattingHelpers.generateTaskId("claude-task");
      expect(taskId).toMatch(/^claude-task-\d+-[a-z0-9]+$/);
    });
  });

  describe("formatDuration", () => {
    it("should format milliseconds (< 1 second)", () => {
      expect(FormattingHelpers.formatDuration(500)).toBe("500ms");
      expect(FormattingHelpers.formatDuration(0)).toBe("0ms");
      expect(FormattingHelpers.formatDuration(999)).toBe("999ms");
    });

    it("should format seconds (< 1 minute)", () => {
      expect(FormattingHelpers.formatDuration(1000)).toBe("1.0s");
      expect(FormattingHelpers.formatDuration(5000)).toBe("5.0s");
      expect(FormattingHelpers.formatDuration(59999)).toBe("60.0s");
    });

    it("should format minutes and seconds (>= 1 minute)", () => {
      expect(FormattingHelpers.formatDuration(60000)).toBe("1m 0s");
      expect(FormattingHelpers.formatDuration(125000)).toBe("2m 5s");
      expect(FormattingHelpers.formatDuration(3600000)).toBe("60m 0s");
    });

    it("should handle edge case of exactly 1 second", () => {
      expect(FormattingHelpers.formatDuration(1000)).toBe("1.0s");
    });

    it("should handle large durations", () => {
      const largeMs = 7200000; // 2 hours = 120 minutes
      const result = FormattingHelpers.formatDuration(largeMs);
      expect(result).toBe("120m 0s");
    });
  });
});

import { describe, it, expect } from "vitest";
import { ProgressFormatter, type ProgressMessage } from "../../../src/utils/progress-formatter.js";

describe("ProgressFormatter", () => {
  describe("formatProgressMessage", () => {
    it("should format log messages", () => {
      const progress: ProgressMessage = {
        type: "log",
        message: "Test log message",
      };
      const result = ProgressFormatter.formatProgressMessage(progress);
      expect(result).toEqual({
        message: "Test log message",
        level: "info",
      });
    });

    it("should format tool:start messages for bash", () => {
      const progress: ProgressMessage = {
        type: "tool:start",
        data: {
          tool: "bash",
          input: { command: "npm test" },
        },
      };
      const result = ProgressFormatter.formatProgressMessage(progress);
      expect(result).toEqual({
        message: "🔧 Executing command: npm test",
        level: "info",
      });
    });

    it("should format tool:start messages for read", () => {
      const progress: ProgressMessage = {
        type: "tool:start",
        data: {
          tool: "read",
          input: { file_path: "/path/to/file.txt" },
        },
      };
      const result = ProgressFormatter.formatProgressMessage(progress);
      expect(result).toEqual({
        message: "📖 Reading file: /path/to/file.txt",
        level: "info",
      });
    });

    it("should format tool:end messages", () => {
      const progress: ProgressMessage = {
        type: "tool:end",
        data: {
          tool: "bash",
          output: "Line 1\nLine 2\nLine 3\nLine 4\nLine 5",
        },
      };
      const result = ProgressFormatter.formatProgressMessage(progress);
      expect(result?.message).toContain("✓ Command output:");
      expect(result?.message).toContain("Line 1");
      expect(result?.message).toContain("...");
    });

    it("should format claude:response messages", () => {
      const progress: ProgressMessage = {
        type: "claude:response",
        message: "This is Claude's response",
      };
      const result = ProgressFormatter.formatProgressMessage(progress);
      expect(result).toEqual({
        message: "💬 Claude: This is Claude's response",
        level: "info",
      });
    });

    it("should format todo_update messages", () => {
      const progress: ProgressMessage = {
        type: "todo_update",
        message: "Updated TODO list",
      };
      const result = ProgressFormatter.formatProgressMessage(progress);
      expect(result).toEqual({
        message: "📝 TODO: Updated TODO list",
        level: "info",
      });
    });

    it("should format progress messages", () => {
      const progress: ProgressMessage = {
        type: "progress",
        message: "Processing...",
      };
      const result = ProgressFormatter.formatProgressMessage(progress);
      expect(result).toEqual({
        message: "⏳ Processing...",
        level: "info",
      });
    });

    it("should format statistics messages", () => {
      const progress: ProgressMessage = {
        type: "statistics",
        message: "Total: 100",
      };
      const result = ProgressFormatter.formatProgressMessage(progress);
      expect(result).toEqual({
        message: "📊 Total: 100",
        level: "info",
      });
    });

    it("should return null for empty messages", () => {
      const progress: ProgressMessage = {
        type: "unknown",
      };
      const result = ProgressFormatter.formatProgressMessage(progress);
      expect(result).toBeNull();
    });
  });

  describe("formatToolStartMessage", () => {
    it("should format bash commands", () => {
      const progress: ProgressMessage = {
        type: "tool:start",
        tool: "bash",
        input: "ls -la",
      };
      const result = ProgressFormatter.formatToolStartMessage(progress);
      expect(result).toBe("🔧 Executing command: ls -la");
    });

    it("should format write operations", () => {
      const progress: ProgressMessage = {
        type: "tool:start",
        tool: "write",
        input: { file_path: "test.txt" },
      };
      const result = ProgressFormatter.formatToolStartMessage(progress);
      expect(result).toBe("✏️ Writing file: test.txt");
    });

    it("should format edit operations", () => {
      const progress: ProgressMessage = {
        type: "tool:start",
        tool: "edit",
        input: { file_path: "test.txt" },
      };
      const result = ProgressFormatter.formatToolStartMessage(progress);
      expect(result).toBe("✏️ Editing file: test.txt");
    });

    it("should format search operations", () => {
      const progress: ProgressMessage = {
        type: "tool:start",
        tool: "search",
        input: { pattern: "TODO" },
      };
      const result = ProgressFormatter.formatToolStartMessage(progress);
      expect(result).toBe("🔍 Searching for: TODO");
    });

    it("should format grep operations", () => {
      const progress: ProgressMessage = {
        type: "tool:start",
        tool: "grep",
        input: { query: "error" },
      };
      const result = ProgressFormatter.formatToolStartMessage(progress);
      expect(result).toBe("🔍 Searching for: error");
    });

    it("should handle unknown tools", () => {
      const progress: ProgressMessage = {
        type: "tool:start",
        tool: "unknown_tool",
      };
      const result = ProgressFormatter.formatToolStartMessage(progress);
      expect(result).toBe("🔧 Using tool: unknown_tool");
    });
  });

  describe("formatToolEndMessage", () => {
    it("should format bash output with preview", () => {
      const progress: ProgressMessage = {
        type: "tool:end",
        tool: "bash",
        output: "Line 1\nLine 2\nLine 3\nLine 4\nLine 5",
      };
      const result = ProgressFormatter.formatToolEndMessage(progress);
      expect(result).toBe("✓ Command output:\nLine 1\nLine 2\nLine 3\n...");
    });

    it("should format bash output without truncation", () => {
      const progress: ProgressMessage = {
        type: "tool:end",
        tool: "bash",
        output: "Line 1\nLine 2",
      };
      const result = ProgressFormatter.formatToolEndMessage(progress);
      expect(result).toBe("✓ Command output:\nLine 1\nLine 2");
    });

    it("should format non-bash tool completion", () => {
      const progress: ProgressMessage = {
        type: "tool:end",
        tool: "read",
      };
      const result = ProgressFormatter.formatToolEndMessage(progress);
      expect(result).toBe("✓ Tool completed: read");
    });
  });

  describe("formatLegacyToolUsage", () => {
    it("should format bash tool usage", () => {
      const progress: ProgressMessage = {
        type: "tool_usage",
        data: {
          tool: "bash",
          status: "success",
          command: "npm test",
        },
      };
      const result = ProgressFormatter.formatLegacyToolUsage(progress);
      expect(result).toBe("[Bash] ✓ npm test");
    });

    it("should format read tool usage", () => {
      const progress: ProgressMessage = {
        type: "tool_usage",
        data: {
          tool: "read",
          status: "failure",
          filePath: "test.txt",
        },
      };
      const result = ProgressFormatter.formatLegacyToolUsage(progress);
      expect(result).toBe("[Read] ✗ test.txt");
    });

    it("should format write tool usage", () => {
      const progress: ProgressMessage = {
        type: "tool_usage",
        data: {
          tool: "write",
          status: "start",
          filePath: "output.txt",
        },
      };
      const result = ProgressFormatter.formatLegacyToolUsage(progress);
      expect(result).toBe("[write] ⚡ output.txt");
    });

    it("should handle unknown tool with pattern", () => {
      const progress: ProgressMessage = {
        type: "tool_usage",
        data: {
          tool: "search",
          status: "success",
          pattern: "TODO",
        },
      };
      const result = ProgressFormatter.formatLegacyToolUsage(progress);
      expect(result).toBe("[search] ✓ 成功: TODO");
    });
  });

  describe("helper methods", () => {
    it("should format error messages", () => {
      const result = ProgressFormatter.formatError(new Error("Test error"));
      expect(result).toBe("❌ Error: Test error");
    });

    it("should format success messages", () => {
      const result = ProgressFormatter.formatSuccess("Operation completed");
      expect(result).toBe("✅ Operation completed");
    });

    it("should format warning messages", () => {
      const result = ProgressFormatter.formatWarning("Be careful");
      expect(result).toBe("⚠️ Be careful");
    });

    it("should format info messages", () => {
      const result = ProgressFormatter.formatInfo("For your information");
      expect(result).toBe("ℹ️ For your information");
    });

    it("should format debug messages", () => {
      const result = ProgressFormatter.formatDebug("Debug info");
      expect(result).toBe("🔍 Debug: Debug info");
    });
  });
});

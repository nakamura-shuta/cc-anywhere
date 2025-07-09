import { describe, it, expect, vi, beforeEach } from "vitest";
import { TaskExecutorImpl } from "../../../src/claude/executor.js";
import { logger } from "../../../src/utils/logger.js";
import type { ClaudeCodeSDKOptions } from "../../../src/claude/types.js";

// Mock dependencies
vi.mock("../../../src/config", () => ({
  config: {
    claude: {
      apiKey: "test-key",
    },
    claudeCodeSDK: {
      defaultMaxTurns: 3,
    },
  },
  getConfig: vi.fn().mockReturnValue({
    claudeCodeSDK: {
      defaultMaxTurns: 3,
    },
  }),
}));

vi.mock("../../../src/utils/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("../../../src/claude/client", () => ({
  ClaudeClient: vi.fn().mockImplementation(() => ({})),
}));

vi.mock("../../../src/claude/claude-code-client", () => ({
  ClaudeCodeClient: vi.fn().mockImplementation(() => ({})),
}));

describe("SDK Options Validation", () => {
  let executor: TaskExecutorImpl;

  beforeEach(() => {
    vi.clearAllMocks();
    executor = new TaskExecutorImpl();
  });

  describe("validateSDKOptions", () => {
    it("should accept valid maxTurns", () => {
      const options: ClaudeCodeSDKOptions = { maxTurns: 10 };
      // This should not throw
      expect(() => executor["validateSDKOptions"](options)).not.toThrow();
    });

    it("should reject maxTurns below minimum", () => {
      const options: ClaudeCodeSDKOptions = { maxTurns: 0 };
      expect(() => executor["validateSDKOptions"](options)).toThrow(
        "maxTurns must be between 1 and 50",
      );
    });

    it("should reject maxTurns above maximum", () => {
      const options: ClaudeCodeSDKOptions = { maxTurns: 51 };
      expect(() => executor["validateSDKOptions"](options)).toThrow(
        "maxTurns must be between 1 and 50",
      );
    });

    it("should accept valid systemPrompt", () => {
      const options: ClaudeCodeSDKOptions = { systemPrompt: "You are a helpful assistant" };
      expect(() => executor["validateSDKOptions"](options)).not.toThrow();
    });

    it("should reject systemPrompt exceeding max length", () => {
      const options: ClaudeCodeSDKOptions = { systemPrompt: "A".repeat(10001) };
      expect(() => executor["validateSDKOptions"](options)).toThrow(
        "systemPrompt must be 10000 characters or less",
      );
    });

    it("should warn when both allowedTools and disallowedTools are specified", () => {
      const mockLogger = vi.mocked(logger);
      const options: ClaudeCodeSDKOptions = {
        allowedTools: ["Read"],
        disallowedTools: ["Write"],
      };

      executor["validateSDKOptions"](options);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Both allowedTools and disallowedTools specified",
      );
    });
  });

  describe("mergeSDKOptions", () => {
    it("should apply default values", () => {
      const result = executor["mergeSDKOptions"](undefined, undefined);

      expect(result.maxTurns).toBe(3); // From config
      expect(result.allowedTools).toEqual([]);
      expect(result.disallowedTools).toEqual([]);
      expect(result.systemPrompt).toBe("");
      expect(result.permissionMode).toBe("ask");
      expect(result.executable).toBe("node");
      expect(result.outputFormat).toBe("text");
      expect(result.verbose).toBe(false);
    });

    it("should override defaults with provided values", () => {
      const sdkOptions: ClaudeCodeSDKOptions = {
        maxTurns: 5,
        allowedTools: ["Read", "Write"],
        systemPrompt: "Custom prompt",
        permissionMode: "allow",
        outputFormat: "json",
        verbose: true,
      };

      const result = executor["mergeSDKOptions"](sdkOptions, undefined);

      expect(result.maxTurns).toBe(5);
      expect(result.allowedTools).toEqual(["Read", "Write"]);
      expect(result.systemPrompt).toBe("Custom prompt");
      expect(result.permissionMode).toBe("allow");
      expect(result.outputFormat).toBe("json");
      expect(result.verbose).toBe(true);
    });

    it("should handle legacy allowedTools option", () => {
      const legacyOptions = { allowedTools: ["Read"] };
      const result = executor["mergeSDKOptions"](undefined, legacyOptions);

      expect(result.allowedTools).toEqual(["Read"]);
    });

    it("should prefer SDK options over legacy options", () => {
      const sdkOptions: ClaudeCodeSDKOptions = {
        allowedTools: ["Read", "Write"],
      };
      const legacyOptions = { allowedTools: ["Bash"] };

      const result = executor["mergeSDKOptions"](sdkOptions, legacyOptions);

      expect(result.allowedTools).toEqual(["Read", "Write"]);
    });
  });

  describe("processClaudeCodeResult", () => {
    it("should handle text output format", () => {
      const mockResult = {
        output: "Task completed successfully",
        success: true,
      };

      const processed = executor["processClaudeCodeResult"](mockResult, "text");

      expect(processed.output).toBe("Task completed successfully");
      expect(processed.success).toBe(true);
    });

    it("should handle json output format", () => {
      const mockResult = {
        output: '{"message": "Task completed", "files": ["file1.ts", "file2.ts"]}',
        success: true,
      };

      const processed = executor["processClaudeCodeResult"](mockResult, "json");

      expect(processed.output).toEqual({
        message: "Task completed",
        files: ["file1.ts", "file2.ts"],
      });
      expect(processed.success).toBe(true);
    });

    it("should handle invalid json gracefully", () => {
      const mockResult = {
        output: "Not valid JSON",
        success: true,
      };

      const processed = executor["processClaudeCodeResult"](mockResult, "json");

      expect(processed.output).toBe("Not valid JSON");
      expect(processed.success).toBe(true);
    });
  });
});

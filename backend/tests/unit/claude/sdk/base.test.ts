/**
 * Unit tests for ClaudeSDKBase
 *
 * Tests the 3 helper functions:
 * 1. extractSessionId: camelCase/snake_case support
 * 2. createQueryOptions: basic option generation
 * 3. withApiKey: API key switching (tested implicitly)
 */

import { describe, test, expect } from "vitest";
import { ClaudeSDKBase } from "../../../../src/claude/sdk/base.js";

/**
 * Concrete implementation for testing abstract class
 */
class TestSDKBase extends ClaudeSDKBase {
  // Expose protected methods for testing
  public testExtractSessionId(event: any): string | undefined {
    return this.extractSessionId(event);
  }

  public testCreateQueryOptions(
    prompt: string,
    opts: {
      resume?: boolean;
      sdkSessionId?: string;
      systemPrompt?: string;
      cwd?: string;
    },
  ) {
    return this.createQueryOptions(prompt, opts);
  }

  public testWithApiKey<T>(fn: () => T): T {
    return this.withApiKey(fn);
  }
}

describe("ClaudeSDKBase", () => {
  const base = new TestSDKBase();

  describe("extractSessionId", () => {
    test("should extract sessionId from camelCase format", () => {
      const event = { sessionId: "test-session-id-123" };
      expect(base.testExtractSessionId(event)).toBe("test-session-id-123");
    });

    test("should extract session_id from snake_case format", () => {
      const event = { session_id: "test-session-id-456" };
      expect(base.testExtractSessionId(event)).toBe("test-session-id-456");
    });

    test("should prefer sessionId over session_id when both exist", () => {
      const event = {
        sessionId: "camel-case-id",
        session_id: "snake-case-id",
      };
      expect(base.testExtractSessionId(event)).toBe("camel-case-id");
    });

    test("should return undefined when neither exists", () => {
      const event = { type: "some-event" };
      expect(base.testExtractSessionId(event)).toBeUndefined();
    });

    test("should handle empty object", () => {
      const event = {};
      expect(base.testExtractSessionId(event)).toBeUndefined();
    });
  });

  describe("createQueryOptions", () => {
    test("should create basic options with resume=true", () => {
      const opts = base.testCreateQueryOptions("hello", {
        resume: true,
        sdkSessionId: "session-123",
        systemPrompt: "You are helpful",
      });

      expect(opts.prompt).toBe("hello");
      expect(opts.resume).toBe(true);
      expect(opts.sdkSessionId).toBe("session-123");
      expect(opts.systemPrompt).toBe("You are helpful");
      expect(opts.cwd).toBeDefined(); // Should default to process.cwd()
    });

    test("should default resume to false", () => {
      const opts = base.testCreateQueryOptions("hello", {});

      expect(opts.resume).toBe(false);
    });

    test("should use provided cwd", () => {
      const opts = base.testCreateQueryOptions("hello", {
        cwd: "/custom/path",
      });

      expect(opts.cwd).toBe("/custom/path");
    });

    test("should use process.cwd() when cwd is not provided", () => {
      const opts = base.testCreateQueryOptions("hello", {});

      expect(opts.cwd).toBe(process.cwd());
    });

    test("should handle all options together", () => {
      const opts = base.testCreateQueryOptions("test prompt", {
        resume: true,
        sdkSessionId: "abc-123",
        systemPrompt: "Custom prompt",
        cwd: "/test/dir",
      });

      expect(opts.prompt).toBe("test prompt");
      expect(opts.resume).toBe(true);
      expect(opts.sdkSessionId).toBe("abc-123");
      expect(opts.systemPrompt).toBe("Custom prompt");
      expect(opts.cwd).toBe("/test/dir");
    });

    test("should handle undefined optional fields", () => {
      const opts = base.testCreateQueryOptions("hello", {
        resume: false,
      });

      expect(opts.prompt).toBe("hello");
      expect(opts.resume).toBe(false);
      expect(opts.sdkSessionId).toBeUndefined();
      expect(opts.systemPrompt).toBeUndefined();
      expect(opts.cwd).toBe(process.cwd());
    });
  });

  describe("withApiKey", () => {
    test("should execute function and return result", () => {
      const result = base.testWithApiKey(() => {
        return "test-result";
      });

      expect(result).toBe("test-result");
    });

    test("should execute async function", async () => {
      const result = await base.testWithApiKey(async () => {
        return Promise.resolve("async-result");
      });

      expect(result).toBe("async-result");
    });

    test("should restore original API key after execution", () => {
      const original = process.env.CLAUDE_API_KEY;

      base.testWithApiKey(() => {
        // During execution, key should be changed
        expect(process.env.CLAUDE_API_KEY).toBeDefined();
      });

      // After execution, key should be restored
      expect(process.env.CLAUDE_API_KEY).toBe(original);
    });

    test("should restore original API key even on error", () => {
      const original = process.env.CLAUDE_API_KEY;

      try {
        base.testWithApiKey(() => {
          throw new Error("Test error");
        });
      } catch (error) {
        // Expected error
      }

      // Key should still be restored
      expect(process.env.CLAUDE_API_KEY).toBe(original);
    });
  });
});

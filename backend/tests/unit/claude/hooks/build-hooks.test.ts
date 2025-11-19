/**
 * Unit tests for buildHooks function
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildHooks } from "../../../../src/claude/hooks/build-hooks.js";
import type { HookConfig } from "../../../../src/claude/types/hooks.js";
import type { PreToolUseHookInput, PostToolUseHookInput } from "@anthropic-ai/claude-agent-sdk";

describe("buildHooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("empty configuration", () => {
    it("should create both hooks by default when config is empty", () => {
      const config: HookConfig = {};
      const result = buildHooks({ config });

      // Default: both hooks are enabled
      expect(result.PreToolUse).toBeDefined();
      expect(result.PostToolUse).toBeDefined();
    });

    it("should return empty hooks when all options explicitly false", () => {
      const config: HookConfig = {
        enablePreToolUse: false,
        enablePostToolUse: false,
      };
      const result = buildHooks({ config });

      expect(result).toEqual({});
    });
  });

  describe("PreToolUse hook", () => {
    it("should create only PreToolUse hook when PostToolUse is disabled", () => {
      const config: HookConfig = {
        enablePreToolUse: true,
        enablePostToolUse: false,
      };
      const result = buildHooks({ config });

      expect(result.PreToolUse).toBeDefined();
      expect(result.PreToolUse).toHaveLength(1);
      expect(result.PreToolUse![0].hooks).toHaveLength(1);
      expect(result.PostToolUse).toBeUndefined();
    });

    it("should add matcher when toolMatcher is specified", () => {
      const config: HookConfig = {
        enablePreToolUse: true,
        toolMatcher: "Bash|Read",
      };
      const result = buildHooks({ config });

      expect(result.PreToolUse![0].matcher).toBe("Bash|Read");
    });

    it("should return approve decision by default", async () => {
      const config: HookConfig = {
        enablePreToolUse: true,
      };
      const result = buildHooks({ config });

      const hookCallback = result.PreToolUse![0].hooks[0];
      const mockInput: PreToolUseHookInput = {
        hook_event_name: "PreToolUse",
        session_id: "test-session",
        transcript_path: "/tmp/transcript",
        cwd: "/test",
        tool_name: "Bash",
        tool_input: { command: "ls" },
      };

      const output = await hookCallback(mockInput, "tool-use-123", {
        signal: new AbortController().signal,
      });

      expect(output).toEqual({
        continue: true,
        decision: "approve",
      });
    });

    it("should call onProgress callback with pre_tool_use event", async () => {
      const onProgress = vi.fn();
      const config: HookConfig = {
        enablePreToolUse: true,
      };
      const result = buildHooks({
        config,
        taskId: "task-123",
        onProgress,
      });

      const hookCallback = result.PreToolUse![0].hooks[0];
      const mockInput: PreToolUseHookInput = {
        hook_event_name: "PreToolUse",
        session_id: "test-session",
        transcript_path: "/tmp/transcript",
        cwd: "/test",
        tool_name: "Bash",
        tool_input: { command: "ls" },
      };

      await hookCallback(mockInput, "tool-use-123", { signal: new AbortController().signal });

      expect(onProgress).toHaveBeenCalledTimes(1);
      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "hook:pre_tool_use",
          toolName: "Bash",
          toolInput: { command: "ls" },
        }),
      );
    });
  });

  describe("PostToolUse hook", () => {
    it("should create only PostToolUse hook when PreToolUse is disabled", () => {
      const config: HookConfig = {
        enablePreToolUse: false,
        enablePostToolUse: true,
      };
      const result = buildHooks({ config });

      expect(result.PostToolUse).toBeDefined();
      expect(result.PostToolUse).toHaveLength(1);
      expect(result.PostToolUse![0].hooks).toHaveLength(1);
      expect(result.PreToolUse).toBeUndefined();
    });

    it("should add matcher when toolMatcher is specified", () => {
      const config: HookConfig = {
        enablePostToolUse: true,
        toolMatcher: "Edit|Write",
      };
      const result = buildHooks({ config });

      expect(result.PostToolUse![0].matcher).toBe("Edit|Write");
    });

    it("should return continue: true by default", async () => {
      const config: HookConfig = {
        enablePostToolUse: true,
      };
      const result = buildHooks({ config });

      const hookCallback = result.PostToolUse![0].hooks[0];
      const mockInput: PostToolUseHookInput = {
        hook_event_name: "PostToolUse",
        session_id: "test-session",
        transcript_path: "/tmp/transcript",
        cwd: "/test",
        tool_name: "Read",
        tool_input: { file_path: "/test/file.ts" },
        tool_response: "file contents",
      };

      const output = await hookCallback(mockInput, "tool-use-123", {
        signal: new AbortController().signal,
      });

      expect(output).toEqual({
        continue: true,
      });
    });

    it("should call onProgress callback with post_tool_use event", async () => {
      const onProgress = vi.fn();
      const config: HookConfig = {
        enablePostToolUse: true,
      };
      const result = buildHooks({
        config,
        taskId: "task-456",
        onProgress,
      });

      const hookCallback = result.PostToolUse![0].hooks[0];
      const mockInput: PostToolUseHookInput = {
        hook_event_name: "PostToolUse",
        session_id: "test-session",
        transcript_path: "/tmp/transcript",
        cwd: "/test",
        tool_name: "Read",
        tool_input: { file_path: "/test/file.ts" },
        tool_response: "file contents",
      };

      await hookCallback(mockInput, "tool-use-123", { signal: new AbortController().signal });

      expect(onProgress).toHaveBeenCalledTimes(1);
      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "hook:post_tool_use",
          toolName: "Read",
          toolInput: { file_path: "/test/file.ts" },
          toolOutput: "file contents",
        }),
      );
    });
  });

  describe("both hooks enabled", () => {
    it("should create both PreToolUse and PostToolUse hooks", () => {
      const config: HookConfig = {
        enablePreToolUse: true,
        enablePostToolUse: true,
      };
      const result = buildHooks({ config });

      expect(result.PreToolUse).toBeDefined();
      expect(result.PostToolUse).toBeDefined();
      expect(result.PreToolUse).toHaveLength(1);
      expect(result.PostToolUse).toHaveLength(1);
    });

    it("should apply same toolMatcher to both hooks", () => {
      const config: HookConfig = {
        enablePreToolUse: true,
        enablePostToolUse: true,
        toolMatcher: "Bash",
      };
      const result = buildHooks({ config });

      expect(result.PreToolUse![0].matcher).toBe("Bash");
      expect(result.PostToolUse![0].matcher).toBe("Bash");
    });
  });

  describe("onProgress not provided", () => {
    it("should work without onProgress callback", async () => {
      const config: HookConfig = {
        enablePreToolUse: true,
        enablePostToolUse: true,
      };
      const result = buildHooks({ config });

      const preHookCallback = result.PreToolUse![0].hooks[0];
      const mockPreInput: PreToolUseHookInput = {
        hook_event_name: "PreToolUse",
        session_id: "test-session",
        transcript_path: "/tmp/transcript",
        cwd: "/test",
        tool_name: "Bash",
        tool_input: { command: "ls" },
      };

      // Should not throw
      const preOutput = await preHookCallback(mockPreInput, "tool-use-123", {
        signal: new AbortController().signal,
      });
      expect(preOutput).toEqual({
        continue: true,
        decision: "approve",
      });

      const postHookCallback = result.PostToolUse![0].hooks[0];
      const mockPostInput: PostToolUseHookInput = {
        hook_event_name: "PostToolUse",
        session_id: "test-session",
        transcript_path: "/tmp/transcript",
        cwd: "/test",
        tool_name: "Read",
        tool_input: { file_path: "/test" },
        tool_response: "result",
      };

      const postOutput = await postHookCallback(mockPostInput, "tool-use-456", {
        signal: new AbortController().signal,
      });
      expect(postOutput).toEqual({
        continue: true,
      });
    });
  });

  describe("edge cases", () => {
    it("should handle undefined toolInput", async () => {
      const onProgress = vi.fn();
      const config: HookConfig = {
        enablePreToolUse: true,
      };
      const result = buildHooks({ config, onProgress });

      const hookCallback = result.PreToolUse![0].hooks[0];
      const mockInput: PreToolUseHookInput = {
        hook_event_name: "PreToolUse",
        session_id: "test-session",
        transcript_path: "/tmp/transcript",
        cwd: "/test",
        tool_name: "Unknown",
        tool_input: undefined as unknown,
      };

      const output = await hookCallback(mockInput, undefined, {
        signal: new AbortController().signal,
      });

      expect(output).toEqual({
        continue: true,
        decision: "approve",
      });
    });

    it("should handle complex tool input objects", async () => {
      const onProgress = vi.fn();
      const config: HookConfig = {
        enablePreToolUse: true,
      };
      const result = buildHooks({ config, onProgress });

      const hookCallback = result.PreToolUse![0].hooks[0];
      const complexInput = {
        nested: {
          deep: {
            value: 123,
          },
        },
        array: [1, 2, 3],
      };
      const mockInput: PreToolUseHookInput = {
        hook_event_name: "PreToolUse",
        session_id: "test-session",
        transcript_path: "/tmp/transcript",
        cwd: "/test",
        tool_name: "ComplexTool",
        tool_input: complexInput,
      };

      await hookCallback(mockInput, "tool-use-789", { signal: new AbortController().signal });

      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          toolInput: complexInput,
        }),
      );
    });
  });
});

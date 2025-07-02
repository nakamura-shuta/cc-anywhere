import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { InstructionProcessor } from "../../src/services/slash-commands/instruction-processor";
import type { TaskContext } from "../../src/claude/types";
import { promises as fs } from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

describe("InstructionProcessor", () => {
  let processor: InstructionProcessor;
  let testDir: string;

  beforeEach(async () => {
    processor = new InstructionProcessor();
    // Create a temporary directory for test commands
    testDir = path.join(os.tmpdir(), `test-commands-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test directory
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe("process", () => {
    it("should return original instruction for non-slash commands", async () => {
      const result = await processor.process("Just a regular instruction");
      expect(result).toEqual({ instruction: "Just a regular instruction" });
    });

    it("should return original instruction for plain slash commands", async () => {
      const result = await processor.process("/test some arguments");
      expect(result).toEqual({ instruction: "/test some arguments" });
    });

    describe("/project: prefix", () => {
      it("should process /project: commands with template", async () => {
        // Create a test command file
        const commandsDir = path.join(testDir, ".claude/commands");
        await fs.mkdir(commandsDir, { recursive: true });

        const commandContent = `---
command: /test
description: Test command
---
Analyze {{args}}`;
        await fs.writeFile(path.join(commandsDir, "test.md"), commandContent);

        const taskContext: TaskContext = { workingDirectory: testDir };
        const result = await processor.process("/project:test file1 file2", taskContext);

        expect(result.instruction).toBe("Analyze file1, file2");
        expect(result.metadata).toEqual({
          originalCommand: "/project:test file1 file2",
          commandName: "/test",
          appliedTemplate: expect.stringContaining("test.md"),
        });
      });

      it("should handle missing working directory for /project: commands", async () => {
        const result = await processor.process("/project:test some args");

        expect(result.instruction).toBe("some args");
        expect(result.metadata).toEqual({
          originalCommand: "/project:test some args",
          ignoredCommand: "/project:test",
          reason: "no_working_directory",
        });
      });

      it("should handle command not found with fallback to arguments", async () => {
        const taskContext: TaskContext = { workingDirectory: testDir };
        const result = await processor.process("/project:nonexistent arg1 arg2", taskContext);

        expect(result.instruction).toBe("arg1 arg2");
        expect(result.metadata).toEqual({
          originalCommand: "/project:nonexistent arg1 arg2",
          ignoredCommand: "/project:nonexistent",
          reason: "command_not_found",
        });
      });

      it("should handle command with no arguments", async () => {
        const taskContext: TaskContext = { workingDirectory: testDir };
        const result = await processor.process("/project:test", taskContext);

        expect(result.instruction).toBe("/project:test");
        expect(result.metadata?.ignoredCommand).toBe("/project:test");
      });
    });

    describe("/user: prefix", () => {
      beforeEach(() => {
        // Mock the home directory to use our test directory
        vi.stubEnv("HOME", testDir);
      });

      afterEach(() => {
        vi.unstubAllEnvs();
      });

      it("should process /user: commands with template", async () => {
        // Create a test command file in user directory
        const commandsDir = path.join(testDir, ".claude/commands");
        await fs.mkdir(commandsDir, { recursive: true });

        const commandContent = `---
command: /mycommand
description: My personal command
parameters:
  - name: target
    type: string
    required: true
---
Processing {{target}} with options {{options}}`;
        await fs.writeFile(path.join(commandsDir, "mycommand.md"), commandContent);

        const result = await processor.process("/user:mycommand src --verbose");

        expect(result.instruction).toContain("Processing src");
        expect(result.metadata).toEqual({
          originalCommand: "/user:mycommand src --verbose",
          commandName: "/mycommand",
          appliedTemplate: expect.stringContaining("mycommand.md"),
        });
      });

      it("should handle command not found for /user: commands", async () => {
        const result = await processor.process("/user:missing arg1 arg2");

        expect(result.instruction).toBe("arg1 arg2");
        expect(result.metadata).toEqual({
          originalCommand: "/user:missing arg1 arg2",
          ignoredCommand: "/user:missing",
          reason: "command_not_found",
        });
      });
    });

    describe("auto-derivation from filename", () => {
      it("should derive command name from filename if not specified", async () => {
        const commandsDir = path.join(testDir, ".claude/commands");
        await fs.mkdir(commandsDir, { recursive: true });

        // Command file without 'command' field
        const commandContent = `---
description: Auto-derived command
---
Hello {{args}}`;
        await fs.writeFile(path.join(commandsDir, "greet.md"), commandContent);

        const taskContext: TaskContext = { workingDirectory: testDir };
        const result = await processor.process("/project:greet world", taskContext);

        expect(result.instruction).toBe("Hello world");
        expect(result.metadata?.commandName).toBe("/greet");
      });
    });

    describe("template variable expansion", () => {
      it("should expand args variable correctly", async () => {
        const commandsDir = path.join(testDir, ".claude/commands");
        await fs.mkdir(commandsDir, { recursive: true });

        const commandContent = `---
description: Test args expansion
---
Arguments: {{args}}`;
        await fs.writeFile(path.join(commandsDir, "echo.md"), commandContent);

        const taskContext: TaskContext = { workingDirectory: testDir };
        const result = await processor.process("/project:echo one two three", taskContext);

        expect(result.instruction).toBe("Arguments: one, two, three");
      });

      it("should handle conditional templates", async () => {
        const commandsDir = path.join(testDir, ".claude/commands");
        await fs.mkdir(commandsDir, { recursive: true });

        const commandContent = `---
description: Conditional template
parameters:
  - name: mode
    type: string
    required: false
    default: "normal"
---
{{#if eq mode "debug"}}
Debug mode: {{args}}
{{/if}}
{{#if eq mode "normal"}}
Normal processing: {{args}}
{{/if}}`;
        await fs.writeFile(path.join(commandsDir, "process.md"), commandContent);

        const taskContext: TaskContext = { workingDirectory: testDir };

        // Test default mode
        const result1 = await processor.process("/project:process data", taskContext);
        expect(result1.instruction.trim()).toBe("Normal processing: data");

        // Test debug mode
        const result2 = await processor.process("/project:process data --mode=debug", taskContext);
        expect(result2.instruction.trim()).toBe("Debug mode: data");
      });
    });

    describe("error handling", () => {
      it.skip("should handle template rendering errors gracefully", async () => {
        const commandsDir = path.join(testDir, ".claude/commands");
        await fs.mkdir(commandsDir, { recursive: true });

        // Create a command that will cause the template engine to throw
        // by having a deeply nested structure that exceeds max depth
        let deepTemplate = "";
        for (let i = 0; i < 15; i++) {
          deepTemplate += "{{#each items}}";
        }
        deepTemplate += "content";
        for (let i = 0; i < 15; i++) {
          deepTemplate += "{{/each}}";
        }

        const commandContent = `---
command: /invalid
description: Invalid template
parameters:
  - name: items
    type: array
    required: false
    default: [1, 2, 3]
---
${deepTemplate}`;
        await fs.writeFile(path.join(commandsDir, "invalid.md"), commandContent);

        const taskContext: TaskContext = { workingDirectory: testDir };
        const result = await processor.process("/project:invalid test", taskContext);

        // Should return original instruction on error
        expect(result.instruction).toBe("/project:invalid test");
      });

      it("should handle invalid command parameters", async () => {
        const commandsDir = path.join(testDir, ".claude/commands");
        await fs.mkdir(commandsDir, { recursive: true });

        const commandContent = `---
description: Command with required params
parameters:
  - name: target
    type: string
    required: true
---
Processing {{target}}`;
        await fs.writeFile(path.join(commandsDir, "require.md"), commandContent);

        const taskContext: TaskContext = { workingDirectory: testDir };
        const result = await processor.process("/project:require", taskContext);

        // Should return original instruction on validation error
        expect(result.instruction).toBe("/project:require");
      });
    });

    describe("context merging", () => {
      it("should merge processed context with task context", async () => {
        const commandsDir = path.join(testDir, ".claude/commands");
        await fs.mkdir(commandsDir, { recursive: true });

        const commandContent = `---
description: Context test
parameters:
  - name: workingDirectory
    type: string
    required: false
  - name: files
    type: array
    required: false
tags:
  - test
  - context
---
Processing in {{workingDirectory}}`;
        await fs.writeFile(path.join(commandsDir, "context.md"), commandContent);

        const taskContext: TaskContext = {
          workingDirectory: testDir,
          metadata: { existing: "data" },
        };
        const result = await processor.process(
          "/project:context --workingDirectory=/custom/path --files=a.ts,b.ts",
          taskContext,
        );

        expect(result.context?.workingDirectory).toBe("/custom/path");
        expect(result.context?.files).toEqual(["a.ts", "b.ts"]);
        expect(result.context?.metadata).toEqual({
          existing: "data",
          command: "/context",
          tags: ["test", "context"],
        });
      });
    });
  });
});

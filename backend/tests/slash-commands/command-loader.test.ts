import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { CommandLoader } from "../../src/services/slash-commands/command-loader";
import { promises as fs } from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

describe("CommandLoader", () => {
  let loader: CommandLoader;
  let testDir: string;

  beforeEach(async () => {
    // Create a temporary directory for test commands
    testDir = path.join(
      os.tmpdir(),
      `test-commands-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    await fs.mkdir(testDir, { recursive: true });
    loader = new CommandLoader(testDir);
  });

  afterEach(async () => {
    // Clean up
    await loader.cleanup();
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe("loadCommands", () => {
    it("should load a simple command file", async () => {
      const commandContent = `---
command: /test
description: Test command
---
This is the template content`;
      await fs.writeFile(path.join(testDir, "test.md"), commandContent);

      await loader.loadCommands();

      const command = loader.getCommand("/test");
      expect(command).toBeDefined();
      expect(command?.command).toBe("/test");
      expect(command?.description).toBe("Test command");
      expect(command?.template).toBe("This is the template content");
    });

    it("should auto-derive command name from filename", async () => {
      const commandContent = `---
description: Auto-derived command
---
Template content`;
      await fs.writeFile(path.join(testDir, "greet.md"), commandContent);

      await loader.loadCommands();

      const command = loader.getCommand("/greet");
      expect(command).toBeDefined();
      expect(command?.command).toBe("/greet");
    });

    it("should load commands with parameters", async () => {
      const commandContent = `---
command: /analyze
description: Analyze code
parameters:
  - name: target
    type: string
    required: true
    description: Target directory
  - name: depth
    type: number
    required: false
    default: 2
    validation:
      min: 1
      max: 5
---
Analyzing {{target}} with depth {{depth}}`;
      await fs.writeFile(path.join(testDir, "analyze.md"), commandContent);

      await loader.loadCommands();

      const command = loader.getCommand("/analyze");
      expect(command?.parameters).toHaveLength(2);
      expect(command?.parameters?.[0]).toMatchObject({
        name: "target",
        type: "string",
        required: true,
      });
      expect(command?.parameters?.[1]?.validation).toMatchObject({
        min: 1,
        max: 5,
      });
    });

    it("should load commands with aliases", async () => {
      const commandContent = `---
command: /search
aliases:
  - /find
  - /grep
description: Search for patterns
---
Searching for {{pattern}}`;
      await fs.writeFile(path.join(testDir, "search.md"), commandContent);

      await loader.loadCommands();

      // Should find by main command
      expect(loader.getCommand("/search")).toBeDefined();

      // Should find by aliases
      expect(loader.getCommand("/find")).toBeDefined();
      expect(loader.getCommand("/grep")).toBeDefined();

      // All should return the same command
      const searchCmd = loader.getCommand("/search");
      expect(loader.getCommand("/find")).toBe(searchCmd);
      expect(loader.getCommand("/grep")).toBe(searchCmd);
    });

    it("should load commands from subdirectories", async () => {
      await fs.mkdir(path.join(testDir, "utils"), { recursive: true });

      const commandContent = `---
command: /util/format
description: Format utility
---
Formatting...`;
      await fs.writeFile(path.join(testDir, "utils", "format.md"), commandContent);

      await loader.loadCommands();

      const command = loader.getCommand("/util/format");
      expect(command).toBeDefined();
      expect(command?.description).toBe("Format utility");
    });

    it("should handle empty directory gracefully", async () => {
      await expect(loader.loadCommands()).resolves.not.toThrow();
      expect(loader.getAllCommands()).toHaveLength(0);
    });

    it("should ignore non-.md files", async () => {
      await fs.writeFile(path.join(testDir, "readme.txt"), "Not a command");
      await fs.writeFile(path.join(testDir, "data.json"), "{}");

      await loader.loadCommands();
      expect(loader.getAllCommands()).toHaveLength(0);
    });
  });

  describe("validation", () => {
    it("should reject commands without description", async () => {
      const commandContent = `---
command: /invalid
---
Template`;
      await fs.writeFile(path.join(testDir, "invalid.md"), commandContent);

      await loader.loadCommands();
      expect(loader.getCommand("/invalid")).toBeUndefined();
    });

    it("should reject commands not starting with /", async () => {
      const commandContent = `---
command: test
description: Invalid command
---
Template`;
      await fs.writeFile(path.join(testDir, "invalid2.md"), commandContent);

      await loader.loadCommands();
      expect(loader.getCommand("test")).toBeUndefined();
    });

    it("should validate parameter types", async () => {
      const commandContent = `---
command: /typed
description: Type test
parameters:
  - name: param1
    type: invalid
    required: true
---
Template`;
      await fs.writeFile(path.join(testDir, "typed.md"), commandContent);

      await loader.loadCommands();
      expect(loader.getCommand("/typed")).toBeUndefined();
    });
  });

  describe("isCommand", () => {
    beforeEach(async () => {
      const commandContent = `---
command: /test
aliases: [/t]
description: Test command
---
Template`;
      await fs.writeFile(path.join(testDir, "test.md"), commandContent);
      await loader.loadCommands();
    });

    it("should recognize valid commands", () => {
      expect(loader.isCommand("/test")).toBe(true);
      expect(loader.isCommand("/test arg1 arg2")).toBe(true);
      expect(loader.isCommand("/t")).toBe(true);
    });

    it("should reject non-commands", () => {
      expect(loader.isCommand("test")).toBe(false);
      expect(loader.isCommand("just text")).toBe(false);
      expect(loader.isCommand("/unknown")).toBe(false);
    });
  });

  describe.skip("hot reload", () => {
    it("should reload commands when files change", async () => {
      // Create initial command
      const initialContent = `---
command: /dynamic
description: Initial version
---
Initial template`;
      await fs.writeFile(path.join(testDir, "dynamic.md"), initialContent);

      await loader.loadCommands();
      loader.enableHotReload();

      // Verify initial state
      let command = loader.getCommand("/dynamic");
      expect(command?.description).toBe("Initial version");
      expect(command?.template).toBe("Initial template");

      // Update the file
      const updatedContent = `---
command: /dynamic
description: Updated version
---
Updated template`;
      await fs.writeFile(path.join(testDir, "dynamic.md"), updatedContent);

      // Wait for file system events to propagate
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Verify updated state
      command = loader.getCommand("/dynamic");
      expect(command?.description).toBe("Updated version");
      expect(command?.template).toBe("Updated template");
    });

    it("should handle file deletion", async () => {
      const commandContent = `---
command: /temporary
description: Will be deleted
---
Template`;
      await fs.writeFile(path.join(testDir, "temporary.md"), commandContent);

      await loader.loadCommands();
      loader.enableHotReload();

      // Verify command exists
      expect(loader.getCommand("/temporary")).toBeDefined();

      // Delete the file
      await fs.unlink(path.join(testDir, "temporary.md"));

      // Wait for file system events
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify command is removed
      expect(loader.getCommand("/temporary")).toBeUndefined();
    });

    it("should handle new file addition", async () => {
      await loader.loadCommands();
      loader.enableHotReload();

      // Initially no commands
      expect(loader.getAllCommands()).toHaveLength(0);

      // Add a new file
      const commandContent = `---
command: /new
description: Newly added
---
New template`;
      await fs.writeFile(path.join(testDir, "new.md"), commandContent);

      // Wait for file system events
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify command is added
      const command = loader.getCommand("/new");
      expect(command).toBeDefined();
      expect(command?.description).toBe("Newly added");
    });
  });

  describe("getAllCommands", () => {
    it("should return all loaded commands", async () => {
      // Create multiple commands
      const commands = [
        { file: "cmd1.md", command: "/cmd1", description: "Command 1" },
        { file: "cmd2.md", command: "/cmd2", description: "Command 2" },
        { file: "cmd3.md", command: "/cmd3", description: "Command 3" },
      ];

      for (const cmd of commands) {
        const content = `---
command: ${cmd.command}
description: ${cmd.description}
---
Template`;
        await fs.writeFile(path.join(testDir, cmd.file), content);
      }

      await loader.loadCommands();

      const allCommands = loader.getAllCommands();
      expect(allCommands).toHaveLength(3);

      const commandNames = allCommands.map((c) => c.command);
      expect(commandNames).toContain("/cmd1");
      expect(commandNames).toContain("/cmd2");
      expect(commandNames).toContain("/cmd3");
    });
  });
});

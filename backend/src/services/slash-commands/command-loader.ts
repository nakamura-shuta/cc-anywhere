import { promises as fs } from "node:fs";
import * as path from "node:path";
import matter from "gray-matter";
import chokidar from "chokidar";
import { logger } from "../../utils/logger";
import type { SlashCommand, SlashCommandMetadata } from "../../types/slash-commands";

export class CommandLoader {
  private commands: Map<string, SlashCommand> = new Map();
  private aliases: Map<string, string> = new Map();
  private watcher?: ReturnType<typeof chokidar.watch>;
  private commandsDir: string;

  constructor(commandsDir: string = path.join(process.cwd(), "commands")) {
    this.commandsDir = commandsDir;
  }

  /**
   * Load all commands from the commands directory
   */
  async loadCommands(): Promise<void> {
    try {
      // Ensure commands directory exists
      await fs.mkdir(this.commandsDir, { recursive: true });

      // Load all .md files
      const files = await this.findCommandFiles(this.commandsDir);

      for (const file of files) {
        await this.loadCommand(file);
      }

      logger.info("Slash commands loaded", {
        count: this.commands.size,
        commands: Array.from(this.commands.keys()),
      });
    } catch (error) {
      logger.error("Failed to load slash commands", { error });
      throw error;
    }
  }

  /**
   * Find all .md files in the directory recursively
   */
  private async findCommandFiles(dir: string): Promise<string[]> {
    const files: string[] = [];

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          const subFiles = await this.findCommandFiles(fullPath);
          files.push(...subFiles);
        } else if (entry.isFile() && entry.name.endsWith(".md")) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      logger.warn("Failed to read directory", { dir, error });
    }

    return files;
  }

  /**
   * Load a single command from a file
   */
  async loadCommand(filePath: string): Promise<void> {
    try {
      const content = await fs.readFile(filePath, "utf8");
      const { data, content: template } = matter(content);

      // If no command field, derive from filename
      if (!data.command) {
        const basename = path.basename(filePath, ".md");
        data.command = `/${basename}`;
      }

      // Validate metadata
      const metadata = this.validateMetadata(data as SlashCommandMetadata);

      const command: SlashCommand = {
        ...metadata,
        template: template.trim(),
        filePath,
      };

      // Register command
      this.commands.set(metadata.command, command);

      // Register aliases
      if (metadata.aliases) {
        for (const alias of metadata.aliases) {
          this.aliases.set(alias, metadata.command);
        }
      }

      logger.debug("Loaded command", {
        command: metadata.command,
        aliases: metadata.aliases,
        file: path.relative(this.commandsDir, filePath),
      });
    } catch (error) {
      logger.error("Failed to load command", { filePath, error });
    }
  }

  /**
   * Validate command metadata
   */
  private validateMetadata(data: unknown): SlashCommandMetadata {
    const metadata = data as SlashCommandMetadata;

    if (!metadata.command || typeof metadata.command !== "string") {
      throw new Error("Command must have a 'command' field");
    }

    if (!metadata.command.startsWith("/")) {
      throw new Error("Command must start with '/'");
    }

    if (!metadata.description || typeof metadata.description !== "string") {
      throw new Error("Command must have a 'description' field");
    }

    // Validate parameters if present
    if (metadata.parameters) {
      if (!Array.isArray(metadata.parameters)) {
        throw new Error("Parameters must be an array");
      }

      for (const param of metadata.parameters) {
        if (!param.name || typeof param.name !== "string") {
          throw new Error("Parameter must have a 'name' field");
        }

        if (!param.type || !["string", "number", "boolean", "array"].includes(param.type)) {
          throw new Error(`Invalid parameter type: ${param.type}`);
        }

        if (typeof param.required !== "boolean") {
          throw new Error("Parameter 'required' must be a boolean");
        }
      }
    }

    return metadata;
  }

  /**
   * Enable hot reload for development
   */
  enableHotReload(): void {
    if (this.watcher) {
      return;
    }

    this.watcher = chokidar.watch(path.join(this.commandsDir, "**/*.md"), {
      ignoreInitial: true,
      persistent: true,
    });

    this.watcher
      .on("add", (filePath: string) => {
        void this.handleFileChange(filePath, "added");
      })
      .on("change", (filePath: string) => {
        void this.handleFileChange(filePath, "changed");
      })
      .on("unlink", (filePath: string) => {
        this.handleFileRemove(filePath);
      });

    logger.info("Hot reload enabled for slash commands");
  }

  /**
   * Handle file changes
   */
  private async handleFileChange(filePath: string, event: string): Promise<void> {
    logger.info(`Command file ${event}`, { file: path.relative(this.commandsDir, filePath) });

    // Remove old command if it exists
    for (const [cmd, cmdData] of this.commands.entries()) {
      if (cmdData.filePath === filePath) {
        this.removeCommand(cmd);
        break;
      }
    }

    // Load the new/updated command
    await this.loadCommand(filePath);
  }

  /**
   * Handle file removal
   */
  private handleFileRemove(filePath: string): void {
    logger.info("Command file removed", { file: path.relative(this.commandsDir, filePath) });

    for (const [cmd, cmdData] of this.commands.entries()) {
      if (cmdData.filePath === filePath) {
        this.removeCommand(cmd);
        break;
      }
    }
  }

  /**
   * Remove a command and its aliases
   */
  private removeCommand(command: string): void {
    const cmdData = this.commands.get(command);
    if (!cmdData) return;

    // Remove command
    this.commands.delete(command);

    // Remove aliases
    if (cmdData.aliases) {
      for (const alias of cmdData.aliases) {
        this.aliases.delete(alias);
      }
    }

    logger.debug("Removed command", { command, aliases: cmdData.aliases });
  }

  /**
   * Get a command by name or alias
   */
  getCommand(nameOrAlias: string): SlashCommand | undefined {
    // Try direct command lookup
    let command = this.commands.get(nameOrAlias);

    // Try alias lookup
    if (!command) {
      const commandName = this.aliases.get(nameOrAlias);
      if (commandName) {
        command = this.commands.get(commandName);
      }
    }

    return command;
  }

  /**
   * Get all commands
   */
  getAllCommands(): SlashCommand[] {
    return Array.from(this.commands.values());
  }

  /**
   * Check if a string is a command
   */
  isCommand(str: string): boolean {
    if (!str.startsWith("/")) return false;

    const parts = str.split(/\s+/);
    const cmd = parts[0];

    return this.commands.has(cmd!) || this.aliases.has(cmd!);
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = undefined;
    }
  }
}

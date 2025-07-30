import { CommandLoader } from "./command-loader";
import { CommandParser } from "./command-parser";
import { TemplateEngine } from "./template-engine";
import type {
  ProcessedInstruction,
  CommandContext,
  SlashCommand,
} from "../../types/slash-commands";
import type { TaskContext } from "../../claude/types";
import { logger } from "../../utils/logger";

export class InstructionProcessor {
  private parser: CommandParser;
  private engine: TemplateEngine;

  constructor() {
    this.parser = new CommandParser();
    this.engine = new TemplateEngine();
  }

  /**
   * Process an instruction, expanding slash commands if present
   */
  async process(instruction: string, taskContext?: TaskContext): Promise<ProcessedInstruction> {
    // Quick check if it's a slash command
    if (!instruction.startsWith("/")) {
      return { instruction };
    }

    try {
      // Parse the command
      const parsed = this.parser.parse(instruction);
      if (!parsed) {
        return { instruction };
      }

      // Determine command type and directory
      let commandsDir: string;
      let commandName = parsed.command;

      if (parsed.command.startsWith("/project:")) {
        // /project:<command> - use repository's .claude/commands
        if (!taskContext?.workingDirectory) {
          logger.info("No working directory for /project: command", {
            command: parsed.command,
            args: parsed.args,
          });
          const newInstruction = parsed.args.join(" ");
          return {
            instruction: newInstruction || instruction,
            metadata: {
              originalCommand: instruction,
              ignoredCommand: parsed.command,
              reason: "no_working_directory",
            },
          };
        }
        commandsDir = `${taskContext.workingDirectory}/.claude/commands`;
        commandName = "/" + parsed.command.substring(9); // Remove "/project:" prefix
      } else if (parsed.command.startsWith("/user:")) {
        // /user:<command> - use user's home directory
        const homedir = process.env.HOME || process.env.USERPROFILE || "~";
        commandsDir = `${homedir}/.claude/commands`;
        commandName = "/" + parsed.command.substring(6); // Remove "/user:" prefix
      } else {
        // Plain slash command - treat as instruction
        logger.debug("Plain slash command without prefix, using as instruction", {
          command: parsed.command,
        });
        return { instruction };
      }

      // Create loader for the commands directory
      const loader = new CommandLoader(commandsDir);

      try {
        await loader.loadCommands();
      } catch (error) {
        logger.debug("No commands directory found", {
          commandsDir,
          error,
        });
      }

      // Get command definition
      const command = loader.getCommand(commandName);
      if (!command) {
        logger.info("Command not found, using arguments as instruction", {
          command: commandName,
          originalCommand: parsed.command,
          args: parsed.args,
          commandsDir,
        });
        // コマンドが見つからない場合は、引数部分を新しいinstructionとして使用
        const newInstruction = parsed.args.join(" ");
        return {
          instruction: newInstruction || instruction,
          metadata: {
            originalCommand: instruction,
            ignoredCommand: parsed.command,
            reason: "command_not_found",
          },
        };
      }

      // Validate parameters
      const validation = this.parser.validateParameters(parsed, command.parameters);
      if (!validation.valid) {
        throw new Error(`Invalid command parameters: ${validation.errors.join(", ")}`);
      }

      // Build command context
      const parameters = this.parser.buildContext(parsed, command.parameters);
      const commandContext: CommandContext = {
        parameters,
        args: parsed.args,
        options: parsed.options,
        context: taskContext,
      };

      // Render template
      const renderedInstruction = this.engine.render(command.template, commandContext);

      // Build result
      const result: ProcessedInstruction = {
        instruction: renderedInstruction,
        context: this.buildProcessedContext(command, commandContext, taskContext),
        metadata: {
          originalCommand: instruction,
          commandName: command.command,
          appliedTemplate: command.filePath,
        },
      };

      logger.debug("Processed slash command", {
        command: command.command,
        original: instruction,
        parameters,
      });

      return result;
    } catch (error) {
      logger.error("Failed to process slash command", { instruction, error });
      // Return original instruction on error
      return { instruction };
    }
  }

  /**
   * Build the processed context by merging command context with task context
   */
  private buildProcessedContext(
    command: SlashCommand,
    commandContext: CommandContext,
    taskContext?: TaskContext,
  ): TaskContext {
    const processedContext: TaskContext = {
      ...taskContext,
    };

    // Extract specific context values from parameters if they exist
    const params = commandContext.parameters;

    if (params.workingDirectory && typeof params.workingDirectory === "string") {
      processedContext.workingDirectory = params.workingDirectory;
    }

    if (params.files && Array.isArray(params.files)) {
      processedContext.files = params.files as string[];
    }

    // Add command metadata to context
    if (!processedContext.metadata) {
      processedContext.metadata = {};
    }
    processedContext.metadata.command = command.command;
    processedContext.metadata.tags = command.tags;

    return processedContext;
  }
}

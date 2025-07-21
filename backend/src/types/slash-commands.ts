/**
 * Slash command type definitions
 */

export interface SlashCommandMetadata {
  command: string;
  aliases?: string[];
  description: string;
  parameters?: CommandParameter[];
  tags?: string[];
}

export interface SlashCommand extends SlashCommandMetadata {
  template: string;
  filePath: string;
}

export interface CommandParameter {
  name: string;
  type: "string" | "number" | "boolean" | "array";
  required: boolean;
  default?: unknown;
  description?: string;
  validation?: {
    pattern?: string;
    min?: number;
    max?: number;
    enum?: unknown[];
  };
}

export interface ParsedCommand {
  command: string;
  args: string[];
  options: Record<string, unknown>;
  raw: string;
}

export interface ProcessedInstruction {
  instruction: string;
  context?: {
    workingDirectory?: string;
    files?: string[];
    [key: string]: unknown;
  };
  metadata?: {
    originalCommand?: string;
    appliedTemplate?: string;
    commandName?: string;
    ignoredCommand?: string;
    reason?: string;
  };
}

export interface CommandContext {
  parameters: Record<string, unknown>;
  args: string[];
  options: Record<string, unknown>;
  context?: {
    workingDirectory?: string;
    files?: string[];
    [key: string]: unknown;
  };
}

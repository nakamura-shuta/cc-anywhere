import type { ParsedCommand, CommandParameter } from "../../types/slash-commands";

export class CommandParser {
  /**
   * Parse a slash command string into structured format
   * Example: "/analyze src/services --depth=3 --focus=security,performance"
   */
  parse(instruction: string): ParsedCommand | null {
    if (!instruction.startsWith("/")) {
      return null;
    }

    const parts = this.tokenize(instruction);
    if (parts.length === 0) {
      return null;
    }

    const command = parts[0]!;
    const { args, options } = this.parseArgs(parts.slice(1));

    return {
      command,
      args,
      options,
      raw: instruction,
    };
  }

  /**
   * Tokenize the command string, handling quoted strings
   */
  private tokenize(instruction: string): string[] {
    const tokens: string[] = [];
    let current = "";
    let inQuote = false;
    let quoteChar = "";

    for (let i = 0; i < instruction.length; i++) {
      const char = instruction[i];

      if (!inQuote && (char === '"' || char === "'")) {
        inQuote = true;
        quoteChar = char;
      } else if (inQuote && char === quoteChar) {
        inQuote = false;
        quoteChar = "";
      } else if (!inQuote && char === " ") {
        if (current) {
          tokens.push(current);
          current = "";
        }
      } else {
        current += char;
      }
    }

    if (current) {
      tokens.push(current);
    }

    return tokens;
  }

  /**
   * Parse arguments and options from tokens
   */
  private parseArgs(tokens: string[]): { args: string[]; options: Record<string, unknown> } {
    const args: string[] = [];
    const options: Record<string, unknown> = {};

    for (const token of tokens) {
      if (token.startsWith("--")) {
        // Long option: --key=value or --flag
        const [key, ...valueParts] = token.slice(2).split("=");
        const value = valueParts.length > 0 ? valueParts.join("=") : true;
        if (key) {
          options[key] = this.parseValue(value);
        }
      } else if (token.startsWith("-") && token.length > 1) {
        // Short option: -k value (next token) or -k=value
        const hasEquals = token.includes("=");
        if (hasEquals) {
          const [key, ...valueParts] = token.slice(1).split("=");
          const value = valueParts.join("=");
          if (key) {
            options[key] = this.parseValue(value);
          }
        } else {
          // Single letter flags: -abc becomes {a: true, b: true, c: true}
          const flags = token.slice(1);
          for (const flag of flags) {
            options[flag] = true;
          }
        }
      } else {
        // Positional argument
        args.push(token);
      }
    }

    return { args, options };
  }

  /**
   * Parse a string value into appropriate type
   */
  private parseValue(value: string | boolean): unknown {
    if (typeof value === "boolean") {
      return value;
    }

    // Boolean values
    if (value === "true") return true;
    if (value === "false") return false;

    // Null/undefined
    if (value === "null") return null;
    if (value === "undefined") return undefined;

    // Numbers
    if (/^-?\d+$/.test(value)) {
      return parseInt(value, 10);
    }
    if (/^-?\d*\.\d+$/.test(value)) {
      return parseFloat(value);
    }

    // Arrays (comma-separated)
    if (value.includes(",")) {
      return value.split(",").map((v) => this.parseValue(v.trim()));
    }

    // Strings
    return value;
  }

  /**
   * Validate parsed command against parameter definitions
   */
  validateParameters(
    parsed: ParsedCommand,
    parameters?: CommandParameter[],
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!parameters || parameters.length === 0) {
      return { valid: true, errors };
    }

    // Check required parameters
    for (const param of parameters) {
      if (param.required) {
        const value = parsed.options[param.name];
        if (value === undefined || value === null) {
          // Check if it's a positional argument
          const argIndex = parameters
            .filter((p) => p.required)
            .findIndex((p) => p.name === param.name);

          if (argIndex >= 0 && !parsed.args[argIndex]) {
            errors.push(`Missing required parameter: ${param.name}`);
          }
        }
      }
    }

    // Validate parameter types and constraints
    for (const [key, value] of Object.entries(parsed.options)) {
      const param = parameters.find((p) => p.name === key);
      if (!param) continue;

      // Type validation
      if (!this.validateType(value, param.type)) {
        errors.push(`Parameter '${key}' must be of type ${param.type}`);
      }

      // Additional validation
      if (param.validation) {
        const validation = param.validation;

        // Pattern validation for strings
        if (validation.pattern && typeof value === "string") {
          const regex = new RegExp(validation.pattern);
          if (!regex.test(value)) {
            errors.push(`Parameter '${key}' does not match pattern: ${validation.pattern}`);
          }
        }

        // Min/max validation for numbers
        if (typeof value === "number") {
          if (validation.min !== undefined && value < validation.min) {
            errors.push(`Parameter '${key}' must be >= ${validation.min}`);
          }
          if (validation.max !== undefined && value > validation.max) {
            errors.push(`Parameter '${key}' must be <= ${validation.max}`);
          }
        }

        // Enum validation
        if (validation.enum && !validation.enum.includes(value)) {
          errors.push(`Parameter '${key}' must be one of: ${validation.enum.join(", ")}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate value type
   */
  private validateType(value: unknown, type: CommandParameter["type"]): boolean {
    switch (type) {
      case "string":
        return typeof value === "string";
      case "number":
        return typeof value === "number" && !isNaN(value);
      case "boolean":
        return typeof value === "boolean";
      case "array":
        return Array.isArray(value);
      default:
        return false;
    }
  }

  /**
   * Build a command context from parsed command and parameters
   */
  buildContext(parsed: ParsedCommand, parameters?: CommandParameter[]): Record<string, unknown> {
    const context: Record<string, unknown> = { ...parsed.options };

    // Map positional arguments to parameters
    if (parameters) {
      const positionalParams = parameters.filter((p) => p.required);
      positionalParams.forEach((param, index) => {
        if (parsed.args[index] !== undefined && context[param.name] === undefined) {
          context[param.name] = this.parseValue(parsed.args[index]);
        }
      });

      // Apply defaults
      for (const param of parameters) {
        if (context[param.name] === undefined && param.default !== undefined) {
          context[param.name] = param.default;
        }
      }
    }

    return context;
  }
}

import { describe, it, expect } from "vitest";
import { TemplateEngine } from "../../src/services/slash-commands/template-engine";
import type { CommandContext } from "../../src/types/slash-commands";

describe("TemplateEngine - Claude Code Compatibility", () => {
  const engine = new TemplateEngine();

  describe("$VARIABLE substitution", () => {
    it("should substitute $ARGUMENTS with args", () => {
      const template = "Arguments: $ARGUMENTS";
      const context: CommandContext = {
        parameters: {},
        args: ["arg1", "arg2", "arg3"],
        options: {},
      };
      const result = engine.render(template, context);
      expect(result).toBe("Arguments: arg1, arg2, arg3");
    });

    it("should substitute uppercase parameter variables", () => {
      const template = "Target: $TARGET, Mode: $MODE";
      const context: CommandContext = {
        parameters: { 
          target: "src",
          mode: "debug"
        },
        args: [],
        options: {},
      };
      const result = engine.render(template, context);
      expect(result).toBe("Target: src, Mode: debug");
    });

    it("should handle missing variables by keeping them as-is", () => {
      const template = "Value: $UNDEFINED_VAR";
      const context: CommandContext = {
        parameters: {},
        args: [],
        options: {},
      };
      const result = engine.render(template, context);
      expect(result).toBe("Value: $UNDEFINED_VAR");
    });

    it("should support both $VARIABLE and {{variable}} syntax", () => {
      const template = "Args: $ARGUMENTS, Count: {{args.length}}";
      const context: CommandContext = {
        parameters: {},
        args: ["a", "b"],
        options: {},
      };
      const result = engine.render(template, context);
      expect(result).toBe("Args: a, b, Count: 2");
    });
  });
});
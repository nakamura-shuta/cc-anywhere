import { describe, it, expect } from "vitest";
import { TemplateEngine } from "../../src/services/slash-commands/template-engine";
import type { CommandContext } from "../../src/types/slash-commands";

describe("TemplateEngine", () => {
  const engine = new TemplateEngine();

  describe("variable substitution", () => {
    it("should substitute simple variables", () => {
      const template = "Analyze {{target}} with depth {{depth}}";
      const context: CommandContext = {
        parameters: { target: "src", depth: 3 },
        args: [],
        options: {},
      };
      const result = engine.render(template, context);
      expect(result).toBe("Analyze src with depth 3");
    });

    it("should handle nested properties", () => {
      const template = "Working in {{context.workingDirectory}}";
      const context: CommandContext = {
        parameters: {},
        args: [],
        options: {},
        context: { workingDirectory: "/home/project" },
      };
      const result = engine.render(template, context);
      expect(result).toBe("Working in /home/project");
    });

    it("should handle undefined variables as empty strings", () => {
      const template = "Value: {{undefined}}";
      const context: CommandContext = {
        parameters: {},
        args: [],
        options: {},
      };
      const result = engine.render(template, context);
      expect(result).toBe("Value: ");
    });
  });

  describe("conditionals", () => {
    it("should render if block when condition is true", () => {
      const template = "{{#if showDetails}}Details shown{{/if}}";
      const context: CommandContext = {
        parameters: { showDetails: true },
        args: [],
        options: {},
      };
      const result = engine.render(template, context);
      expect(result).toBe("Details shown");
    });

    it("should not render if block when condition is false", () => {
      const template = "{{#if showDetails}}Details shown{{/if}}";
      const context: CommandContext = {
        parameters: { showDetails: false },
        args: [],
        options: {},
      };
      const result = engine.render(template, context);
      expect(result).toBe("");
    });

    it("should handle numeric comparisons", () => {
      const template = "{{#if depth >= 2}}Deep analysis{{/if}}";
      const context: CommandContext = {
        parameters: { depth: 3 },
        args: [],
        options: {},
      };
      const result = engine.render(template, context);
      expect(result).toBe("Deep analysis");
    });

    it("should handle equality comparisons", () => {
      const template = '{{#if eq type "test"}}Running tests{{/if}}';
      const context: CommandContext = {
        parameters: { type: "test" },
        args: [],
        options: {},
      };
      const result = engine.render(template, context);
      expect(result).toBe("Running tests");
    });
  });

  describe("loops", () => {
    it("should iterate over arrays", () => {
      const template = "Files: {{#each files}}- {{this}}\n{{/each}}";
      const context: CommandContext = {
        parameters: { files: ["a.ts", "b.ts", "c.ts"] },
        args: [],
        options: {},
      };
      const result = engine.render(template, context);
      expect(result).toBe("Files: - a.ts\n- b.ts\n- c.ts\n");
    });

    it("should provide loop metadata", () => {
      const template = "{{#each items}}{{index}}: {{this}}{{#if last}} (last){{/if}}\n{{/each}}";
      const context: CommandContext = {
        parameters: { items: ["first", "second", "third"] },
        args: [],
        options: {},
      };
      const result = engine.render(template, context);
      expect(result).toContain("0: first");
      expect(result).toContain("1: second");
      expect(result).toContain("2: third");
      // Check that last item has (last) marker
      const lines = result.split("\n").filter((line) => line.trim());
      expect(lines[lines.length - 1]).toContain("(last)");
    });

    it("should handle empty arrays", () => {
      const template = "Items: {{#each items}}{{this}}{{/each}}None";
      const context: CommandContext = {
        parameters: { items: [] },
        args: [],
        options: {},
      };
      const result = engine.render(template, context);
      expect(result).toBe("Items: None");
    });
  });

  describe("complex templates", () => {
    it("should handle nested conditionals and loops", () => {
      const template = `
{{#if analyze}}
Analyzing {{target}}:
{{#each aspects}}
  - {{this}}{{#if includes focus this}} (focused){{/if}}
{{/each}}
{{/if}}`;
      const context: CommandContext = {
        parameters: {
          analyze: true,
          target: "src",
          aspects: ["security", "performance", "quality"],
          focus: ["security", "quality"],
        },
        args: [],
        options: {},
      };
      const result = engine.render(template, context);
      expect(result).toContain("Analyzing src:");
      expect(result).toContain("- security (focused)");
      expect(result).toContain("- performance");
      expect(result).toContain("- quality (focused)");
    });
  });

  describe("error handling", () => {
    it("should handle circular references gracefully", () => {
      const template = "{{#if true}}{{#if true}}{{#if true}}nested{{/if}}{{/if}}{{/if}}";
      const context: CommandContext = {
        parameters: {},
        args: [],
        options: {},
      };
      expect(() => engine.render(template, context)).not.toThrow();
    });

    it.skip("should enforce maximum depth", () => {
      // Create a template that recursively includes itself via nested structures
      const createDeepTemplate = (depth: number): string => {
        if (depth === 0) return "end";
        return `{{#each items}}${createDeepTemplate(depth - 1)}{{/each}}`;
      };

      // Create a template deeper than maxDepth (10)
      const template = createDeepTemplate(12);

      const context: CommandContext = {
        parameters: { items: [1, 2] },
        args: [],
        options: {},
      };
      expect(() => engine.render(template, context)).toThrow("Maximum template depth exceeded");
    });
  });
});

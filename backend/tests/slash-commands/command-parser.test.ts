import { describe, it, expect } from "vitest";
import { CommandParser } from "../../src/services/slash-commands/command-parser";
import type { CommandParameter } from "../../src/types/slash-commands";

describe("CommandParser", () => {
  const parser = new CommandParser();

  describe("parse", () => {
    it("should parse simple command", () => {
      const result = parser.parse("/analyze src");
      expect(result).toEqual({
        command: "/analyze",
        args: ["src"],
        options: {},
        raw: "/analyze src",
      });
    });

    it("should parse command with options", () => {
      const result = parser.parse("/analyze src --depth=3 --focus=security");
      expect(result).toEqual({
        command: "/analyze",
        args: ["src"],
        options: {
          depth: 3,
          focus: "security",
        },
        raw: "/analyze src --depth=3 --focus=security",
      });
    });

    it("should parse command with array options", () => {
      const result = parser.parse("/analyze src --focus=security,performance");
      expect(result).toEqual({
        command: "/analyze",
        args: ["src"],
        options: {
          focus: ["security", "performance"],
        },
        raw: "/analyze src --focus=security,performance",
      });
    });

    it("should parse command with quoted strings", () => {
      const result = parser.parse('/analyze "src/my folder" --message="hello world"');
      expect(result).toEqual({
        command: "/analyze",
        args: ["src/my folder"],
        options: {
          message: "hello world",
        },
        raw: '/analyze "src/my folder" --message="hello world"',
      });
    });

    it("should return null for non-command strings", () => {
      const result = parser.parse("just a regular instruction");
      expect(result).toBeNull();
    });

    it("should parse boolean flags", () => {
      const result = parser.parse("/analyze src --verbose --no-cache");
      expect(result).toEqual({
        command: "/analyze",
        args: ["src"],
        options: {
          verbose: true,
          "no-cache": true,
        },
        raw: "/analyze src --verbose --no-cache",
      });
    });
  });

  describe("validateParameters", () => {
    const params: CommandParameter[] = [
      {
        name: "target",
        type: "string",
        required: true,
      },
      {
        name: "depth",
        type: "number",
        required: false,
        default: 2,
        validation: {
          min: 1,
          max: 5,
        },
      },
      {
        name: "focus",
        type: "array",
        required: false,
      },
    ];

    it("should validate valid parameters", () => {
      const parsed = parser.parse("/analyze src --depth=3")!;
      const result = parser.validateParameters(parsed, params);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it("should catch missing required parameters", () => {
      const parsed = parser.parse("/analyze --depth=3")!;
      const result = parser.validateParameters(parsed, params);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Missing required parameter: target");
    });

    it("should catch invalid parameter types", () => {
      const parsed = parser.parse("/analyze src --depth=invalid")!;
      const result = parser.validateParameters(parsed, params);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Parameter 'depth' must be of type number");
    });

    it("should catch min/max violations", () => {
      const parsed = parser.parse("/analyze src --depth=10")!;
      const result = parser.validateParameters(parsed, params);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Parameter 'depth' must be <= 5");
    });
  });

  describe("buildContext", () => {
    const params: CommandParameter[] = [
      {
        name: "target",
        type: "string",
        required: true,
      },
      {
        name: "depth",
        type: "number",
        required: false,
        default: 2,
      },
    ];

    it("should build context with positional arguments", () => {
      const parsed = parser.parse("/analyze src")!;
      const context = parser.buildContext(parsed, params);
      expect(context).toEqual({
        target: "src",
        depth: 2, // default value
      });
    });

    it("should override defaults with provided options", () => {
      const parsed = parser.parse("/analyze src --depth=3")!;
      const context = parser.buildContext(parsed, params);
      expect(context).toEqual({
        target: "src",
        depth: 3,
      });
    });

    it("should handle multiple positional arguments", () => {
      const multiParams: CommandParameter[] = [
        { name: "source", type: "string", required: true },
        { name: "destination", type: "string", required: true },
      ];
      const parsed = parser.parse("/copy src dest")!;
      const context = parser.buildContext(parsed, multiParams);
      expect(context).toEqual({
        source: "src",
        destination: "dest",
      });
    });
  });
});

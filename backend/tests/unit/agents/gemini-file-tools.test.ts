/**
 * Gemini File Tools Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import {
  FILE_TOOL_DECLARATIONS,
  FILE_TOOL_NAMES,
  isFileTool,
  executeFileFunction,
  GeminiType,
} from "../../../src/agents/gemini-file-tools.js";

describe("gemini-file-tools", () => {
  const TEST_DIR = path.join(process.cwd(), ".test-workspace-gemini-file-tools");

  beforeEach(() => {
    // Create test directory
    if (!fs.existsSync(TEST_DIR)) {
      fs.mkdirSync(TEST_DIR, { recursive: true });
    }
  });

  afterEach(() => {
    // Cleanup test directory
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  describe("FILE_TOOL_DECLARATIONS", () => {
    it("should have 6 file tool declarations", () => {
      expect(FILE_TOOL_DECLARATIONS).toHaveLength(6);
    });

    it("should include all expected tool names", () => {
      const names = FILE_TOOL_DECLARATIONS.map((d) => d.name);
      expect(names).toContain("createFile");
      expect(names).toContain("readFile");
      expect(names).toContain("updateFile");
      expect(names).toContain("deleteFile");
      expect(names).toContain("listDir");
      expect(names).toContain("createDir");
    });

    it("should have proper parameter types", () => {
      for (const decl of FILE_TOOL_DECLARATIONS) {
        expect(decl.parameters.type).toBe(GeminiType.OBJECT);
        expect(decl.parameters.properties).toBeDefined();
        expect(decl.parameters.required).toBeDefined();
        expect(Array.isArray(decl.parameters.required)).toBe(true);
      }
    });

    it("createFile should require path and content", () => {
      const createFile = FILE_TOOL_DECLARATIONS.find((d) => d.name === "createFile");
      expect(createFile?.parameters.required).toEqual(["path", "content"]);
    });

    it("readFile should require only path", () => {
      const readFile = FILE_TOOL_DECLARATIONS.find((d) => d.name === "readFile");
      expect(readFile?.parameters.required).toEqual(["path"]);
    });
  });

  describe("FILE_TOOL_NAMES", () => {
    it("should contain all tool names", () => {
      expect(FILE_TOOL_NAMES).toEqual([
        "createFile",
        "readFile",
        "updateFile",
        "deleteFile",
        "listDir",
        "createDir",
      ]);
    });
  });

  describe("isFileTool", () => {
    it("should return true for valid file tools", () => {
      expect(isFileTool("createFile")).toBe(true);
      expect(isFileTool("readFile")).toBe(true);
      expect(isFileTool("updateFile")).toBe(true);
      expect(isFileTool("deleteFile")).toBe(true);
      expect(isFileTool("listDir")).toBe(true);
      expect(isFileTool("createDir")).toBe(true);
    });

    it("should return false for invalid tool names", () => {
      expect(isFileTool("unknownTool")).toBe(false);
      expect(isFileTool("")).toBe(false);
      expect(isFileTool("create_file")).toBe(false);
    });
  });

  describe("executeFileFunction", () => {
    describe("createFile", () => {
      it("should create a file with content", () => {
        const filePath = path.join(TEST_DIR, "test.txt");
        const result = executeFileFunction("createFile", {
          path: filePath,
          content: "Hello, World!",
        });

        expect(result.success).toBe(true);
        expect(result.message).toContain("File created");
        expect(fs.existsSync(filePath)).toBe(true);
        expect(fs.readFileSync(filePath, "utf-8")).toBe("Hello, World!");
      });

      it("should create parent directories if needed", () => {
        const filePath = path.join(TEST_DIR, "nested", "dir", "test.txt");
        const result = executeFileFunction("createFile", {
          path: filePath,
          content: "Nested content",
        });

        expect(result.success).toBe(true);
        expect(fs.existsSync(filePath)).toBe(true);
      });
    });

    describe("readFile", () => {
      it("should read file contents", () => {
        const filePath = path.join(TEST_DIR, "read-test.txt");
        const content = "Content to read";
        fs.writeFileSync(filePath, content, "utf-8");

        const result = executeFileFunction("readFile", { path: filePath });

        expect(result.success).toBe(true);
        expect(result.content).toBe(content);
      });

      it("should return error for non-existent file", () => {
        const filePath = path.join(TEST_DIR, "non-existent.txt");

        const result = executeFileFunction("readFile", { path: filePath });

        expect(result.success).toBe(false);
        expect(result.error).toContain("File not found");
      });
    });

    describe("updateFile", () => {
      it("should update existing file", () => {
        const filePath = path.join(TEST_DIR, "update-test.txt");
        fs.writeFileSync(filePath, "Original content", "utf-8");

        const result = executeFileFunction("updateFile", {
          path: filePath,
          content: "Updated content",
        });

        expect(result.success).toBe(true);
        expect(result.message).toContain("File updated");
        expect(fs.readFileSync(filePath, "utf-8")).toBe("Updated content");
      });

      it("should return error for non-existent file", () => {
        const filePath = path.join(TEST_DIR, "non-existent.txt");

        const result = executeFileFunction("updateFile", {
          path: filePath,
          content: "New content",
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain("File not found");
      });
    });

    describe("deleteFile", () => {
      it("should delete existing file", () => {
        const filePath = path.join(TEST_DIR, "delete-test.txt");
        fs.writeFileSync(filePath, "To be deleted", "utf-8");

        const result = executeFileFunction("deleteFile", { path: filePath });

        expect(result.success).toBe(true);
        expect(result.message).toContain("File deleted");
        expect(fs.existsSync(filePath)).toBe(false);
      });

      it("should return error for non-existent file", () => {
        const filePath = path.join(TEST_DIR, "non-existent.txt");

        const result = executeFileFunction("deleteFile", { path: filePath });

        expect(result.success).toBe(false);
        expect(result.error).toContain("File not found");
      });
    });

    describe("listDir", () => {
      it("should list directory contents", () => {
        // Create some test files
        fs.writeFileSync(path.join(TEST_DIR, "file1.txt"), "content1");
        fs.writeFileSync(path.join(TEST_DIR, "file2.txt"), "content2");
        fs.mkdirSync(path.join(TEST_DIR, "subdir"));

        const result = executeFileFunction("listDir", { path: TEST_DIR });

        expect(result.success).toBe(true);
        expect(result.items).toBeDefined();
        expect(result.items?.length).toBe(3);

        const names = result.items?.map((i) => i.name) || [];
        expect(names).toContain("file1.txt");
        expect(names).toContain("file2.txt");
        expect(names).toContain("subdir");

        const subdir = result.items?.find((i) => i.name === "subdir");
        expect(subdir?.type).toBe("directory");

        const file1 = result.items?.find((i) => i.name === "file1.txt");
        expect(file1?.type).toBe("file");
      });

      it("should return error for non-existent directory", () => {
        const dirPath = path.join(TEST_DIR, "non-existent-dir");

        const result = executeFileFunction("listDir", { path: dirPath });

        expect(result.success).toBe(false);
        expect(result.error).toContain("Directory not found");
      });
    });

    describe("createDir", () => {
      it("should create directory", () => {
        const dirPath = path.join(TEST_DIR, "new-dir");

        const result = executeFileFunction("createDir", { path: dirPath });

        expect(result.success).toBe(true);
        expect(result.message).toContain("Directory created");
        expect(fs.existsSync(dirPath)).toBe(true);
        expect(fs.statSync(dirPath).isDirectory()).toBe(true);
      });

      it("should create nested directories", () => {
        const dirPath = path.join(TEST_DIR, "nested", "deep", "dir");

        const result = executeFileFunction("createDir", { path: dirPath });

        expect(result.success).toBe(true);
        expect(fs.existsSync(dirPath)).toBe(true);
      });
    });

    describe("unknown function", () => {
      it("should return error for unknown function", () => {
        const result = executeFileFunction("unknownFunction", { path: TEST_DIR });

        expect(result.success).toBe(false);
        expect(result.error).toContain("Unknown function");
      });
    });

    describe("path validation", () => {
      it("should reject path with traversal", () => {
        // Use raw path with .. to bypass path.join normalization
        const filePath = `${TEST_DIR}/../outside.txt`;

        const result = executeFileFunction("createFile", {
          path: filePath,
          content: "Should fail",
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain("Path not allowed");
      });

      it("should reject system paths", () => {
        const result = executeFileFunction("readFile", { path: "/etc/passwd" });

        expect(result.success).toBe(false);
        expect(result.error).toContain("Path not allowed");
      });

      it("should respect workingDirectory constraint", () => {
        const outsidePath = "/tmp/outside-working-dir.txt";

        const result = executeFileFunction(
          "createFile",
          { path: outsidePath, content: "Should fail" },
          TEST_DIR, // workingDirectory constraint
        );

        expect(result.success).toBe(false);
        expect(result.error).toContain("Path not allowed");
      });

      it("should allow path within workingDirectory", () => {
        const insidePath = path.join(TEST_DIR, "inside.txt");

        const result = executeFileFunction(
          "createFile",
          { path: insidePath, content: "Should succeed" },
          TEST_DIR, // workingDirectory constraint
        );

        expect(result.success).toBe(true);
      });
    });

    describe("relative path resolution", () => {
      it("should resolve relative path to workingDirectory for createFile", () => {
        // Gemini might pass a relative path like "test.txt"
        const result = executeFileFunction(
          "createFile",
          { path: "relative-test.txt", content: "Created with relative path" },
          TEST_DIR, // workingDirectory
        );

        expect(result.success).toBe(true);
        // File should be created in TEST_DIR, not process cwd
        const expectedPath = path.join(TEST_DIR, "relative-test.txt");
        expect(fs.existsSync(expectedPath)).toBe(true);
        expect(fs.readFileSync(expectedPath, "utf-8")).toBe("Created with relative path");
      });

      it("should resolve relative path to workingDirectory for listDir", () => {
        // Create a subdirectory first
        const subDir = path.join(TEST_DIR, "sub");
        fs.mkdirSync(subDir);
        fs.writeFileSync(path.join(subDir, "file.txt"), "content");

        // List using relative path
        const result = executeFileFunction("listDir", { path: "sub" }, TEST_DIR);

        expect(result.success).toBe(true);
        expect(result.items).toBeDefined();
        expect(result.items?.find((i) => i.name === "file.txt")).toBeDefined();
      });

      it("should resolve relative path to workingDirectory for readFile", () => {
        // Create a file first
        const filePath = path.join(TEST_DIR, "read-relative.txt");
        fs.writeFileSync(filePath, "Relative content", "utf-8");

        // Read using relative path
        const result = executeFileFunction("readFile", { path: "read-relative.txt" }, TEST_DIR);

        expect(result.success).toBe(true);
        expect(result.content).toBe("Relative content");
      });

      it("should resolve nested relative path", () => {
        const result = executeFileFunction(
          "createFile",
          { path: "nested/deep/file.txt", content: "Deep nested" },
          TEST_DIR,
        );

        expect(result.success).toBe(true);
        const expectedPath = path.join(TEST_DIR, "nested", "deep", "file.txt");
        expect(fs.existsSync(expectedPath)).toBe(true);
      });

      it("should handle dot-prefixed relative paths", () => {
        const result = executeFileFunction(
          "createFile",
          { path: "./dot-relative.txt", content: "Dot relative" },
          TEST_DIR,
        );

        expect(result.success).toBe(true);
        const expectedPath = path.join(TEST_DIR, "dot-relative.txt");
        expect(fs.existsSync(expectedPath)).toBe(true);
      });

      it("should still work with absolute paths within workingDirectory", () => {
        const absolutePath = path.join(TEST_DIR, "absolute.txt");

        const result = executeFileFunction(
          "createFile",
          { path: absolutePath, content: "Absolute path" },
          TEST_DIR,
        );

        expect(result.success).toBe(true);
        expect(fs.existsSync(absolutePath)).toBe(true);
      });

      it("should reject relative paths that would escape workingDirectory", () => {
        // Try to escape using parent directory reference
        const result = executeFileFunction(
          "createFile",
          { path: "../escape.txt", content: "Should fail" },
          TEST_DIR,
        );

        expect(result.success).toBe(false);
        expect(result.error).toContain("Path not allowed");
      });
    });
  });
});

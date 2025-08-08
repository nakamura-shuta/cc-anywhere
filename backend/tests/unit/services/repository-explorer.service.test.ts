import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { RepositoryExplorerService } from "../../../src/services/repository-explorer.service";
import { readdir, stat, readFile } from "fs/promises";
import { existsSync } from "fs";

// モックの設定
vi.mock("fs/promises");
vi.mock("fs");
vi.mock("../../../src/utils/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  },
}));

describe("RepositoryExplorerService", () => {
  let service: RepositoryExplorerService;

  beforeEach(() => {
    service = RepositoryExplorerService.getInstance();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getInstance", () => {
    it("should return singleton instance", () => {
      const instance1 = RepositoryExplorerService.getInstance();
      const instance2 = RepositoryExplorerService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe("getRepositoryConfig", () => {
    it("should return repository configuration from file", async () => {
      const mockConfig = {
        repositories: [{ name: "test-repo", path: "/path/to/repo" }],
      };

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFile).mockResolvedValue(JSON.stringify(mockConfig));

      const config = await service.getRepositoryConfig();
      expect(config).toEqual(mockConfig);
    });

    it("should return default configuration when file does not exist", async () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const config = await service.getRepositoryConfig();
      expect(config.repositories).toHaveLength(1);
      expect(config.repositories[0].name).toBe("cc-anywhere");
    });

    it("should handle JSON parse errors", async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFile).mockResolvedValue("invalid json");

      await expect(service.getRepositoryConfig()).rejects.toThrow();
    });
  });

  describe("getRepositoryPath", () => {
    it("should return absolute path for repository", async () => {
      const mockConfig = {
        repositories: [{ name: "test-repo", path: "/absolute/path" }],
      };

      vi.mocked(existsSync).mockImplementation((p) => {
        if (p === "/absolute/path") return true;
        return p.toString().includes("repositories.json");
      });
      vi.mocked(readFile).mockResolvedValue(JSON.stringify(mockConfig));

      const repoPath = await service.getRepositoryPath("test-repo");
      expect(repoPath).toBe("/absolute/path");
    });

    it("should handle relative paths", async () => {
      const mockConfig = {
        repositories: [{ name: "test-repo", path: "relative/path" }],
      };

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFile).mockResolvedValue(JSON.stringify(mockConfig));

      const repoPath = await service.getRepositoryPath("test-repo");
      expect(repoPath).toContain("relative/path");
    });

    it("should throw error for non-existent repository", async () => {
      const mockConfig = {
        repositories: [],
      };

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFile).mockResolvedValue(JSON.stringify(mockConfig));

      await expect(service.getRepositoryPath("non-existent")).rejects.toThrow(
        'Repository "non-existent" not found',
      );
    });

    it("should throw error if repository path does not exist", async () => {
      const mockConfig = {
        repositories: [{ name: "test-repo", path: "/non/existent/path" }],
      };

      vi.mocked(existsSync).mockImplementation((p) => {
        return p.toString().includes("repositories.json");
      });
      vi.mocked(readFile).mockResolvedValue(JSON.stringify(mockConfig));

      await expect(service.getRepositoryPath("test-repo")).rejects.toThrow(
        'Repository path "/non/existent/path" does not exist',
      );
    });
  });

  describe("getDirectoryTree", () => {
    it("should build directory tree structure", async () => {
      const mockConfig = {
        repositories: [{ name: "test-repo", path: "/test/repo" }],
      };

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFile).mockResolvedValue(JSON.stringify(mockConfig));

      // Mock stat for directory
      vi.mocked(stat).mockImplementation(async (p) => {
        const pathStr = p.toString();
        if (pathStr === "/test/repo") {
          return {
            isDirectory: () => true,
            isFile: () => false,
            size: 0,
            mtime: new Date("2024-01-01"),
          } as any;
        }
        if (pathStr === "/test/repo/file.txt") {
          return {
            isDirectory: () => false,
            isFile: () => true,
            size: 100,
            mtime: new Date("2024-01-01"),
          } as any;
        }
        if (pathStr === "/test/repo/subdir") {
          return {
            isDirectory: () => true,
            isFile: () => false,
            size: 0,
            mtime: new Date("2024-01-01"),
          } as any;
        }
        throw new Error("File not found");
      });

      // Mock readdir
      vi.mocked(readdir).mockImplementation(async (p) => {
        if (p.toString() === "/test/repo") {
          return ["file.txt", "subdir"] as any;
        }
        if (p.toString() === "/test/repo/subdir") {
          return [] as any;
        }
        return [] as any;
      });

      const tree = await service.getDirectoryTree("test-repo");

      expect(tree.name).toBe("test-repo");
      expect(tree.type).toBe("directory");
      expect(tree.children).toHaveLength(2);

      // Check if directories come before files
      expect(tree.children![0].name).toBe("subdir");
      expect(tree.children![0].type).toBe("directory");
      expect(tree.children![1].name).toBe("file.txt");
      expect(tree.children![1].type).toBe("file");
    });

    it("should prevent path traversal attacks", async () => {
      const mockConfig = {
        repositories: [{ name: "test-repo", path: "/test/repo" }],
      };

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFile).mockResolvedValue(JSON.stringify(mockConfig));

      await expect(service.getDirectoryTree("test-repo", "../../../etc")).rejects.toThrow(
        "Invalid path: Access denied",
      );
    });

    it("should handle inaccessible files gracefully", async () => {
      const mockConfig = {
        repositories: [{ name: "test-repo", path: "/test/repo" }],
      };

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFile).mockResolvedValue(JSON.stringify(mockConfig));

      vi.mocked(stat).mockImplementation(async (p) => {
        const pathStr = p.toString();
        if (pathStr === "/test/repo") {
          return {
            isDirectory: () => true,
            isFile: () => false,
            size: 0,
            mtime: new Date("2024-01-01"),
          } as any;
        }
        if (pathStr === "/test/repo/accessible.txt") {
          return {
            isDirectory: () => false,
            isFile: () => true,
            size: 100,
            mtime: new Date("2024-01-01"),
          } as any;
        }
        // Simulate permission error
        throw new Error("Permission denied");
      });

      vi.mocked(readdir).mockResolvedValue(["accessible.txt", "inaccessible.txt"] as any);

      const tree = await service.getDirectoryTree("test-repo");

      // Should only include accessible file
      expect(tree.children).toHaveLength(1);
      expect(tree.children![0].name).toBe("accessible.txt");
    });
  });

  describe("getFileContent", () => {
    it("should return text file content", async () => {
      const mockConfig = {
        repositories: [{ name: "test-repo", path: "/test/repo" }],
      };
      const mockContent = 'console.log("Hello World");';

      vi.mocked(existsSync).mockImplementation(() => true);
      vi.mocked(readFile).mockImplementation(async (filePath, encoding) => {
        const pathStr = String(filePath);
        if (pathStr.includes("repositories.json")) {
          return JSON.stringify(mockConfig);
        }
        if (encoding === "utf-8") {
          return mockContent;
        }
        return Buffer.from(mockContent);
      });

      vi.mocked(stat).mockResolvedValue({
        isDirectory: () => false,
        isFile: () => true,
        size: mockContent.length,
        mtime: new Date("2024-01-01"),
      } as any);

      const content = await service.getFileContent("test-repo", "script.js");

      expect(content.content).toBe(mockContent);
      expect(content.encoding).toBe("utf8");
      expect(content.language).toBe("javascript");
      expect(content.mimeType).toBe("text/javascript");
    });

    it("should return binary file content as base64", async () => {
      const mockConfig = {
        repositories: [{ name: "test-repo", path: "/test/repo" }],
      };
      const binaryData = Buffer.from([0xff, 0xd8, 0xff, 0xe0]); // JPEG header

      vi.mocked(existsSync).mockImplementation(() => true);
      vi.mocked(readFile).mockImplementation(async (filePath, encoding) => {
        const pathStr = String(filePath);
        if (pathStr.includes("repositories.json")) {
          return JSON.stringify(mockConfig);
        }
        if (encoding === "utf-8") {
          throw new Error("Not a text file");
        }
        return binaryData;
      });

      vi.mocked(stat).mockResolvedValue({
        isDirectory: () => false,
        isFile: () => true,
        size: binaryData.length,
        mtime: new Date("2024-01-01"),
      } as any);

      const content = await service.getFileContent("test-repo", "image.jpg");

      expect(content.encoding).toBe("base64");
      expect(content.content).toBe(binaryData.toString("base64"));
      expect(content.mimeType).toBe("image/jpeg");
    });

    it("should throw error for non-existent file", async () => {
      const mockConfig = {
        repositories: [{ name: "test-repo", path: "/test/repo" }],
      };

      vi.mocked(existsSync).mockImplementation((p) => {
        if (p.toString().includes("repositories.json")) return true;
        if (p.toString() === "/test/repo") return true;
        return false;
      });
      vi.mocked(readFile).mockResolvedValue(JSON.stringify(mockConfig));

      await expect(service.getFileContent("test-repo", "non-existent.txt")).rejects.toThrow(
        "File not found: non-existent.txt",
      );
    });

    it("should throw error for directories", async () => {
      const mockConfig = {
        repositories: [{ name: "test-repo", path: "/test/repo" }],
      };

      vi.mocked(existsSync).mockImplementation(() => true);
      vi.mocked(readFile).mockResolvedValue(JSON.stringify(mockConfig));
      vi.mocked(stat).mockResolvedValue({
        isDirectory: () => true,
        isFile: () => false,
        size: 0,
        mtime: new Date("2024-01-01"),
      } as any);

      await expect(service.getFileContent("test-repo", "some-dir")).rejects.toThrow(
        "Path is a directory: some-dir",
      );
    });

    it("should throw error for files exceeding size limit", async () => {
      const mockConfig = {
        repositories: [{ name: "test-repo", path: "/test/repo" }],
      };

      vi.mocked(existsSync).mockImplementation(() => true);
      vi.mocked(readFile).mockResolvedValue(JSON.stringify(mockConfig));
      vi.mocked(stat).mockResolvedValue({
        isDirectory: () => false,
        isFile: () => true,
        size: 11 * 1024 * 1024, // 11MB
        mtime: new Date("2024-01-01"),
      } as any);

      await expect(service.getFileContent("test-repo", "large-file.bin")).rejects.toThrow(
        /File too large/,
      );
    });

    it("should prevent path traversal attacks", async () => {
      const mockConfig = {
        repositories: [{ name: "test-repo", path: "/test/repo" }],
      };

      vi.mocked(existsSync).mockImplementation(() => true);
      vi.mocked(readFile).mockResolvedValue(JSON.stringify(mockConfig));

      await expect(service.getFileContent("test-repo", "../../../etc/passwd")).rejects.toThrow(
        "Invalid path: Access denied",
      );
    });

    it("should detect programming languages correctly", async () => {
      const mockConfig = {
        repositories: [{ name: "test-repo", path: "/test/repo" }],
      };

      vi.mocked(existsSync).mockImplementation(() => true);
      vi.mocked(readFile).mockImplementation(async (filePath) => {
        const pathStr = String(filePath);
        if (pathStr.includes("repositories.json")) {
          return JSON.stringify(mockConfig);
        }
        return "test content";
      });
      vi.mocked(stat).mockResolvedValue({
        isDirectory: () => false,
        isFile: () => true,
        size: 100,
        mtime: new Date("2024-01-01"),
      } as any);

      const testCases = [
        { file: "test.ts", language: "typescript" },
        { file: "test.py", language: "python" },
        { file: "test.java", language: "java" },
        { file: "test.rs", language: "rust" },
        { file: "test.go", language: "go" },
        { file: "Dockerfile", language: "dockerfile" },
        { file: "Makefile", language: "makefile" },
        { file: "test.svelte", language: "svelte" },
        { file: "test.vue", language: "vue" },
        { file: "test.jsx", language: "javascript" },
        { file: "test.tsx", language: "typescript" },
      ];

      for (const { file, language } of testCases) {
        const content = await service.getFileContent("test-repo", file);
        expect(content.language).toBe(language);
      }
    });
  });
});

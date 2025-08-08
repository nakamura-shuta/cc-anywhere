import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { createApp } from "../../../../src/server/app";
import { repositoryExplorerService } from "../../../../src/services/repository-explorer.service";

// サービスのモック
vi.mock("../../../../src/services/repository-explorer.service", () => ({
  repositoryExplorerService: {
    getDirectoryTree: vi.fn(),
    getFileContent: vi.fn(),
  },
}));

describe("Repository Explorer Routes", () => {
  let app: FastifyInstance;
  const testApiKey = process.env.API_KEY || "test-key";

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await createApp({ logger: false });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  describe("GET /api/repositories/:name/tree", () => {
    it("should return directory tree for repository", async () => {
      const mockTree = {
        name: "test-repo",
        path: "",
        type: "directory" as const,
        size: 0,
        modifiedAt: "2024-01-01T00:00:00.000Z",
        children: [
          {
            name: "src",
            path: "src",
            type: "directory" as const,
            children: [],
          },
          {
            name: "README.md",
            path: "README.md",
            type: "file" as const,
            size: 1234,
          },
        ],
      };

      vi.mocked(repositoryExplorerService.getDirectoryTree).mockResolvedValue(mockTree);

      const response = await app.inject({
        method: "GET",
        url: "/api/repositories/test-repo/tree",
        headers: {
          "X-API-Key": testApiKey,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual(mockTree);
      expect(repositoryExplorerService.getDirectoryTree).toHaveBeenCalledWith("test-repo", "");
    });

    it("should return directory tree for subdirectory", async () => {
      const mockTree = {
        name: "src",
        path: "src",
        type: "directory" as const,
        children: [],
      };

      vi.mocked(repositoryExplorerService.getDirectoryTree).mockResolvedValue(mockTree);

      const response = await app.inject({
        method: "GET",
        url: "/api/repositories/test-repo/tree?path=src",
        headers: {
          "X-API-Key": testApiKey,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(repositoryExplorerService.getDirectoryTree).toHaveBeenCalledWith("test-repo", "src");
    });

    it("should return 404 for non-existent repository", async () => {
      vi.mocked(repositoryExplorerService.getDirectoryTree).mockRejectedValue(
        new Error('Repository "non-existent" not found'),
      );

      const response = await app.inject({
        method: "GET",
        url: "/api/repositories/non-existent/tree",
        headers: {
          "X-API-Key": testApiKey,
        },
      });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.body)).toEqual({
        error: 'Repository "non-existent" not found',
      });
    });

    it("should return 400 for invalid path", async () => {
      vi.mocked(repositoryExplorerService.getDirectoryTree).mockRejectedValue(
        new Error("Invalid path: Access denied"),
      );

      const response = await app.inject({
        method: "GET",
        url: "/api/repositories/test-repo/tree?path=../../../etc",
        headers: {
          "X-API-Key": testApiKey,
        },
      });

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body)).toEqual({
        error: "Invalid path: Access denied",
      });
    });

    it("should return 401 without API key", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/repositories/test-repo/tree",
      });

      expect(response.statusCode).toBe(401);
    });

    it("should return 500 for unexpected errors", async () => {
      vi.mocked(repositoryExplorerService.getDirectoryTree).mockRejectedValue(
        new Error("Unexpected error"),
      );

      const response = await app.inject({
        method: "GET",
        url: "/api/repositories/test-repo/tree",
        headers: {
          "X-API-Key": testApiKey,
        },
      });

      expect(response.statusCode).toBe(500);
      expect(JSON.parse(response.body)).toEqual({
        error: "Failed to retrieve repository tree",
      });
    });
  });

  describe("GET /api/repositories/:name/file", () => {
    it("should return file content", async () => {
      const mockContent = {
        path: "src/index.ts",
        content: 'console.log("Hello");',
        encoding: "utf8" as const,
        size: 21,
        mimeType: "text/plain",
        language: "typescript",
        modifiedAt: "2024-01-01T00:00:00.000Z",
      };

      vi.mocked(repositoryExplorerService.getFileContent).mockResolvedValue(mockContent);

      const response = await app.inject({
        method: "GET",
        url: "/api/repositories/test-repo/file?path=src/index.ts",
        headers: {
          "X-API-Key": testApiKey,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual(mockContent);
      expect(repositoryExplorerService.getFileContent).toHaveBeenCalledWith(
        "test-repo",
        "src/index.ts",
      );
    });

    it("should return binary file content as base64", async () => {
      const mockContent = {
        path: "image.png",
        content:
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
        encoding: "base64" as const,
        size: 100,
        mimeType: "image/png",
        modifiedAt: "2024-01-01T00:00:00.000Z",
      };

      vi.mocked(repositoryExplorerService.getFileContent).mockResolvedValue(mockContent);

      const response = await app.inject({
        method: "GET",
        url: "/api/repositories/test-repo/file?path=image.png",
        headers: {
          "X-API-Key": testApiKey,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual(mockContent);
    });

    it("should return 400 when path is missing", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/repositories/test-repo/file",
        headers: {
          "X-API-Key": testApiKey,
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it("should return 404 for non-existent file", async () => {
      vi.mocked(repositoryExplorerService.getFileContent).mockRejectedValue(
        new Error("File not found: non-existent.txt"),
      );

      const response = await app.inject({
        method: "GET",
        url: "/api/repositories/test-repo/file?path=non-existent.txt",
        headers: {
          "X-API-Key": testApiKey,
        },
      });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.body)).toEqual({
        error: "File not found: non-existent.txt",
      });
    });

    it("should return 400 for invalid path", async () => {
      vi.mocked(repositoryExplorerService.getFileContent).mockRejectedValue(
        new Error("Invalid path: Access denied"),
      );

      const response = await app.inject({
        method: "GET",
        url: "/api/repositories/test-repo/file?path=../../../etc/passwd",
        headers: {
          "X-API-Key": testApiKey,
        },
      });

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body)).toEqual({
        error: "Invalid path: Access denied",
      });
    });

    it("should return 400 when path is a directory", async () => {
      vi.mocked(repositoryExplorerService.getFileContent).mockRejectedValue(
        new Error("Path is a directory: src"),
      );

      const response = await app.inject({
        method: "GET",
        url: "/api/repositories/test-repo/file?path=src",
        headers: {
          "X-API-Key": testApiKey,
        },
      });

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body)).toEqual({
        error: "Path is a directory: src",
      });
    });

    it("should return 413 for files too large", async () => {
      vi.mocked(repositoryExplorerService.getFileContent).mockRejectedValue(
        new Error("File too large: 11534336 bytes (max: 10485760 bytes)"),
      );

      const response = await app.inject({
        method: "GET",
        url: "/api/repositories/test-repo/file?path=large-file.bin",
        headers: {
          "X-API-Key": testApiKey,
        },
      });

      expect(response.statusCode).toBe(413);
      expect(JSON.parse(response.body)).toEqual({
        error: "File too large: 11534336 bytes (max: 10485760 bytes)",
      });
    });

    it("should return 401 without API key", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/repositories/test-repo/file?path=test.txt",
      });

      expect(response.statusCode).toBe(401);
    });

    it("should return 500 for unexpected errors", async () => {
      vi.mocked(repositoryExplorerService.getFileContent).mockRejectedValue(
        new Error("Unexpected error"),
      );

      const response = await app.inject({
        method: "GET",
        url: "/api/repositories/test-repo/file?path=test.txt",
        headers: {
          "X-API-Key": testApiKey,
        },
      });

      expect(response.statusCode).toBe(500);
      expect(JSON.parse(response.body)).toEqual({
        error: "Failed to retrieve file content",
      });
    });
  });
});

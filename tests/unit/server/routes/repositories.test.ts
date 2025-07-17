import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { createApp } from "../../../../src/server/app";
import { writeFileSync, unlinkSync } from "fs";
import { join } from "path";

describe("Repository Routes", () => {
  let app: FastifyInstance;
  const testApiKey = process.env.API_KEY || "hoge";
  const testConfigPath = join(process.cwd(), "config", "repositories.test.json");

  const testConfig = {
    repositories: [
      {
        name: "test-repo-1",
        path: "/test/path/1",
      },
      {
        name: "test-repo-2",
        path: "/test/path/2",
      },
    ],
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await createApp({ logger: false });
    // テスト用の設定ファイルを作成
    writeFileSync(testConfigPath, JSON.stringify(testConfig));
  });

  afterEach(async () => {
    await app.close();
    // テスト用設定ファイルを削除
    try {
      unlinkSync(testConfigPath);
    } catch {
      // ファイルが存在しない場合は無視
    }
  });

  describe("GET /api/repositories", () => {
    it("should return repositories list from config file", async () => {
      // 実際のファイルパスをモック
      vi.spyOn(process, "cwd").mockReturnValue(process.cwd());

      const response = await app.inject({
        method: "GET",
        url: "/api/repositories",
        headers: {
          "X-API-Key": testApiKey,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.repositories).toBeDefined();
      expect(Array.isArray(body.repositories)).toBe(true);
    });

    it("should return default value when config file is missing", async () => {
      // 存在しないパスを参照するようにモック
      vi.spyOn(process, "cwd").mockReturnValue("/non-existent-path");

      const response = await app.inject({
        method: "GET",
        url: "/api/repositories",
        headers: {
          "X-API-Key": testApiKey,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.repositories).toBeDefined();
      expect(body.repositories.length).toBe(1);
      expect(body.repositories[0].name).toBe("cc-anywhere");
    });
  });
});

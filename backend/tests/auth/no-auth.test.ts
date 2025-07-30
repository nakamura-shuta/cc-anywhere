import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createApp } from "../../src/server/app";
import type { FastifyInstance } from "fastify";

describe("No Authentication Tests", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    // 全ての認証を無効化
    process.env.QR_AUTH_ENABLED = "false";
    process.env.QR_AUTH_TOKEN = "";
    process.env.API_KEY = "";

    // アプリケーションを作成
    app = await createApp({ logger: false });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe("認証状態確認", () => {
    it("/api/auth/statusは認証無効を返す", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/auth/status",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.enabled).toBe(false);
      expect(body.requiresAuth).toBe(false);
    });
  });

  describe("認証検証", () => {
    it("/api/auth/verifyは認証無効を返す", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/auth/verify?auth_token=any-token",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.valid).toBe(true);
      expect(body.message).toBe("QR auth is disabled");
    });
  });

  describe("保護されたエンドポイント", () => {
    it("認証なしでも/api/tasksにアクセス可能", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/tasks",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.tasks).toBeDefined();
    });

    it("認証なしでも/api/queueにアクセス可能", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/queue/stats",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body).toBeDefined();
    });

    it("認証なしでも/api/settingsにアクセス可能", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/settings",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body).toBeDefined();
      // settingsエンドポイントは何らかの設定情報を返す
      expect(typeof body).toBe("object");
    });
  });
});

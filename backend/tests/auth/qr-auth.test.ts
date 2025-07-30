import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createApp } from "../../src/server/app";
import type { FastifyInstance } from "fastify";

describe("QR Authentication Tests", () => {
  let app: FastifyInstance;
  const testToken = "test-auth-token-12345";

  beforeAll(async () => {
    // QR認証有効の環境変数を設定
    process.env.QR_AUTH_ENABLED = "true";
    process.env.QR_AUTH_TOKEN = testToken;
    process.env.API_KEY = ""; // API KEY認証は無効化

    // アプリケーションを作成
    app = await createApp({ logger: false });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe("認証状態確認", () => {
    it("/api/auth/statusは認証なしでアクセス可能", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/auth/status",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.enabled).toBe(true);
      expect(body.requiresAuth).toBe(true);
    });
  });

  describe("認証検証", () => {
    it("正しいトークンで/api/auth/verifyにアクセスすると成功", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/auth/verify?auth_token=${testToken}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.valid).toBe(true);
      expect(body.message).toBe("Authentication successful");
    });

    it("間違ったトークンで/api/auth/verifyにアクセスすると失敗", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/auth/verify?auth_token=wrong-token",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.valid).toBe(false);
      expect(body.message).toBe("Invalid token");
    });
  });

  describe("保護されたエンドポイント", () => {
    it("トークンなしでアクセスすると401エラー", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/tasks",
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload);
      expect(body.error.code).toBe("UNAUTHORIZED");
    });

    it("ヘッダーに正しいトークンを含めてアクセスすると成功", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/tasks",
        headers: {
          "X-Auth-Token": testToken,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.tasks).toBeDefined();
    });

    it("クエリパラメータに正しいトークンを含めてアクセスすると成功", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/tasks?auth_token=${testToken}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.tasks).toBeDefined();
    });

    it("間違ったトークンでアクセスすると401エラー", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/tasks",
        headers: {
          "X-Auth-Token": "wrong-token",
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload);
      expect(body.error.code).toBe("UNAUTHORIZED");
    });
  });
});

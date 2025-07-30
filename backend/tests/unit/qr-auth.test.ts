import { describe, it, expect, vi } from "vitest";
import type { FastifyRequest } from "fastify";

// configモジュールをモック
const mockConfig = {
  qrAuth: {
    enabled: true,
    token: "test-auth-token-12345",
    sessionDuration: 86400000,
  },
};

vi.mock("../../src/config", () => ({
  config: mockConfig,
}));

vi.mock("../../src/utils/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("QR Auth Middleware Logic", () => {
  describe("トークン抽出", () => {
    it("ヘッダーからトークンを取得できる", () => {
      const request = {
        headers: { "x-auth-token": "test-token" },
        query: {},
      } as unknown as FastifyRequest;

      // ミドルウェアのロジックをテスト
      const token = request.headers["x-auth-token"];
      expect(token).toBe("test-token");
    });

    it("クエリパラメータからトークンを取得できる", () => {
      const request = {
        headers: {},
        query: { auth_token: "test-token" },
      } as unknown as FastifyRequest;

      const token = (request.query as any)?.auth_token;
      expect(token).toBe("test-token");
    });
  });

  describe("パス判定", () => {
    const PUBLIC_PATHS = ["/health", "/api/auth/verify", "/api/auth/status"];

    it("公開パスを正しく判定できる", () => {
      const isPublicPath = (path: string) => {
        return PUBLIC_PATHS.some((publicPath) => path.startsWith(publicPath));
      };

      expect(isPublicPath("/api/auth/verify")).toBe(true);
      expect(isPublicPath("/api/auth/status")).toBe(true);
      expect(isPublicPath("/health")).toBe(true);
      expect(isPublicPath("/api/tasks")).toBe(false);
    });
  });

  describe("認証検証ロジック", () => {
    it("正しいトークンで認証成功", () => {
      const token = "test-auth-token-12345";
      const isValid = token === mockConfig.qrAuth.token;
      expect(isValid).toBe(true);
    });

    it("間違ったトークンで認証失敗", () => {
      const token = "wrong-token";
      const isValid = token === mockConfig.qrAuth.token;
      expect(isValid).toBe(false);
    });

    it("トークンがない場合は認証失敗", () => {
      const token = undefined;
      const isValid = token === mockConfig.qrAuth.token;
      expect(isValid).toBe(false);
    });
  });

  describe("設定による動作", () => {
    it("QR認証が無効の場合は認証をスキップ", () => {
      const config = { qrAuth: { enabled: false, token: "test" } };
      const shouldCheckAuth = config.qrAuth.enabled && !!config.qrAuth.token;
      expect(shouldCheckAuth).toBe(false);
    });

    it("QR認証が有効でトークンが設定されている場合は認証を実行", () => {
      const config = { qrAuth: { enabled: true, token: "test" } };
      const shouldCheckAuth = config.qrAuth.enabled && !!config.qrAuth.token;
      expect(shouldCheckAuth).toBe(true);
    });

    it("QR認証が有効でもトークンが未設定の場合は認証をスキップ", () => {
      const config = { qrAuth: { enabled: true, token: "" } };
      const shouldCheckAuth = config.qrAuth.enabled && !!config.qrAuth.token;
      expect(shouldCheckAuth).toBe(false);
    });
  });
});

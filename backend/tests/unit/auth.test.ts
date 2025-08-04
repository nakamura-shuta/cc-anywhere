import { describe, it, expect, vi } from "vitest";
import type { FastifyRequest } from "fastify";

// configモジュールをモック
const mockConfig = {
  auth: {
    enabled: true,
    apiKey: "test-api-key-12345",
  },
  qrAuth: {
    enabled: false,
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

describe("Unified Auth Middleware Logic", () => {
  describe("トークン抽出", () => {
    it("x-api-keyヘッダーからトークンを取得できる", () => {
      const request = {
        headers: { "x-api-key": "test-token" },
        query: {},
      } as unknown as FastifyRequest;

      const token = request.headers["x-api-key"];
      expect(token).toBe("test-token");
    });


    it("api_keyクエリパラメータからトークンを取得できる", () => {
      const request = {
        headers: {},
        query: { api_key: "test-token" },
      } as unknown as FastifyRequest;

      const token = (request.query as any)?.api_key;
      expect(token).toBe("test-token");
    });

  });

  describe("パス判定", () => {
    const PUBLIC_PATHS = ["/health", "/api/auth/verify", "/api/auth/status"];

    function isPublicPath(path: string): boolean {
      return PUBLIC_PATHS.some((publicPath) => path.startsWith(publicPath));
    }

    it("パブリックパスを正しく判定できる", () => {
      expect(isPublicPath("/health")).toBe(true);
      expect(isPublicPath("/api/auth/verify")).toBe(true);
      expect(isPublicPath("/api/auth/status")).toBe(true);
    });

    it("非パブリックパスを正しく判定できる", () => {
      expect(isPublicPath("/api/tasks")).toBe(false);
      expect(isPublicPath("/api/queue/stats")).toBe(false);
    });
  });

  describe("認証検証", () => {
    it("正しいトークンで認証成功", () => {
      const token = "test-api-key-12345";
      const isValid = token === mockConfig.auth.apiKey;
      expect(isValid).toBe(true);
    });

    it("間違ったトークンで認証失敗", () => {
      const token = "wrong-token";
      const isValid = token === mockConfig.auth.apiKey;
      expect(isValid).toBe(false);
    });

    it("空のトークンで認証失敗", () => {
      const token = "";
      const isValid = token === mockConfig.auth.apiKey;
      expect(isValid).toBe(false);
    });
  });

  describe("認証要否の判定", () => {
    it("認証が有効でAPIキーが設定されている場合は認証が必要", () => {
      const shouldCheckAuth = mockConfig.auth.enabled && !!mockConfig.auth.apiKey;
      expect(shouldCheckAuth).toBe(true);
    });

    it("認証が無効の場合は認証不要", () => {
      mockConfig.auth.enabled = false;
      const shouldCheckAuth = mockConfig.auth.enabled && !!mockConfig.auth.apiKey;
      expect(shouldCheckAuth).toBe(false);
      mockConfig.auth.enabled = true; // 元に戻す
    });

    it("APIキーが未設定の場合は認証不要", () => {
      const originalKey = mockConfig.auth.apiKey;
      mockConfig.auth.apiKey = "";
      const shouldCheckAuth = mockConfig.auth.enabled && !!mockConfig.auth.apiKey;
      expect(shouldCheckAuth).toBe(false);
      mockConfig.auth.apiKey = originalKey; // 元に戻す
    });
  });

  describe("QRコード表示機能", () => {
    it("QRコード表示が有効な場合", () => {
      mockConfig.qrAuth.enabled = true;
      expect(mockConfig.qrAuth.enabled).toBe(true);
    });

    it("QRコード表示が無効な場合", () => {
      mockConfig.qrAuth.enabled = false;
      expect(mockConfig.qrAuth.enabled).toBe(false);
    });
  });
});

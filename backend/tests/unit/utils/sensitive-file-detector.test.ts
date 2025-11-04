import { describe, it, expect } from "vitest";
import { SensitiveFileDetector } from "../../../src/utils/sensitive-file-detector.js";

describe("SensitiveFileDetector", () => {
  describe("isSensitiveFile", () => {
    it("should detect .env files", () => {
      expect(SensitiveFileDetector.isSensitiveFile(".env")).toBe(true);
      expect(SensitiveFileDetector.isSensitiveFile(".env.local")).toBe(true);
      expect(SensitiveFileDetector.isSensitiveFile(".env.production")).toBe(true);
      expect(SensitiveFileDetector.isSensitiveFile("config/.env")).toBe(true);
    });

    it("should detect key files", () => {
      expect(SensitiveFileDetector.isSensitiveFile("private.key")).toBe(true);
      expect(SensitiveFileDetector.isSensitiveFile("cert.pem")).toBe(true);
      expect(SensitiveFileDetector.isSensitiveFile("certificate.p12")).toBe(true);
      expect(SensitiveFileDetector.isSensitiveFile("key.pfx")).toBe(true);
    });

    it("should detect SSH keys", () => {
      expect(SensitiveFileDetector.isSensitiveFile("id_rsa")).toBe(true);
      expect(SensitiveFileDetector.isSensitiveFile("id_dsa")).toBe(true);
      expect(SensitiveFileDetector.isSensitiveFile("id_ecdsa")).toBe(true);
      expect(SensitiveFileDetector.isSensitiveFile("id_ed25519")).toBe(true);
      expect(SensitiveFileDetector.isSensitiveFile("id_rsa.pub")).toBe(true);
      expect(SensitiveFileDetector.isSensitiveFile("authorized_keys")).toBe(true);
      expect(SensitiveFileDetector.isSensitiveFile("known_hosts")).toBe(true);
    });

    it("should detect AWS credentials", () => {
      expect(SensitiveFileDetector.isSensitiveFile(".aws/credentials")).toBe(true);
      expect(SensitiveFileDetector.isSensitiveFile(".aws/config")).toBe(true);
    });

    it("should detect credential files", () => {
      expect(SensitiveFileDetector.isSensitiveFile("credentials.json")).toBe(true);
      expect(SensitiveFileDetector.isSensitiveFile("aws-credentials.txt")).toBe(true);
      expect(SensitiveFileDetector.isSensitiveFile("db-secrets.yml")).toBe(true);
      expect(SensitiveFileDetector.isSensitiveFile("api-password.conf")).toBe(true);
    });

    it("should detect token files", () => {
      expect(SensitiveFileDetector.isSensitiveFile("access-token.txt")).toBe(true);
      expect(SensitiveFileDetector.isSensitiveFile("github-token")).toBe(true);
      expect(SensitiveFileDetector.isSensitiveFile("api-key.json")).toBe(true);
      expect(SensitiveFileDetector.isSensitiveFile("slack_api_key")).toBe(true);
    });

    it("should detect git config", () => {
      expect(SensitiveFileDetector.isSensitiveFile(".git/config")).toBe(true);
    });

    it("should NOT detect normal files", () => {
      expect(SensitiveFileDetector.isSensitiveFile("README.md")).toBe(false);
      expect(SensitiveFileDetector.isSensitiveFile("package.json")).toBe(false);
      expect(SensitiveFileDetector.isSensitiveFile("src/index.ts")).toBe(false);
      expect(SensitiveFileDetector.isSensitiveFile("test.txt")).toBe(false);
    });

    it("should be case-insensitive", () => {
      expect(SensitiveFileDetector.isSensitiveFile("CREDENTIALS.json")).toBe(true);
      expect(SensitiveFileDetector.isSensitiveFile("API-KEY.txt")).toBe(true);
    });
  });

  describe("sanitizeContent", () => {
    it("should return null for sensitive files", () => {
      const content = "SECRET_KEY=abc123";
      expect(SensitiveFileDetector.sanitizeContent(content, ".env")).toBeNull();
      expect(SensitiveFileDetector.sanitizeContent(content, "private.key")).toBeNull();
    });

    it("should return original content for normal files", () => {
      const content = "console.log('hello')";
      expect(SensitiveFileDetector.sanitizeContent(content, "index.js")).toBe(content);
      expect(SensitiveFileDetector.sanitizeContent(content, "README.md")).toBe(content);
    });
  });

  describe("getSafePathForLogging", () => {
    it("should redact sensitive file paths", () => {
      expect(SensitiveFileDetector.getSafePathForLogging("/path/to/.env")).toBe(
        "/path/to/[REDACTED]",
      );
      expect(SensitiveFileDetector.getSafePathForLogging("/home/user/private.key")).toBe(
        "/home/user/[REDACTED].key",
      );
      expect(SensitiveFileDetector.getSafePathForLogging("credentials.json")).toBe(
        ".[REDACTED].json",
      );
    });

    it("should not redact normal file paths", () => {
      expect(SensitiveFileDetector.getSafePathForLogging("/path/to/README.md")).toBe(
        "/path/to/README.md",
      );
      expect(SensitiveFileDetector.getSafePathForLogging("src/index.ts")).toBe("src/index.ts");
    });
  });

  describe("addPattern", () => {
    it("should allow adding custom patterns", () => {
      // カスタムパターンを追加
      SensitiveFileDetector.addPattern("*.custom-secret");

      // カスタムパターンで検出されることを確認
      expect(SensitiveFileDetector.isSensitiveFile("my-file.custom-secret")).toBe(true);
    });
  });
});

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { PathValidator, PathValidationError } from "../../../src/utils/path-validator.js";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { config } from "../../../src/config/index.js";

describe("PathValidator", () => {
  let tempDir: string;

  beforeEach(async () => {
    // 一時ディレクトリ作成
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "path-validator-test-"));

    // テスト用にホワイトリストチェックを無効化（テスト環境用）
    vi.spyOn(config, "security", "get").mockReturnValue({
      allowedWorkingDirectories: [],
      strictPathValidation: true,
      requireWhitelist: false, // テスト環境ではホワイトリスト不要
    });
  });

  afterEach(async () => {
    // クリーンアップ
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe("validateWorkingDirectory", () => {
    it("should accept valid directory path", async () => {
      const validPath = await PathValidator.validateWorkingDirectory(tempDir);
      // シンボリックリンク解決後の実際のパスと比較
      const expectedPath = await fs.realpath(tempDir);
      expect(validPath).toBe(expectedPath);
    });

    it("should reject non-existent directories", async () => {
      await expect(
        PathValidator.validateWorkingDirectory("/nonexistent/directory"),
      ).rejects.toThrow(PathValidationError);
    });

    it("should reject file paths (not directories)", async () => {
      const filePath = path.join(tempDir, "test.txt");
      await fs.writeFile(filePath, "test");
      await expect(PathValidator.validateWorkingDirectory(filePath)).rejects.toThrow(
        PathValidationError,
      );
    });

    it("should reject paths with similar prefix but different directory", async () => {
      // 🔴 重要: /home/app/project と /home/app/project-malicious を区別
      const allowedDir = path.join(tempDir, "project");
      const maliciousDir = path.join(tempDir, "project-malicious");
      await fs.mkdir(allowedDir);
      await fs.mkdir(maliciousDir);

      // このテストケースだけホワイトリストを有効にする
      // PathValidatorは内部でシンボリックリンクを解決して再検証するため、
      // ホワイトリストには両方のパス（シンボリックリンクと実際のパス）を含める
      const resolvedAllowedPath = path.resolve(allowedDir);
      const realAllowedPath = await fs.realpath(allowedDir);
      vi.spyOn(config, "security", "get").mockReturnValue({
        allowedWorkingDirectories: [resolvedAllowedPath, realAllowedPath],
        strictPathValidation: true,
        requireWhitelist: true, // ホワイトリストを有効化
      });

      // allowedDir is valid
      const validPath = await PathValidator.validateWorkingDirectory(allowedDir);
      const expectedPath = await fs.realpath(allowedDir);
      expect(validPath).toBe(expectedPath);

      // maliciousDir should be rejected (not in whitelist)
      await expect(PathValidator.validateWorkingDirectory(maliciousDir)).rejects.toThrow(
        PathValidationError,
      );
    });

    it("should block system directories in strict mode", async () => {
      // config.security.strictPathValidation = true の場合
      await expect(PathValidator.validateWorkingDirectory("/etc")).rejects.toThrow(
        PathValidationError,
      );

      await expect(PathValidator.validateWorkingDirectory("/root")).rejects.toThrow(
        PathValidationError,
      );
    });

    it("should not block paths with similar prefix to system directories", async () => {
      // 🔴 重要: /tmp/etc_link のような類似パスは許可すべき
      const similarDir = path.join(tempDir, "etc_link");
      await fs.mkdir(similarDir);

      // strictPathValidation = true でも、/etc そのものではないので許可される
      const validPath = await PathValidator.validateWorkingDirectory(similarDir);
      const expectedPath = await fs.realpath(similarDir);
      expect(validPath).toBe(expectedPath);
    });

    it("should handle symbolic links correctly", async () => {
      const targetDir = path.join(tempDir, "target");
      const linkDir = path.join(tempDir, "link");
      await fs.mkdir(targetDir);
      await fs.symlink(targetDir, linkDir);

      const validPath = await PathValidator.validateWorkingDirectory(linkDir);
      // シンボリックリンクは解決されてtargetDirを返す
      const expectedPath = await fs.realpath(targetDir);
      expect(validPath).toBe(expectedPath);
    });
  });

  describe("isSafeSubdirectory", () => {
    it("should return true for valid subdirectory", () => {
      const result = PathValidator.isSafeSubdirectory(
        "/home/user/project",
        "/home/user/project/src",
      );
      expect(result).toBe(true);
    });

    it("should return false for path traversal", () => {
      const result = PathValidator.isSafeSubdirectory(
        "/home/user/project",
        "/home/user/project/../other",
      );
      expect(result).toBe(false);
    });

    it("should return false for paths with similar prefix", () => {
      // 🔴 重要: /home/user/project と /home/user/project-malicious を区別
      const result = PathValidator.isSafeSubdirectory(
        "/home/user/project",
        "/home/user/project-malicious",
      );
      expect(result).toBe(false);
    });

    it("should return true for same directory", () => {
      const result = PathValidator.isSafeSubdirectory("/home/user/project", "/home/user/project");
      expect(result).toBe(true);
    });
  });

  describe("isInHomeDirectory", () => {
    it("should return true for paths in home directory", () => {
      const homeDir = process.env.HOME || process.env.USERPROFILE || "";
      const testPath = path.join(homeDir, "test");
      const result = PathValidator.isInHomeDirectory(testPath);
      expect(result).toBe(true);
    });

    it("should return false for paths outside home directory", () => {
      const result = PathValidator.isInHomeDirectory("/tmp/test");
      expect(result).toBe(false);
    });
  });
});

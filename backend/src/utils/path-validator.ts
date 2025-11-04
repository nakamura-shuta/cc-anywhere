import path from "path";
import fs from "fs/promises";
import { config } from "../config/index.js";

export class PathValidationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly attemptedPath: string,
  ) {
    super(message);
    this.name = "PathValidationError";
  }
}

export class PathValidator {
  /**
   * 作業ディレクトリの安全性を検証
   * @throws {PathValidationError} 検証失敗時
   */
  static async validateWorkingDirectory(workingDirectory: string): Promise<string> {
    // 1. パス正規化
    const normalizedPath = path.resolve(workingDirectory);

    // 2. ホワイトリストチェック（必須または設定されている場合）
    if (config.security.requireWhitelist && config.security.allowedWorkingDirectories.length > 0) {
      const isAllowed = config.security.allowedWorkingDirectories.some((allowedDir) => {
        // 🔴 安全な判定: path.relative を使用
        // normalizedPath が allowedDir のサブディレクトリであることを確認
        const relativePath = path.relative(allowedDir, normalizedPath);

        // 相対パスが空（同じディレクトリ）または
        // .. を含まず、絶対パスでもない場合に許可
        return (
          relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath))
        );
      });

      if (!isAllowed) {
        throw new PathValidationError(
          `Working directory is not in the allowed list: ${workingDirectory}`,
          "PATH_NOT_ALLOWED",
          workingDirectory,
        );
      }
    } else if (
      config.security.requireWhitelist &&
      config.security.allowedWorkingDirectories.length === 0
    ) {
      // ホワイトリストが必須なのに設定されていない場合はエラー
      throw new PathValidationError(
        `No allowed working directories configured. Please set ALLOWED_WORKING_DIRECTORIES.`,
        "NO_WHITELIST_CONFIGURED",
        workingDirectory,
      );
    }

    // 🔴 パストラバーサル検出は不要
    // path.resolve() 後は ".." が解決されているため、includes("..") は常に false
    // ホワイトリスト判定（上記）で path.relative() を使って検証済み

    // 3. システムディレクトリのブロック（厳密モード）
    if (config.security.strictPathValidation) {
      const blockedDirectories = [
        "/etc",
        "/root",
        "/sys",
        "/proc",
        "/dev",
        "/boot",
        "/usr/bin",
        "/usr/sbin",
        "/bin",
        "/sbin",
      ];

      // 🔴 安全な判定: path.relative を使用
      // /tmp/etc_link のような類似パスを誤って拒否しないよう注意
      const isBlocked = blockedDirectories.some((blockedDir) => {
        const relativePath = path.relative(blockedDir, normalizedPath);

        // normalizedPath が blockedDir と同じ、またはそのサブディレクトリの場合にブロック
        return (
          relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath))
        );
      });

      if (isBlocked) {
        throw new PathValidationError(
          `Access to system directory is blocked: ${workingDirectory}`,
          "SYSTEM_PATH_BLOCKED",
          workingDirectory,
        );
      }
    }

    // 4. ディレクトリ存在確認
    try {
      const stat = await fs.stat(normalizedPath);
      if (!stat.isDirectory()) {
        throw new PathValidationError(
          `Path is not a directory: ${workingDirectory}`,
          "NOT_DIRECTORY",
          workingDirectory,
        );
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new PathValidationError(
          `Directory does not exist: ${workingDirectory}`,
          "DIRECTORY_NOT_FOUND",
          workingDirectory,
        );
      }
      throw error;
    }

    // 5. シンボリックリンク解決と再検証
    const realPath = await fs.realpath(normalizedPath);
    if (realPath !== normalizedPath) {
      // シンボリックリンクの場合、解決後のパスを再検証
      return this.validateWorkingDirectory(realPath);
    }

    return normalizedPath;
  }

  /**
   * ホームディレクトリ配下のパスを検証
   */
  static isInHomeDirectory(dirPath: string): boolean {
    const homeDir = process.env.HOME || process.env.USERPROFILE || "";
    return path.resolve(dirPath).startsWith(homeDir);
  }

  /**
   * 安全なサブディレクトリかチェック
   * 🔴 安全な実装: path.relative を使用
   */
  static isSafeSubdirectory(parentDir: string, childDir: string): boolean {
    const normalizedParent = path.resolve(parentDir);
    const normalizedChild = path.resolve(childDir);

    // 相対パスを計算
    const relativePath = path.relative(normalizedParent, normalizedChild);

    // 相対パスが空（同じディレクトリ）または
    // .. を含まず、絶対パスでもない場合に許可
    return (
      relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath))
    );
  }
}

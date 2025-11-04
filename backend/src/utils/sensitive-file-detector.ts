import path from "path";
import { minimatch } from "minimatch";

/**
 * 機密ファイル検出器
 */
export class SensitiveFileDetector {
  /**
   * 機密ファイルパターン
   */
  private static readonly SENSITIVE_PATTERNS = [
    // 環境変数
    ".env",
    ".env.*",
    "*.env",

    // 認証情報
    "*credentials*",
    "*secrets*",
    "*password*",
    "*.key",
    "*.pem",
    "*.p12",
    "*.pfx",
    "*.crt",
    "*.cer",

    // SSH鍵
    "id_rsa",
    "id_dsa",
    "id_ecdsa",
    "id_ed25519",
    "*.pub",
    "authorized_keys",
    "known_hosts",

    // AWS認証情報
    ".aws/credentials",
    ".aws/config",

    // クラウドサービス認証情報
    "gcloud/",
    ".azure/",

    // データベース
    "*.db-journal",
    "*.sqlite-wal",

    // トークン
    "*token*",
    "*api-key*",
    "*api_key*",

    // Git
    ".git/config",

    // プライベートディレクトリ
    ".ssh/",
    ".gnupg/",
  ];

  /**
   * ファイルパスが機密ファイルかチェック
   */
  static isSensitiveFile(filePath: string): boolean {
    const fileName = path.basename(filePath);
    const relativePath = filePath;

    return this.SENSITIVE_PATTERNS.some(
      (pattern) =>
        minimatch(fileName, pattern, { nocase: true }) ||
        minimatch(relativePath, pattern, { nocase: true }),
    );
  }

  /**
   * カスタムパターンを追加
   */
  static addPattern(pattern: string): void {
    if (!this.SENSITIVE_PATTERNS.includes(pattern)) {
      this.SENSITIVE_PATTERNS.push(pattern);
    }
  }

  /**
   * ファイル内容のサニタイズ（必要に応じて）
   */
  static sanitizeContent(content: string, filePath: string): string | null {
    if (this.isSensitiveFile(filePath)) {
      return null; // 機密ファイルの場合は内容を返さない
    }
    return content;
  }

  /**
   * ログ出力用の安全なファイルパス
   */
  static getSafePathForLogging(filePath: string): string {
    if (this.isSensitiveFile(filePath)) {
      const dir = path.dirname(filePath);
      const ext = path.extname(filePath);
      // ディレクトリが '.' の場合は '/' を追加しない
      if (dir === ".") {
        return `.[REDACTED]${ext}`;
      }
      return `${dir}/[REDACTED]${ext}`;
    }
    return filePath;
  }
}

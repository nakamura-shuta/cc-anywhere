import { readFile } from "fs/promises";
import { logger } from "../utils/logger.js";
import * as path from "path";

/**
 * ファイル内容をキャッシュするサービス
 * 削除前のファイル内容を保持するために使用
 */
export class FileCacheService {
  private cache = new Map<
    string,
    {
      content: string;
      mimeType: string;
      size: number;
      cachedAt: number;
    }
  >();

  private maxCacheSize = 100 * 1024 * 1024; // 100MB
  private maxFileSize = 10 * 1024 * 1024; // 10MB per file
  private currentCacheSize = 0;

  /**
   * ファイル内容をキャッシュ
   */
  async cacheFile(filePath: string): Promise<void> {
    try {
      const stats = await import("fs").then((fs) => fs.promises.stat(filePath));

      // ファイルサイズチェック
      if (stats.size > this.maxFileSize) {
        logger.warn(`File too large to cache: ${filePath} (${stats.size} bytes)`);
        return;
      }

      // ファイル内容を読み込み
      const content = await readFile(filePath, "utf-8");
      const mimeType = this.getMimeType(filePath);

      // 既存のキャッシュがある場合は削除
      if (this.cache.has(filePath)) {
        const existing = this.cache.get(filePath)!;
        this.currentCacheSize -= existing.size;
      }

      // キャッシュサイズをチェック
      if (this.currentCacheSize + stats.size > this.maxCacheSize) {
        this.evictOldestEntries(stats.size);
      }

      // キャッシュに追加
      this.cache.set(filePath, {
        content,
        mimeType,
        size: stats.size,
        cachedAt: Date.now(),
      });

      this.currentCacheSize += stats.size;

      logger.debug(`Cached file: ${filePath} (${stats.size} bytes)`);
    } catch (error) {
      logger.error(`Failed to cache file ${filePath}:`, error);
    }
  }

  /**
   * キャッシュからファイル内容を取得
   */
  getFile(filePath: string): {
    content: string;
    mimeType: string;
    size: number;
    cachedAt: number;
  } | null {
    const cached = this.cache.get(filePath);
    if (!cached) {
      return null;
    }

    return {
      content: cached.content,
      mimeType: cached.mimeType,
      size: cached.size,
      cachedAt: cached.cachedAt,
    };
  }

  /**
   * ファイルがキャッシュされているかチェック
   */
  hasFile(filePath: string): boolean {
    return this.cache.has(filePath);
  }

  /**
   * キャッシュからファイルを削除
   */
  removeFile(filePath: string): void {
    const cached = this.cache.get(filePath);
    if (cached) {
      this.currentCacheSize -= cached.size;
      this.cache.delete(filePath);
    }
  }

  /**
   * 古いエントリを削除してスペースを確保
   */
  private evictOldestEntries(requiredSpace: number): void {
    const entries = Array.from(this.cache.entries()).sort((a, b) => a[1].cachedAt - b[1].cachedAt);

    let freedSpace = 0;
    for (const [path, entry] of entries) {
      if (freedSpace >= requiredSpace) {
        break;
      }

      this.removeFile(path);
      freedSpace += entry.size;
      logger.debug(`Evicted cached file: ${path}`);
    }
  }

  /**
   * MIMEタイプを推定
   */
  private getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      ".txt": "text/plain",
      ".js": "text/javascript",
      ".ts": "text/typescript",
      ".jsx": "text/jsx",
      ".tsx": "text/tsx",
      ".json": "application/json",
      ".html": "text/html",
      ".css": "text/css",
      ".scss": "text/scss",
      ".sass": "text/sass",
      ".less": "text/less",
      ".xml": "text/xml",
      ".yaml": "text/yaml",
      ".yml": "text/yaml",
      ".md": "text/markdown",
      ".py": "text/x-python",
      ".java": "text/x-java",
      ".c": "text/x-c",
      ".cpp": "text/x-c++",
      ".h": "text/x-c",
      ".hpp": "text/x-c++",
      ".cs": "text/x-csharp",
      ".go": "text/x-go",
      ".rs": "text/x-rust",
      ".php": "text/x-php",
      ".rb": "text/x-ruby",
      ".swift": "text/x-swift",
      ".kt": "text/x-kotlin",
      ".scala": "text/x-scala",
      ".sh": "text/x-shellscript",
      ".bash": "text/x-shellscript",
      ".zsh": "text/x-shellscript",
      ".fish": "text/x-shellscript",
      ".ps1": "text/x-powershell",
      ".bat": "text/x-batch",
      ".cmd": "text/x-batch",
    };

    return mimeTypes[ext] || "text/plain";
  }

  /**
   * キャッシュをクリア
   */
  clear(): void {
    this.cache.clear();
    this.currentCacheSize = 0;
  }

  /**
   * キャッシュ統計を取得
   */
  getStats(): {
    totalFiles: number;
    totalSize: number;
    maxSize: number;
  } {
    return {
      totalFiles: this.cache.size,
      totalSize: this.currentCacheSize,
      maxSize: this.maxCacheSize,
    };
  }
}

// シングルトンインスタンス
export const fileCacheService = new FileCacheService();

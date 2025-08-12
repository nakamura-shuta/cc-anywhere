import { EventEmitter } from "events";
import * as chokidar from "chokidar";
import { logger } from "../utils/logger.js";
import { relative } from "path";
import { fileCacheService } from "./file-cache.service.js";

export interface FileChangeEvent {
  operation: "add" | "change" | "unlink" | "addDir" | "unlinkDir";
  path: string;
  taskId: string;
  timestamp: number;
}

export interface RepositoryFileChangeEvent {
  type: "added" | "changed" | "removed";
  repository: string;
  path: string;
  timestamp: number;
  cachedContent?: string; // 削除されたファイルの内容
}

export interface FileWatchOptions {
  ignored?: RegExp | RegExp[] | string | string[];
  ignoreInitial?: boolean;
  depth?: number;
}

export class FileWatcherService extends EventEmitter {
  private watchers: Map<string, chokidar.FSWatcher> = new Map();
  private repositoryWatchers: Map<string, chokidar.FSWatcher> = new Map();

  async watchDirectory(taskId: string, directory: string): Promise<void> {
    if (this.watchers.has(taskId)) {
      await this.stopWatching(taskId);
    }

    const watcher = chokidar.watch(directory, {
      ignored: /(^|[\\/])\../, // dotfilesを無視
      persistent: true,
      ignoreInitial: true,
    });

    watcher
      .on("add", (path) => this.emitChange("add", path, taskId))
      .on("change", (path) => this.emitChange("change", path, taskId))
      .on("unlink", (path) => this.emitChange("unlink", path, taskId))
      .on("addDir", (path) => this.emitChange("addDir", path, taskId))
      .on("unlinkDir", (path) => this.emitChange("unlinkDir", path, taskId));

    this.watchers.set(taskId, watcher);
    logger.info(`Started watching directory: ${directory} for task: ${taskId}`);
  }

  async stopWatching(taskId: string): Promise<void> {
    const watcher = this.watchers.get(taskId);
    if (watcher) {
      await watcher.close();
      this.watchers.delete(taskId);
      logger.info(`Stopped watching for task: ${taskId}`);
    }
  }

  /**
   * リポジトリの監視を開始（リポジトリエクスプローラー用）
   */
  async watchRepository(repositoryPath: string, options: FileWatchOptions = {}): Promise<void> {
    if (this.repositoryWatchers.has(repositoryPath)) {
      logger.debug("Repository is already being watched", { repository: repositoryPath });
      return;
    }

    try {
      logger.debug("Starting repository watch", { repositoryPath });

      const defaultOptions = {
        ignored: [
          /[/\\]\.git[/\\]/, // .git directory
          /[/\\]node_modules[/\\]/, // node_modules directory
          /[/\\]\..*\.swp$/, // vim swap files
          /[/\\]\.DS_Store$/, // macOS files
          /[/\\]Thumbs\.db$/, // Windows files
          /[/\\]\.vscode[/\\]/, // VSCode settings
          /[/\\]\.worktrees[/\\]/, // worktrees directory
          /[/\\]data[/\\]/, // data directory (SQLite files)
        ],
        ignoreInitial: true, // 初期ファイルは追加イベントとして処理しない
        depth: 10,
        persistent: true,
        ...options,
      };

      const watcher = chokidar.watch(repositoryPath, defaultOptions);

      // ファイル追加
      watcher.on("add", async (filePath: string) => {
        try {
          // 新しいファイルをキャッシュに追加
          await fileCacheService.cacheFile(filePath);
        } catch (error) {
          logger.error("Failed to cache file on add", { filePath, error });
        }

        const relativePath = relative(repositoryPath, filePath);
        const event: RepositoryFileChangeEvent = {
          type: "added",
          repository: repositoryPath,
          path: relativePath,
          timestamp: Date.now(),
        };

        logger.debug("Repository file added", event);
        this.emit("repositoryFileChange", event);
      });

      // ファイル変更
      watcher.on("change", async (filePath: string) => {
        try {
          // キャッシュを更新
          await fileCacheService.cacheFile(filePath);
        } catch (error) {
          logger.error("Failed to cache file on change", { filePath, error });
        }

        const relativePath = relative(repositoryPath, filePath);
        const event: RepositoryFileChangeEvent = {
          type: "changed",
          repository: repositoryPath,
          path: relativePath,
          timestamp: Date.now(),
        };

        logger.debug("Repository file changed", event);
        this.emit("repositoryFileChange", event);
      });

      // ファイル削除
      watcher.on("unlink", async (filePath: string) => {
        const relativePath = relative(repositoryPath, filePath);

        // キャッシュから削除されたファイルの内容を取得
        const cachedFile = fileCacheService.getFile(filePath);

        const event: RepositoryFileChangeEvent = {
          type: "removed",
          repository: repositoryPath,
          path: relativePath,
          timestamp: Date.now(),
          cachedContent: cachedFile?.content, // 削除前の内容を追加
        };

        logger.debug("Repository file removed", event);
        this.emit("repositoryFileChange", event);

        // キャッシュから削除
        fileCacheService.removeFile(filePath);
      });

      // ディレクトリ削除
      watcher.on("unlinkDir", (dirPath: string) => {
        const relativePath = relative(repositoryPath, dirPath);
        const event: RepositoryFileChangeEvent = {
          type: "removed",
          repository: repositoryPath,
          path: relativePath,
          timestamp: Date.now(),
        };

        logger.debug("Repository directory removed", event);
        this.emit("repositoryFileChange", event);
      });

      // エラーハンドリング
      watcher.on("error", (error: Error) => {
        logger.error("Repository file watcher error", {
          repository: repositoryPath,
          error: error.message,
        });
      });

      // 準備完了
      watcher.on("ready", () => {
        logger.info("Repository file watcher ready", {
          repository: repositoryPath,
          path: repositoryPath,
        });
      });

      this.repositoryWatchers.set(repositoryPath, watcher);
    } catch (error) {
      logger.error("Failed to start watching repository", {
        repository: repositoryPath,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * リポジトリの監視を停止
   */
  async unwatchRepository(repositoryPath: string): Promise<void> {
    const watcher = this.repositoryWatchers.get(repositoryPath);
    if (watcher) {
      await watcher.close();
      this.repositoryWatchers.delete(repositoryPath);
      logger.info("Stopped watching repository", { repository: repositoryPath });
    }
  }

  /**
   * すべてのリポジトリ監視を停止
   */
  async stopAllRepositoryWatchers(): Promise<void> {
    const repositories = Array.from(this.repositoryWatchers.keys());
    await Promise.all(repositories.map((repo) => this.unwatchRepository(repo)));
    logger.info("All repository file watchers stopped");
  }

  /**
   * 監視中のリポジトリ一覧を取得
   */
  getWatchedRepositories(): string[] {
    return Array.from(this.repositoryWatchers.keys());
  }

  /**
   * リポジトリが監視中かどうかを確認
   */
  isWatchingRepository(repositoryName: string): boolean {
    return this.repositoryWatchers.has(repositoryName);
  }

  private emitChange(operation: string, path: string, taskId: string): void {
    const event: FileChangeEvent = {
      operation: operation as any,
      path,
      taskId,
      timestamp: Date.now(),
    };
    this.emit("change", event);
  }
}

export const fileWatcherService = new FileWatcherService();

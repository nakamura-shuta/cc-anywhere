import { getRepositoryFileChangesStore } from './repository-file-changes.svelte';
import type { RepositoryFileChangeEvent } from './repository-file-changes.svelte';

export interface FileChange {
  path: string;
  operation: 'add' | 'change' | 'delete' | 'rename';
  timestamp: number;
  expiresAt: number;
  repository?: string;
}

class FileChangeStore {
  private changes = $state<Map<string, FileChange>>(new Map());
  private cleanupInterval: number;
  private repositoryChanges = getRepositoryFileChangesStore();
  private currentRepository: string | null = null;
  private repositoryChangeCleanup: (() => void) | null = null;
  
  constructor() {
    // 5秒ごとに期限切れの変更をクリア
    this.cleanupInterval = window.setInterval(() => this.cleanup(), 5000);
    
    // リポジトリファイル変更の監視を開始
    this.initRepositoryChanges();
  }

  /**
   * リポジトリファイル変更の監視を初期化
   */
  private initRepositoryChanges(): void {
    this.repositoryChangeCleanup = this.repositoryChanges.onAnyFileChange((event: RepositoryFileChangeEvent) => {
      this.addChange(event.path, this.mapChangeType(event.type), event.repository);
    });
  }

  /**
   * リポジトリのファイル変更タイプをFileChangeのoperationにマップ
   */
  private mapChangeType(type: RepositoryFileChangeEvent['type']): FileChange['operation'] {
    switch (type) {
      case 'added':
        return 'add';
      case 'changed':
        return 'change';
      case 'removed':
        return 'delete';
      default:
        return 'change';
    }
  }

  /**
   * 現在のリポジトリを設定
   */
  setRepository(repository: string): void {
    this.currentRepository = repository;
  }
  
  addChange(path: string, operation: string | FileChange['operation'], repository?: string): void {
    // 相対パスを計算（リポジトリパスが含まれている場合は削除）
    let normalizedPath = path;
    if (repository && path.startsWith(repository)) {
      // リポジトリパスを削除して相対パスに変換
      normalizedPath = path.substring(repository.length);
      // 先頭のスラッシュを削除
      if (normalizedPath.startsWith('/')) {
        normalizedPath = normalizedPath.substring(1);
      }
    }
    
    const change: FileChange = {
      path: normalizedPath,
      operation: operation as FileChange['operation'],
      timestamp: Date.now(),
      expiresAt: Date.now() + 30000, // 30秒後に期限切れ
      repository
    };
    
    // 相対パスで保存
    this.changes.set(normalizedPath, change);
    
    // デバッグログ
    console.log('[FileChangeStore] Added change:', {
      originalPath: path,
      normalizedPath,
      operation,
      repository
    });
  }
  
  getChange(path: string): FileChange | undefined {
    // 相対パスで検索
    const change = this.changes.get(path);
    
    if (change && change.expiresAt > Date.now()) {
      // 現在のリポジトリが設定されている場合、そのリポジトリの変更のみ表示
      if (this.currentRepository && change.repository && change.repository !== this.currentRepository) {
        return undefined;
      }
      return change;
    }
    return undefined;
  }

  /**
   * 特定のリポジトリの変更を取得
   */
  getChangesForRepository(repository: string): FileChange[] {
    const now = Date.now();
    const repoChanges: FileChange[] = [];
    
    for (const [_path, change] of this.changes.entries()) {
      if (change.expiresAt > now && change.repository === repository) {
        repoChanges.push(change);
      }
    }
    
    return repoChanges;
  }

  /**
   * すべての有効な変更を取得
   */
  getAllChanges(): FileChange[] {
    const now = Date.now();
    const validChanges: FileChange[] = [];
    
    for (const [_path, change] of this.changes.entries()) {
      if (change.expiresAt > now) {
        validChanges.push(change);
      }
    }
    
    return validChanges;
  }
  
  private cleanup(): void {
    const now = Date.now();
    for (const [path, change] of this.changes.entries()) {
      if (change.expiresAt <= now) {
        this.changes.delete(path);
      }
    }
  }
  
  clearAll(): void {
    this.changes.clear();
  }

  /**
   * 特定のリポジトリの変更をクリア
   */
  clearRepository(repository: string): void {
    for (const [path, change] of this.changes.entries()) {
      if (change.repository === repository) {
        this.changes.delete(path);
      }
    }
  }
  
  destroy(): void {
    window.clearInterval(this.cleanupInterval);
    if (this.repositoryChangeCleanup) {
      this.repositoryChangeCleanup();
    }
  }

  /**
   * WebSocket接続状態を取得
   */
  get isConnected(): boolean {
    return this.repositoryChanges.isConnected;
  }

  /**
   * WebSocket接続状態を取得
   */
  get connectionStatus() {
    return this.repositoryChanges.connectionStatus;
  }
}

export const fileChangeStore = new FileChangeStore();
import { getWebSocketStore } from './websocket-enhanced.svelte';
import type { WebSocketMessage } from './websocket-enhanced.svelte';

export interface RepositoryFileChangeEvent {
  type: 'added' | 'changed' | 'removed';
  repository: string;
  path: string;
  timestamp: number;
}

export type FileChangeHandler = (event: RepositoryFileChangeEvent) => void;

/**
 * リポジトリファイル変更通知を管理するストア
 */
export class RepositoryFileChangesStore {
  private wsStore = getWebSocketStore();
  private handlers = new Map<string, Set<FileChangeHandler>>();
  private globalHandlers = new Set<FileChangeHandler>();
  private cleanupFn: (() => void) | null = null;
  private knownRepositories = new Set<string>();

  // 最新のファイル変更イベント
  latestChange = $state<RepositoryFileChangeEvent | null>(null);
  changeHistory = $state<RepositoryFileChangeEvent[]>([]);

  constructor() {
    this.initialize();
  }
  
  /**
   * 既知のリポジトリパスを登録
   */
  registerRepository(repositoryPath: string): void {
    this.knownRepositories.add(repositoryPath);
    console.log('[RepositoryFileChanges] Registered repository:', repositoryPath);
  }

  /**
   * WebSocket接続とハンドラーの初期化
   */
  private initialize(): void {
    // WebSocketメッセージハンドラーを登録
    this.cleanupFn = this.wsStore.on('repository-file-change', (message: WebSocketMessage) => {
      const event = message.payload as RepositoryFileChangeEvent;
      this.handleFileChange(event);
    });
    
    // タスクによるファイル変更も処理（workaround）
    const taskFileChangeCleanup = this.wsStore.on('file-change', (message: WebSocketMessage) => {
      console.log('[RepositoryFileChanges] Task file change received:', message.payload);
      
      // タスクのファイル変更をリポジトリファイル変更に変換
      const taskChange = message.payload as any;
      if (taskChange.path) {
        // パスからリポジトリを推定（絶対パスを想定）
        const event: RepositoryFileChangeEvent = {
          type: this.mapOperationToType(taskChange.operation),
          repository: this.extractRepositoryFromPath(taskChange.path),
          path: taskChange.path,
          timestamp: taskChange.timestamp || Date.now()
        };
        
        this.handleFileChange(event);
      }
    });

    // WebSocketに接続
    this.wsStore.connect();
    
    // クリーンアップ関数を更新
    const originalCleanup = this.cleanupFn;
    this.cleanupFn = () => {
      if (originalCleanup) originalCleanup();
      taskFileChangeCleanup();
    };
  }
  
  /**
   * タスク操作をリポジトリイベントタイプにマップ
   */
  private mapOperationToType(operation: string): RepositoryFileChangeEvent['type'] {
    switch (operation) {
      case 'add':
      case 'addDir':
        return 'added';
      case 'change':
        return 'changed';
      case 'unlink':
      case 'unlinkDir':
        return 'removed';
      default:
        return 'changed';
    }
  }
  
  /**
   * ファイルパスからリポジトリパスを抽出
   */
  private extractRepositoryFromPath(filePath: string): string {
    // 既知のリポジトリと照合
    for (const repo of this.knownRepositories) {
      if (filePath.startsWith(repo)) {
        return repo;
      }
    }
    
    // 既知のリポジトリがない場合は、タスクが実行されるディレクトリを推定
    // 例: /Users/nakamura.shuta/dev/node/test/file.js -> /Users/nakamura.shuta/dev/node/test
    const parts = filePath.split('/');
    const dirParts = parts.slice(0, -1);
    
    // 一般的なプロジェクトルートを推定
    for (let i = dirParts.length; i > 0; i--) {
      const possibleRoot = dirParts.slice(0, i).join('/');
      // プロジェクトルートの可能性が高いパスを探す
      const lastDir = dirParts[i - 1];
      if (lastDir && (
        lastDir === 'test' || 
        lastDir === 'src' || 
        possibleRoot.includes('/dev/') ||
        possibleRoot.includes('/projects/')
      )) {
        return possibleRoot;
      }
    }
    
    return dirParts.join('/');
  }

  /**
   * ファイル変更イベントを処理
   */
  private handleFileChange(event: RepositoryFileChangeEvent): void {
    console.log('[RepositoryFileChanges] File change event received:', event);

    // 最新のイベントを更新
    this.latestChange = event;

    // 履歴に追加（最新100件まで保持）
    this.changeHistory = [event, ...this.changeHistory.slice(0, 99)];

    // グローバルハンドラーを実行
    this.globalHandlers.forEach(handler => {
      try {
        handler(event);
      } catch (error) {
        console.error('[RepositoryFileChanges] Global handler error:', error);
      }
    });

    // リポジトリ別ハンドラーを実行
    const repositoryHandlers = this.handlers.get(event.repository);
    if (repositoryHandlers) {
      repositoryHandlers.forEach(handler => {
        try {
          handler(event);
        } catch (error) {
          console.error('[RepositoryFileChanges] Repository handler error:', error);
        }
      });
    }
  }

  /**
   * 特定のリポジトリの変更を監視
   */
  onRepositoryChange(repository: string, handler: FileChangeHandler): () => void {
    if (!this.handlers.has(repository)) {
      this.handlers.set(repository, new Set());
    }

    this.handlers.get(repository)!.add(handler);

    // クリーンアップ関数を返す
    return () => {
      this.handlers.get(repository)?.delete(handler);
      if (this.handlers.get(repository)?.size === 0) {
        this.handlers.delete(repository);
      }
    };
  }

  /**
   * すべてのファイル変更を監視
   */
  onAnyFileChange(handler: FileChangeHandler): () => void {
    this.globalHandlers.add(handler);

    return () => {
      this.globalHandlers.delete(handler);
    };
  }

  /**
   * 特定のリポジトリの最新変更を取得
   */
  getLatestChangeForRepository(repository: string): RepositoryFileChangeEvent | null {
    return this.changeHistory.find(change => change.repository === repository) || null;
  }

  /**
   * 特定のリポジトリの変更履歴を取得
   */
  getChangeHistoryForRepository(repository: string, limit = 20): RepositoryFileChangeEvent[] {
    return this.changeHistory
      .filter(change => change.repository === repository)
      .slice(0, limit);
  }

  /**
   * 変更履歴をクリア
   */
  clearHistory(): void {
    this.changeHistory = [];
    this.latestChange = null;
  }

  /**
   * WebSocket接続状態を取得
   */
  get isConnected(): boolean {
    return this.wsStore.isConnected;
  }

  /**
   * WebSocket接続状態を取得
   */
  get connectionStatus() {
    return this.wsStore.status;
  }

  /**
   * クリーンアップ
   */
  destroy(): void {
    if (this.cleanupFn) {
      this.cleanupFn();
      this.cleanupFn = null;
    }

    this.handlers.clear();
    this.globalHandlers.clear();
    this.changeHistory = [];
    this.latestChange = null;
  }
}

// シングルトンインスタンス
let fileChangesStore: RepositoryFileChangesStore | null = null;

export function getRepositoryFileChangesStore(): RepositoryFileChangesStore {
  if (!fileChangesStore) {
    fileChangesStore = new RepositoryFileChangesStore();
  }
  return fileChangesStore;
}
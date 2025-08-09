interface FileChange {
  path: string;
  operation: 'add' | 'change' | 'delete' | 'rename';
  timestamp: number;
  expiresAt: number;
}

class FileChangeStore {
  private changes = $state<Map<string, FileChange>>(new Map());
  private cleanupInterval: number;
  
  constructor() {
    // 5秒ごとに期限切れの変更をクリア
    this.cleanupInterval = window.setInterval(() => this.cleanup(), 5000);
  }
  
  addChange(path: string, operation: string): void {
    const change: FileChange = {
      path,
      operation: operation as any,
      timestamp: Date.now(),
      expiresAt: Date.now() + 30000 // 30秒後に期限切れ
    };
    this.changes.set(path, change);
  }
  
  getChange(path: string): FileChange | undefined {
    const change = this.changes.get(path);
    if (change && change.expiresAt > Date.now()) {
      return change;
    }
    return undefined;
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
  
  destroy(): void {
    window.clearInterval(this.cleanupInterval);
  }
}

export const fileChangeStore = new FileChangeStore();
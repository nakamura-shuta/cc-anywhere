/**
 * 削除されたファイルの情報を保持するストア
 * 削除されたファイルをツリーに表示し続けるために使用
 */

export interface DeletedFile {
  path: string;
  name: string;
  repository: string;
  content?: string; // 削除前のファイル内容
  deletedAt: number;
  type: 'file' | 'directory';
  size?: number;
}

class DeletedFilesStore {
  private deletedFiles = $state<Map<string, DeletedFile>>(new Map());
  private maxRetentionTime = 1000 * 60 * 60; // 1時間保持
  private cleanupInterval: number;
  
  constructor() {
    // 定期的に古い削除ファイル情報をクリーンアップ
    this.cleanupInterval = window.setInterval(() => this.cleanup(), 60000); // 1分ごと
  }
  
  /**
   * 削除されたファイルを記録
   */
  addDeletedFile(file: Omit<DeletedFile, 'deletedAt'>): void {
    const key = `${file.repository}:${file.path}`;
    this.deletedFiles.set(key, {
      ...file,
      deletedAt: Date.now()
    });
    
    console.log('[DeletedFilesStore] Recorded deleted file:', {
      repository: file.repository,
      path: file.path,
      type: file.type
    });
  }
  
  /**
   * 削除されたファイルの内容を設定
   */
  setDeletedFileContent(repository: string, path: string, content: string): void {
    const key = `${repository}:${path}`;
    const file = this.deletedFiles.get(key);
    if (file) {
      file.content = content;
    }
  }
  
  /**
   * リポジトリ内の削除されたファイルを取得
   */
  getDeletedFilesForRepository(repository: string): DeletedFile[] {
    const now = Date.now();
    const files: DeletedFile[] = [];
    
    for (const [key, file] of this.deletedFiles.entries()) {
      if (file.repository === repository && 
          (now - file.deletedAt) < this.maxRetentionTime) {
        files.push(file);
      }
    }
    
    return files;
  }
  
  /**
   * 特定のファイルが削除されたかチェック
   */
  isDeleted(repository: string, path: string): boolean {
    const key = `${repository}:${path}`;
    const file = this.deletedFiles.get(key);
    if (!file) return false;
    
    const now = Date.now();
    return (now - file.deletedAt) < this.maxRetentionTime;
  }
  
  /**
   * 削除されたファイルの情報を取得
   */
  getDeletedFile(repository: string, path: string): DeletedFile | undefined {
    const key = `${repository}:${path}`;
    const file = this.deletedFiles.get(key);
    
    if (file) {
      const now = Date.now();
      if ((now - file.deletedAt) < this.maxRetentionTime) {
        return file;
      }
    }
    
    return undefined;
  }
  
  /**
   * ファイルが復活した場合（再作成された場合）、削除記録をクリア
   */
  clearDeletedFile(repository: string, path: string): void {
    const key = `${repository}:${path}`;
    this.deletedFiles.delete(key);
  }
  
  /**
   * リポジトリのすべての削除ファイル記録をクリア
   */
  clearRepository(repository: string): void {
    for (const [key, file] of this.deletedFiles.entries()) {
      if (file.repository === repository) {
        this.deletedFiles.delete(key);
      }
    }
  }
  
  /**
   * 古い削除ファイル情報をクリーンアップ
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, file] of this.deletedFiles.entries()) {
      if ((now - file.deletedAt) >= this.maxRetentionTime) {
        this.deletedFiles.delete(key);
      }
    }
  }
  
  /**
   * すべての削除ファイル記録をクリア
   */
  clearAll(): void {
    this.deletedFiles.clear();
  }
  
  destroy(): void {
    window.clearInterval(this.cleanupInterval);
  }
}

// シングルトンインスタンス
export const deletedFilesStore = new DeletedFilesStore();

// ストア取得関数（既存パターンに合わせる）
export function getDeletedFilesStore(): DeletedFilesStore {
  return deletedFilesStore;
}
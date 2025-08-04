import { taskStore } from '$lib/stores/task.svelte';
import type { TaskResponse } from '$lib/types/api';

/**
 * 移行版TaskListStore
 * 既存のインターフェースを維持しつつ、新しい統一ストアを使用
 */
class TaskListStoreMigrated {
  // 既存のプロパティを新しいストアにマッピング
  get tasks() {
    return taskStore.items;
  }
  
  set tasks(value: TaskResponse[]) {
    taskStore.items = value;
  }
  
  get loading() {
    return taskStore.loading;
  }
  
  get error() {
    return taskStore.error?.message || null;
  }
  
  // 初期化（既存のインターフェースを維持）
  async initialize(initialTasks: TaskResponse[]) {
    // 初期データをセット
    // 空の配列でも有効なデータとして扱う（フィルター結果が0件の場合があるため）
    taskStore.items = initialTasks;
    
    // WebSocket接続は自動的に行われる（websocket-integration.svelte.tsで設定）
  }
  
  // クリーンアップ
  cleanup() {
    // 新しいアーキテクチャではグローバルで管理されるため、
    // 個別のクリーンアップは不要
    console.log('[TaskListStore] Cleanup called (no-op in new architecture)');
  }
  
  // 互換性のためのメソッド
  private async fetchTaskDetails(taskId: string) {
    await taskStore.getById(taskId);
  }
}

// シングルトンインスタンスをエクスポート（既存のコードとの互換性）
export const taskListStore = new TaskListStoreMigrated();
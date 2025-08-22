import { createEntityStore, type WebSocketMessage } from './factory.svelte';
import { taskService } from '$lib/services/task.service';
import type { TaskResponse } from '$lib/types/api';

/**
 * タスクストア
 * EntityStoreを継承して実装
 */
class TaskStore extends createEntityStore<TaskResponse>('task', taskService) {
  constructor() {
    super();
    // 初期化時に全タスクを購読
    this.subscribeToAllTasks();
  }
  
  private subscribeToAllTasks(): void {
    // WebSocketストアを取得してタスクの更新を購読
    import('./websocket-enhanced.svelte').then(({ getWebSocketStore }) => {
      const ws = getWebSocketStore();
      
      // WebSocket接続後に全タスクを購読
      const unsubscribe = ws.on('auth:success', () => {
        // 全タスクの更新を購読
        ws.send({
          type: 'subscribe',
          payload: { taskId: '*' }
        });
        
        // 一度だけ実行するので解除
        unsubscribe();
      });
      
      // 既に接続済みの場合は即座に購読
      if (ws.isConnected) {
        ws.send({
          type: 'subscribe',
          payload: { taskId: '*' }
        });
      }
    });
  }
  // タスク固有の状態
  runningCount = $derived(
    this.items.filter(task => task.status === 'running').length
  );
  
  pendingCount = $derived(
    this.items.filter(task => task.status === 'pending').length
  );
  
  completedCount = $derived(
    this.items.filter(task => task.status === 'completed').length
  );
  
  failedCount = $derived(
    this.items.filter(task => task.status === 'failed').length
  );
  
  // タスク固有のメソッド
  async cancel(taskId: string): Promise<boolean> {
    try {
      this.loading = true;
      this.error = null;
      await taskService.cancel(taskId);
      this.updateLocalByTaskId(taskId, { status: 'cancelled' as any });
      return true;
    } catch (err) {
      this.error = err instanceof Error ? err : new Error('Failed to cancel task');
      return false;
    } finally {
      this.loading = false;
    }
  }
  
  async retry(taskId: string): Promise<TaskResponse | null> {
    try {
      this.loading = true;
      this.error = null;
      const newTask = await taskService.retry(taskId);
      this.items = [newTask, ...this.items];
      return newTask;
    } catch (err) {
      this.error = err instanceof Error ? err : new Error('Failed to retry task');
      return null;
    } finally {
      this.loading = false;
    }
  }
  
  async continue(taskId: string, instruction: string): Promise<TaskResponse | null> {
    try {
      this.loading = true;
      this.error = null;
      // taskService.continue is removed, using create with continueFromTaskId instead
      const previousTask = this.items.find(t => t.taskId === taskId);
      const newTask = await taskService.create({
        instruction,
        context: previousTask?.context,
        options: {
          ...previousTask?.options,
          sdk: {
            ...previousTask?.options?.sdk,
            continueFromTaskId: taskId
          }
        }
      });
      this.items = [newTask, ...this.items];
      return newTask;
    } catch (err) {
      this.error = err instanceof Error ? err : new Error('Failed to continue task');
      return null;
    } finally {
      this.loading = false;
    }
  }
  
  // カスタムWebSocketメッセージハンドラー
  override handleCustomMessage(message: WebSocketMessage): void {
    const { type, payload } = message;
    
    switch (type) {
      case 'task:update':
        this.handleTaskUpdate(payload);
        break;
        
      case 'task:status':
      case 'task:running':
      case 'task:completed':
      case 'task:failed':
      case 'task:cancelled':
        // 旧形式のサポート
        this.handleLegacyTaskStatus(message);
        break;
        
      case 'task:progress':
        this.updateLocalByTaskId(payload.taskId, {
          progressData: payload.progressData
        });
        break;
    }
  }
  
  private handleTaskUpdate(payload: any): void {
    const taskId = payload.taskId || payload.id;
    
    if (!taskId) {
      return;
    }
    
    const updates: Partial<TaskResponse> = {};
    
    if (payload.status) {
      updates.status = payload.status;
    }
    
    if (payload.metadata) {
      const meta = payload.metadata;
      if (meta.completedAt) updates.completedAt = meta.completedAt;
      if (meta.duration) updates.duration = meta.duration;
      if (meta.error) updates.error = meta.error;
      if (meta.workingDirectory) updates.workingDirectory = meta.workingDirectory;
    }
    
    if (payload.timestamp) {
      updates.updatedAt = payload.timestamp;
    }
    
    this.updateLocalByTaskId(taskId, updates);
  }
  
  // タスクIDで更新するメソッドを追加
  private updateLocalByTaskId(taskId: string, data: Partial<TaskResponse>): void {
    const index = this.items.findIndex(item => item.taskId === taskId);
    
    if (index !== -1) {
      this.items[index] = { ...this.items[index], ...data };
    }
  }
  
  private handleLegacyTaskStatus(message: WebSocketMessage): void {
    const taskId = message.payload?.taskId || message.payload?.id;
    if (!taskId) return;
    
    const statusMap: Record<string, string> = {
      'task:running': 'running',
      'task:completed': 'completed',
      'task:failed': 'failed',
      'task:cancelled': 'cancelled',
    };
    
    const status = statusMap[message.type] || message.payload?.status;
    if (status) {
      this.updateLocalByTaskId(taskId, { status });
    }
  }
  
  // ステータスでフィルタリング
  filterByStatus(status: string): TaskResponse[] {
    return this.items.filter(task => task.status === status);
  }
  
  // 期間でフィルタリング
  filterByDateRange(startDate: Date, endDate: Date): TaskResponse[] {
    return this.items.filter(task => {
      const createdAt = new Date(task.createdAt);
      return createdAt >= startDate && createdAt <= endDate;
    });
  }
}

// シングルトンインスタンス
export const taskStore = new TaskStore();
import { createEntityStore, type WebSocketMessage } from './factory.svelte';
import { taskService } from '$lib/services/task.service';
import type { TaskResponse } from '$lib/types/api';

/**
 * タスクストア
 * EntityStoreを継承して実装
 */
class TaskStore extends createEntityStore<TaskResponse>('task', taskService) {
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
      this.updateLocal(taskId, { status: 'cancelled' as any });
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
      const newTask = await taskService.continue(taskId, { instruction });
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
        this.updateLocal(payload.taskId, {
          progressData: payload.progressData
        });
        break;
    }
  }
  
  private handleTaskUpdate(payload: any): void {
    const taskId = payload.taskId || payload.id;
    if (!taskId) return;
    
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
    
    this.updateLocal(taskId, updates);
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
      this.updateLocal(taskId, { status });
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
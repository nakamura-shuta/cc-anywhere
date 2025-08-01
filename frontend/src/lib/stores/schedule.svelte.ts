import { createEntityStore } from './factory.svelte';
import { scheduleEntityService } from '$lib/services/schedule-entity.service';
import type { ScheduledTask, ScheduledTaskHistory } from '$lib/types/api';

/**
 * スケジュールストア
 * EntityStoreを継承して実装
 */
class ScheduleStore extends createEntityStore<ScheduledTask>('schedule', scheduleEntityService) {
  // スケジュール固有の状態
  activeCount = $derived(
    this.items.filter(schedule => schedule.status === 'active').length
  );
  
  inactiveCount = $derived(
    this.items.filter(schedule => schedule.status === 'inactive').length
  );
  
  // スケジュール固有のメソッド
  async toggle(id: string): Promise<void> {
    const schedule = this.items.find(s => s.id === id);
    if (!schedule) return;
    
    try {
      const updated = await scheduleEntityService.toggle(
        id, 
        schedule.status !== 'active'
      );
      this.updateLocal(id, updated);
    } catch (error) {
      this.error = error instanceof Error ? error : new Error('Failed to toggle schedule');
      throw error;
    }
  }
  
  async runNow(id: string): Promise<void> {
    try {
      await scheduleEntityService.runNow(id);
      console.log(`[ScheduleStore] Schedule ${id} triggered manually`);
    } catch (error) {
      this.error = error instanceof Error ? error : new Error('Failed to run schedule');
      throw error;
    }
  }
  
  async getHistory(id: string): Promise<any[]> {
    try {
      return await scheduleEntityService.getHistory(id);
    } catch (error) {
      this.error = error instanceof Error ? error : new Error('Failed to get history');
      throw error;
    }
  }
  
  // ステータスでフィルタリング
  filterByStatus(status: 'active' | 'inactive' | 'completed' | 'failed'): ScheduledTask[] {
    return this.items.filter(schedule => schedule.status === status);
  }
  
  // カスタムWebSocketメッセージハンドリング
  handleCustomMessage(message: { type: string; payload: any }): void {
    const { type, payload } = message;
    
    switch (type) {
      case 'schedule:update':
        // スケジュールの更新
        if (payload.scheduleId) {
          const schedule = this.findById(payload.scheduleId);
          if (schedule) {
            const updates: Partial<ScheduledTask> = {
              status: payload.status,
              metadata: {
                ...schedule.metadata,
                ...payload.metadata
              }
            };
            this.updateLocal(payload.scheduleId, updates);
          }
        }
        break;
        
      case 'schedule:execution':
        // スケジュール実行通知
        if (payload.scheduleId) {
          const schedule = this.findById(payload.scheduleId);
          if (schedule) {
            // 実行履歴を更新
            const newHistory: ScheduledTaskHistory = {
              executedAt: payload.timestamp,
              taskId: payload.taskId,
              status: payload.status === 'completed' ? 'success' as const : 'failure' as const,
              error: payload.error
            };
            
            const updates: Partial<ScheduledTask> = {
              history: [...(schedule.history || []), newHistory].slice(-100) // 最新100件を保持
            };
            
            // 実行完了時はメタデータも更新
            if (payload.status === 'completed' || payload.status === 'failed') {
              updates.metadata = {
                ...schedule.metadata,
                lastExecutedAt: payload.timestamp,
                executionCount: (schedule.metadata?.executionCount || 0) + 1
              };
            }
            
            this.updateLocal(payload.scheduleId, updates);
          }
        }
        break;
    }
  }
}

// シングルトンインスタンス
export const scheduleStore = new ScheduleStore();
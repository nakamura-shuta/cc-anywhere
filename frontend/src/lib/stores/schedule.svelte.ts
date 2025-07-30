import { createEntityStore } from './factory.svelte';
import { scheduleEntityService } from '$lib/services/schedule-entity.service';
import type { ScheduledTask } from '$lib/types/api';

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
}

// シングルトンインスタンス
export const scheduleStore = new ScheduleStore();
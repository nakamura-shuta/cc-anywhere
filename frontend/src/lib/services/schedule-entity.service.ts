import { scheduleService } from './schedule.service';
import type { ScheduledTask } from '$lib/types/api';
import type { EntityService } from '$lib/stores/factory.svelte';

/**
 * スケジュールエンティティサービス
 * EntityServiceインターフェースを実装
 */
export class ScheduleEntityService implements EntityService<ScheduledTask> {
  async list(params?: any): Promise<ScheduledTask[]> {
    const response = await scheduleService.list(params);
    return response.schedules || [];
  }
  
  async get(id: string): Promise<ScheduledTask> {
    return scheduleService.get(id);
  }
  
  async create(data: Partial<ScheduledTask>): Promise<ScheduledTask> {
    return scheduleService.create(data as any);
  }
  
  async update(id: string, data: Partial<ScheduledTask>): Promise<ScheduledTask> {
    return scheduleService.update(id, data);
  }
  
  async delete(id: string): Promise<void> {
    return scheduleService.delete(id);
  }
  
  // スケジュール固有のメソッドを追加
  async toggle(id: string, enabled: boolean): Promise<ScheduledTask> {
    return scheduleService.toggle(id, enabled);
  }
  
  async runNow(id: string): Promise<void> {
    return scheduleService.runNow(id);
  }
  
  async getHistory(id: string): Promise<any[]> {
    return scheduleService.getHistory(id);
  }
}

// シングルトンインスタンス
export const scheduleEntityService = new ScheduleEntityService();
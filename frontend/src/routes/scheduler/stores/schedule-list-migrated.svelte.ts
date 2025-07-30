import { scheduleStore } from '$lib/stores/schedule.svelte';
import type { ScheduledTask } from '$lib/types/api';

/**
 * 移行版ScheduleListStore
 * 既存のインターフェースを維持しつつ、新しい統一ストアを使用
 */
class ScheduleListStoreMigrated {
  // 既存のプロパティを新しいストアにマッピング
  get schedules() {
    return scheduleStore.items;
  }
  
  set schedules(value: ScheduledTask[]) {
    scheduleStore.items = value;
  }
  
  get loading() {
    return scheduleStore.loading;
  }
  
  get error() {
    return scheduleStore.error?.message || null;
  }
  
  // 初期化（既存のインターフェースを維持）
  initialize(initialSchedules: ScheduledTask[]) {
    if (initialSchedules && initialSchedules.length > 0) {
      scheduleStore.items = initialSchedules;
    } else {
      // データがない場合はAPIから取得
      scheduleStore.load();
    }
  }
  
  // スケジュールの有効/無効を切り替え
  async toggleSchedule(id: string, _currentStatus: string): Promise<boolean> {
    try {
      await scheduleStore.toggle(id);
      return true;
    } catch (err) {
      console.error('Failed to toggle schedule:', err);
      return false;
    }
  }
  
  // スケジュールの削除
  async deleteSchedule(id: string): Promise<boolean> {
    try {
      await scheduleStore.delete(id);
      return true;
    } catch (err) {
      console.error('Failed to delete schedule:', err);
      return false;
    }
  }
  
  // クリーンアップ
  cleanup() {
    // 新しいアーキテクチャではグローバルで管理されるため、
    // 個別のクリーンアップは不要
    console.log('[ScheduleListStore] Cleanup called (no-op in new architecture)');
  }
}

// シングルトンインスタンスをエクスポート（既存のコードとの互換性）
export const scheduleListStore = new ScheduleListStoreMigrated();
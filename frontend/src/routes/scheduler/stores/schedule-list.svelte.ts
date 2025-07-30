import type { ScheduledTask } from '$lib/types/api';
import { scheduleService } from '$lib/services/schedule.service';

class ScheduleListStore {
	// 状態管理
	schedules = $state<ScheduledTask[]>([]);
	loading = $state(false);
	error = $state<string | null>(null);
	
	// 初期化
	initialize(initialSchedules: ScheduledTask[]) {
		this.schedules = initialSchedules || [];
	}
	
	// スケジュールの有効/無効を切り替え
	async toggleSchedule(id: string, currentStatus: string): Promise<boolean> {
		try {
			const newStatus = currentStatus === 'active' ? false : true;
			const updated = await scheduleService.toggle(id, newStatus);
			
			// ローカルの状態を更新
			this.schedules = this.schedules.map(s => 
				s.id === id ? { ...s, status: updated.status } : s
			);
			
			return true;
		} catch (err) {
			console.error('Failed to toggle schedule:', err);
			this.error = 'スケジュールの更新に失敗しました';
			return false;
		}
	}
	
	// スケジュールを削除
	async deleteSchedule(id: string): Promise<boolean> {
		try {
			await scheduleService.delete(id);
			
			// ローカルの状態から削除
			this.schedules = this.schedules.filter(s => s.id !== id);
			
			return true;
		} catch (err) {
			console.error('Failed to delete schedule:', err);
			this.error = 'スケジュールの削除に失敗しました';
			return false;
		}
	}
	
	// スケジュールを追加
	addSchedule(schedule: ScheduledTask) {
		this.schedules = [schedule, ...this.schedules];
	}
	
	// エラーをクリア
	clearError() {
		this.error = null;
	}
}

// シングルトンインスタンスをエクスポート
export const scheduleListStore = new ScheduleListStore();
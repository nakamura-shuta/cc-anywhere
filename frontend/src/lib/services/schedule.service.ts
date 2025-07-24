// スケジュールサービス

import { apiClient } from '$lib/api/client';
import type { ScheduledTask, ScheduledTaskHistory, ScheduleListResponse } from '$lib/types/api';

export const scheduleService = {
	// スケジュール一覧の取得
	async list(params?: { limit?: number; offset?: number; status?: string }): Promise<ScheduleListResponse> {
		return apiClient.get<ScheduleListResponse>('/api/schedules', { params });
	},

	// 単一スケジュールの取得
	async get(id: string): Promise<ScheduledTask> {
		return apiClient.get<ScheduledTask>(`/api/schedules/${id}`);
	},

	// スケジュールの作成
	async create(data: {
		name: string;
		description?: string;
		taskRequest: ScheduledTask['taskRequest'];
		schedule: ScheduledTask['schedule'];
		status?: ScheduledTask['status'];
	}): Promise<ScheduledTask> {
		return apiClient.post<ScheduledTask>('/api/schedules', data);
	},

	// スケジュールの更新
	async update(id: string, schedule: Partial<ScheduledTask>): Promise<ScheduledTask> {
		return apiClient.put<ScheduledTask>(`/api/schedules/${id}`, schedule);
	},

	// スケジュールの有効化/無効化（以前の実装と互換性）
	async toggle(id: string, enabled: boolean): Promise<ScheduledTask> {
		const endpoint = enabled ? 'enable' : 'disable';
		try {
			// 以前のAPI形式を試す
			return apiClient.post<ScheduledTask>(`/api/schedules/${id}/${endpoint}`);
		} catch {
			// 新しいAPI形式を試す
			return apiClient.patch<ScheduledTask>(`/api/schedules/${id}`, { enabled });
		}
	},

	// スケジュールの削除
	async delete(id: string): Promise<void> {
		return apiClient.delete(`/api/schedules/${id}`);
	},

	// スケジュールの即時実行
	async runNow(id: string): Promise<void> {
		return apiClient.post(`/api/schedules/${id}/run`);
	},

	// スケジュール履歴の取得
	async getHistory(id: string): Promise<ScheduledTaskHistory[]> {
		return apiClient.get<ScheduledTaskHistory[]>(`/api/schedules/${id}/history`);
	}
};
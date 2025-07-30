// プリセットサービス

import { apiClient } from '$lib/api/client';
import type { TaskPreset, PresetsConfig } from '$lib/types/api';

export const presetService = {
	// プリセット一覧の取得
	async list(): Promise<PresetsConfig> {
		return apiClient.get<PresetsConfig>('/api/presets');
	},

	// 単一プリセットの取得
	async get(id: string): Promise<TaskPreset> {
		return apiClient.get<TaskPreset>(`/api/presets/${id}`);
	},

	// プリセットの作成
	async create(preset: Omit<TaskPreset, 'id' | 'createdAt' | 'updatedAt'>): Promise<TaskPreset> {
		return apiClient.post<TaskPreset>('/api/presets', preset);
	},

	// プリセットの更新
	async update(id: string, preset: Partial<TaskPreset>): Promise<TaskPreset> {
		return apiClient.put<TaskPreset>(`/api/presets/${id}`, preset);
	},

	// プリセットの削除
	async delete(id: string): Promise<void> {
		return apiClient.delete(`/api/presets/${id}`);
	}
};
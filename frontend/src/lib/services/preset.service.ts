// プリセットサービス

import { apiClient } from '$lib/api/client';
import type { Preset, PaginationParams, PaginatedResponse } from '$lib/types/api';

export const presetService = {
	// プリセット一覧の取得
	async list(params?: PaginationParams): Promise<PaginatedResponse<Preset>> {
		const filteredParams = params ? Object.fromEntries(
			Object.entries(params).filter(([_, v]) => v !== undefined)
		) as Record<string, string | number | boolean> : undefined;
		return apiClient.get<PaginatedResponse<Preset>>('/api/presets', { params: filteredParams });
	},

	// 単一プリセットの取得
	async get(id: string): Promise<Preset> {
		return apiClient.get<Preset>(`/api/presets/${id}`);
	},

	// プリセットの作成
	async create(preset: Omit<Preset, 'id' | 'createdAt' | 'updatedAt'>): Promise<Preset> {
		return apiClient.post<Preset>('/api/presets', preset);
	},

	// プリセットの更新
	async update(id: string, preset: Partial<Preset>): Promise<Preset> {
		return apiClient.put<Preset>(`/api/presets/${id}`, preset);
	},

	// プリセットの削除
	async delete(id: string): Promise<void> {
		return apiClient.delete(`/api/presets/${id}`);
	}
};
// 設定サービス

import { apiClient } from '$lib/api/client';

export interface Settings {
	executionMode: 'api-key' | 'bedrock';
	availableModes: string[];
	credentials: {
		apiKey: boolean;
		bedrock: boolean;
	};
}

export interface UpdateSettingsRequest {
	executionMode: 'api-key' | 'bedrock';
}

export const settingsService = {
	// 現在の設定を取得
	async getSettings(): Promise<Settings> {
		return apiClient.get<Settings>('/api/settings');
	},

	// 設定を更新
	async updateSettings(request: UpdateSettingsRequest): Promise<Settings> {
		return apiClient.put<Settings>('/api/settings', request);
	}
};
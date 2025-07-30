// システムサービス

import { apiClient } from '$lib/api/client';
import type { HealthCheckResponse, WorkerInfo } from '$lib/types/api';

export const systemService = {
	// ヘルスチェック
	async health(): Promise<HealthCheckResponse> {
		return apiClient.get<HealthCheckResponse>('/api/health');
	},

	// ワーカー情報の取得
	async getWorkers(): Promise<WorkerInfo[]> {
		return apiClient.get<WorkerInfo[]>('/api/workers');
	},

	// エコーテスト（接続確認用）
	async echo(message: string): Promise<{ message: string; timestamp: string }> {
		return apiClient.post('/api/echo', { message });
	}
};
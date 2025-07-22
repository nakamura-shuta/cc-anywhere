// バッチタスクサービス

import { apiClient } from '$lib/api/client';
import type { 
	BatchTaskRequest, 
	BatchTaskResponse, 
	BatchTaskStatus 
} from '$lib/types/api';

export const batchService = {
	// バッチタスクの作成
	async create(request: BatchTaskRequest): Promise<BatchTaskResponse> {
		return apiClient.post<BatchTaskResponse>('/api/batch/tasks', request);
	},

	// バッチタスクステータスの取得
	async getStatus(groupId: string): Promise<BatchTaskStatus> {
		return apiClient.get<BatchTaskStatus>(`/api/batch/tasks/${groupId}/status`);
	}
};
import { apiClient } from '$lib/api/client';
import type {
	CreateCompareTaskRequest,
	CreateCompareTaskResponse,
	CompareTaskDetailResponse,
	CompareTaskListResponse,
	CompareFilesResponse
} from '$lib/types/api';

/**
 * 比較モードサービス
 * Claude, Codex, Geminiの同時実行結果を比較するためのAPI
 */
export class CompareService {
	/**
	 * 比較タスク一覧を取得
	 */
	async list(params?: { limit?: number; offset?: number }): Promise<CompareTaskListResponse> {
		return await apiClient.get<CompareTaskListResponse>('/api/compare', { params });
	}

	/**
	 * 比較タスク詳細を取得
	 */
	async get(id: string): Promise<CompareTaskDetailResponse> {
		return await apiClient.get<CompareTaskDetailResponse>(`/api/compare/${id}`);
	}

	/**
	 * 比較タスクを作成
	 */
	async create(data: CreateCompareTaskRequest): Promise<CreateCompareTaskResponse> {
		return await apiClient.post<CreateCompareTaskResponse>('/api/compare', data);
	}

	/**
	 * 比較タスクをキャンセル
	 */
	async cancel(id: string): Promise<void> {
		await apiClient.delete(`/api/compare/${id}`);
	}

	/**
	 * 変更ファイル一覧を取得
	 */
	async getFiles(id: string): Promise<CompareFilesResponse> {
		return await apiClient.get<CompareFilesResponse>(`/api/compare/${id}/files`);
	}
}

// シングルトンインスタンス
export const compareService = new CompareService();

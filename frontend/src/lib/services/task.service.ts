// タスクサービス - SvelteKitのload関数で使用

import { apiClient } from '$lib/api/client';
import type { 
	TaskResponse, 
	TaskRequest, 
	TaskLogResponse,
	PaginationParams,
	PaginatedResponse 
} from '$lib/types/api';

export const taskService = {
	// タスク一覧の取得（ページネーション対応）
	async list(params?: PaginationParams & { status?: string }): Promise<PaginatedResponse<TaskResponse>> {
		// 以前の実装と互換性を保つため、offset/limitも対応
		const queryParams: any = {};
		if (params) {
			if (params.page && params.limit) {
				queryParams.offset = (params.page - 1) * params.limit;
				queryParams.limit = params.limit;
			}
			if (params.status) queryParams.status = params.status;
			if (params.sort) queryParams.sort = params.sort;
			if (params.order) queryParams.order = params.order;
		}
		
		// APIレスポンスを取得
		const response = await apiClient.get<{
			tasks: TaskResponse[];
			total: number;
			limit: number;
			offset: number;
		}>('/api/tasks', { params: queryParams });
		
		// PaginatedResponseフォーマットに変換
		const page = params?.page || 1;
		const limit = response.limit;
		const totalPages = Math.ceil(response.total / limit);
		
		// TaskResponseの変換（idフィールドを追加）
		const tasks = response.tasks.map(task => ({
			...task,
			id: task.taskId // idフィールドを追加
		}));
		
		return {
			data: tasks,
			pagination: {
				page,
				limit,
				total: response.total,
				totalPages
			}
		};
	},

	// 単一タスクの取得
	async get(id: string): Promise<TaskResponse> {
		const task = await apiClient.get<TaskResponse>(`/api/tasks/${id}`);
		// idフィールドを追加
		return {
			...task,
			id: task.taskId
		};
	},

	// タスクの作成
	async create(request: TaskRequest): Promise<TaskResponse> {
		const task = await apiClient.post<TaskResponse>('/api/tasks', request);
		// idフィールドを追加
		return {
			...task,
			id: task.taskId
		};
	},

	// タスクのキャンセル（以前の実装はDELETEメソッド）
	async cancel(id: string): Promise<TaskResponse> {
		// 互換性のためDELETEメソッドも試す
		try {
			return apiClient.delete<TaskResponse>(`/api/tasks/${id}`);
		} catch {
			// 失敗したらPOSTメソッドを試す
			return apiClient.post<TaskResponse>(`/api/tasks/${id}/cancel`);
		}
	},

	// タスクログの取得
	async getLogs(id: string): Promise<TaskLogResponse> {
		return apiClient.get<TaskLogResponse>(`/api/tasks/${id}/logs`);
	},

	// タスクログのストリーミング
	async streamLogs(id: string): Promise<ReadableStream> {
		return apiClient.stream(`/api/tasks/${id}/logs`);
	},

	// タスクの削除
	async delete(id: string): Promise<void> {
		return apiClient.delete(`/api/tasks/${id}`);
	}
};
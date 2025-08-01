// API状態管理ストア（Svelte 5 Runes使用）

import { ApiClient, ApiError } from '$lib/api/client';
import type { TaskResponse, TaskRequest, TaskStatus, PaginatedResponse } from '$lib/types/api';
import { authStore } from './auth.svelte';

// API呼び出しの状態を管理する汎用クラス
export class ApiState<T> {
	// Svelte 5のrunesを使用したリアクティブな状態管理
	data = $state<T | null>(null);
	loading = $state(false);
	error = $state<Error | null>(null);

	// データの取得成功判定
	get isSuccess() {
		return !this.loading && !this.error && this.data !== null;
	}

	// リセット
	reset() {
		this.data = null;
		this.loading = false;
		this.error = null;
	}

	// 非同期処理の実行
	async execute<R = T>(promise: Promise<R>, transform?: (data: R) => T): Promise<void> {
		this.loading = true;
		this.error = null;

		try {
			const result = await promise;
			this.data = transform ? transform(result) : (result as unknown as T);
		} catch (err) {
			this.error = err instanceof Error ? err : new Error('Unknown error');
			this.data = null;
		} finally {
			this.loading = false;
		}
	}
}

// タスク管理ストア
export class TaskStore {
	private client = new ApiClient();
	
	// タスク一覧の状態（ページネーション対応）
	tasks = $state<PaginatedResponse<TaskResponse> | null>(null);
	
	// 個別タスクの状態（IDをキーとしたMap）
	private taskStates = $state(new Map<string, ApiState<TaskResponse>>());

	// タスク一覧の取得
	async fetchTasks() {
		// Note: この関数は現在使用されていません。
		// ページのload関数で直接taskServiceを使用しています。
	}

	// 特定のタスクの状態を取得（存在しない場合は作成）
	getTaskState(taskId: string): ApiState<TaskResponse> {
		if (!this.taskStates.has(taskId)) {
			this.taskStates.set(taskId, new ApiState<TaskResponse>());
		}
		return this.taskStates.get(taskId)!;
	}

	// タスクの取得
	async fetchTask(taskId: string) {
		const state = this.getTaskState(taskId);
		await state.execute(
			this.client.get<TaskResponse>(`/api/tasks/${taskId}`)
		);
		
		// タスク一覧も更新
		if (this.tasks?.data && state.data) {
			const index = this.tasks.data.findIndex(t => t.taskId === taskId);
			if (index >= 0) {
				this.tasks.data[index] = state.data;
			}
		}
	}

	// タスクの作成
	async createTask(request: TaskRequest) {
		const newTaskState = new ApiState<TaskResponse>();
		await newTaskState.execute(
			this.client.post<TaskResponse>('/api/tasks', request)
		);

		// 成功した場合、タスク一覧に追加
		if (newTaskState.data && this.tasks?.data) {
			this.tasks.data = [...this.tasks.data, newTaskState.data];
			this.taskStates.set(newTaskState.data.taskId, newTaskState);
		}

		return newTaskState;
	}

	// タスクのキャンセル
	async cancelTask(taskId: string) {
		const state = this.getTaskState(taskId);
		await state.execute(
			this.client.post<TaskResponse>(`/api/tasks/${taskId}/cancel`)
		);
		
		// キャンセル成功時、ステータスを更新
		if (state.data && this.tasks?.data) {
			const task = this.tasks.data.find(t => t.taskId === taskId);
			if (task) {
				task.status = 'cancelled' as TaskStatus;
			}
		}
	}

	// タスクログの取得（ストリーミング対応）
	async *streamTaskLogs(taskId: string): AsyncGenerator<string> {
		const response = await fetch(`/api/tasks/${taskId}/logs`, {
			headers: {
				'Accept': 'text/event-stream',
				...authStore.getAuthHeaders()
			}
		});

		if (!response.ok) {
			throw new ApiError(response.status, response.statusText);
		}

		const reader = response.body?.getReader();
		if (!reader) throw new Error('No response body');

		const decoder = new TextDecoder();
		
		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				
				const chunk = decoder.decode(value);
				const lines = chunk.split('\n');
				
				for (const line of lines) {
					if (line.startsWith('data: ')) {
						yield line.substring(6);
					}
				}
			}
		} finally {
			reader.releaseLock();
		}
	}

	// クリーンアップ
	cleanup() {
		this.tasks = null;
		this.taskStates.clear();
	}
}

// シングルトンインスタンス
export const taskStore = new TaskStore();
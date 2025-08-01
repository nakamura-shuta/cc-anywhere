// タスク詳細ページのデータロード

import type { PageLoad } from './$types';
import { taskService } from '$lib/services/task.service';
import { error } from '@sveltejs/kit';
import type { TaskResponse } from '$lib/types/api';
import { browser } from '$app/environment';
import { authStore } from '$lib/stores/auth.svelte';

// このページは動的データを扱うため、プリレンダリングを無効化
export const prerender = false;

export const load: PageLoad = async ({ params }) => {
	// SSRを避けてクライアントサイドでのみ実行
	if (!browser) {
		return {
			task: null as TaskResponse | null,
			logs: [],
			childTasks: []
		};
	}
	
	// authStoreの初期化を待つ
	await authStore.waitForInit();
	
	try {
		// タスクの詳細を取得
		const task = await taskService.get(params.id);
		
		// ログも取得
		const logs = await taskService.getLogs(params.id);
		
		// このタスクから作成された継続タスクを取得
		let childTasks: TaskResponse[] = [];
		try {
			// 全タスクを取得して、このタスクを親とするタスクをフィルタリング
			const allTasks = await taskService.list({ limit: 100 });
			childTasks = allTasks.filter(
				(t: TaskResponse) => t.continuedFrom === params.id || t.parentTaskId === params.id
			);
		} catch (err) {
			console.error('Failed to load child tasks:', err);
		}
		
		return {
			task,
			logs,
			childTasks
		};
	} catch (err) {
		console.error('Failed to load task:', err);
		// 404エラー
		error(404, 'タスクが見つかりません');
	}
};
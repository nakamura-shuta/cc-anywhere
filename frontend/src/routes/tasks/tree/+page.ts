import type { PageLoad } from './$types';
import { taskService } from '$lib/services/task.service';
import { browser } from '$app/environment';
import { authStore } from '$lib/stores/auth.svelte';

// このページは動的データを扱うため、プリレンダリングを無効化
export const prerender = false;

export const load: PageLoad = async () => {
	// SSRを避けてクライアントサイドでのみ実行
	if (!browser) {
		return {
			tasks: []
		};
	}

	// authStoreの初期化を待つ
	await authStore.waitForInit();

	try {
		// 全タスクを取得（ツリー表示のため）
		const tasks = await taskService.list({ limit: 1000 });
		
		return {
			tasks: tasks || []
		};
	} catch (error) {
		console.error('Failed to load tasks:', error);
		return {
			tasks: []
		};
	}
};
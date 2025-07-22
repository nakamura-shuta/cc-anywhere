// タスク詳細ページのデータロード

import type { PageLoad } from './$types';
import { taskService } from '$lib/services/task.service';
import { error } from '@sveltejs/kit';

// このページは動的データを扱うため、プリレンダリングを無効化
export const prerender = false;

export const load: PageLoad = async ({ params }) => {
	try {
		// タスクの詳細を取得
		const task = await taskService.get(params.id);
		
		// ログも取得
		const logs = await taskService.getLogs(params.id);
		
		return {
			task,
			logs: logs.logs
		};
	} catch (err) {
		console.error('Failed to load task:', err);
		// 404エラー
		error(404, 'タスクが見つかりません');
	}
};
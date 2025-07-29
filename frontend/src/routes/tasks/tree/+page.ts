import type { PageLoad } from './$types';
import { taskService } from '$lib/services/task.service';

export const load: PageLoad = async () => {
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
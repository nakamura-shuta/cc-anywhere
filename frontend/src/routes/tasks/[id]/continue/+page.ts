import type { PageLoad } from './$types';
import { apiClient } from '$lib/api/client';
import { error } from '@sveltejs/kit';
import type { TaskResponse } from '$lib/types/api';

export const load: PageLoad = async ({ params }) => {
	const parentTaskId = params.id;
	
	try {
		// 親タスクの情報を取得
		const parentTask = await apiClient.get<TaskResponse>(`/api/tasks/${parentTaskId}`);
		
		// 親タスクが完了していない場合はエラー
		if (parentTask.status !== 'completed') {
			throw error(400, 'タスクが完了していません。完了したタスクのみ継続できます。');
		}
		
		return {
			parentTask
		};
	} catch (err) {
		console.error('Failed to load parent task:', err);
		throw error(404, 'タスクが見つかりません');
	}
};
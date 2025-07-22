// タスク一覧ページのデータロード

import type { PageLoad } from './$types';
import { taskService } from '$lib/services/task.service';
import { error } from '@sveltejs/kit';

// このページは動的データを扱うため、プリレンダリングを無効化
export const prerender = false;

export const load: PageLoad = async ({ url }) => {
	// URLパラメータからページネーション情報を取得
	const page = Number(url.searchParams.get('page')) || 1;
	const limit = Number(url.searchParams.get('limit')) || 20;
	const sort = url.searchParams.get('sort') || 'createdAt';
	const order = (url.searchParams.get('order') || 'desc') as 'asc' | 'desc';

	try {
		// APIからタスク一覧を取得
		const response = await taskService.list({
			page,
			limit,
			sort,
			order
		});

		return {
			tasks: response.data,
			pagination: response.pagination
		};
	} catch (err) {
		console.error('Failed to load tasks:', err);
		// エラーページを表示
		error(500, 'タスクの読み込みに失敗しました');
	}
};
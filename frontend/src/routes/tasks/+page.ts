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
		// クライアントサイドでの実行確認のためデバッグログ
		if (typeof window !== 'undefined') {
			console.log('Client-side load function executing');
			console.log('Current URL:', window.location.href);
		}

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
		// API接続エラーの詳細をログ出力
		if (err instanceof Error) {
			console.error('Error details:', {
				message: err.message,
				stack: err.stack
			});
		}
		// エラーページを表示
		error(500, 'タスクの読み込みに失敗しました');
	}
};
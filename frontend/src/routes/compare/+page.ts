// 比較タスク一覧ページのデータロード

import type { PageLoad } from './$types';
import { compareService } from '$lib/services/compare.service';
import { repositoryService } from '$lib/services/repository.service';
import { error } from '@sveltejs/kit';
import { browser } from '$app/environment';
import { authStore } from '$lib/stores/auth.svelte';

// このページは動的データを扱うため、プリレンダリングを無効化
export const prerender = false;

export const load: PageLoad = async ({ url }) => {
	// SSRを避けてクライアントサイドでのみ実行
	if (!browser) {
		return {
			compareTasks: [],
			repositories: [],
			pagination: {
				page: 1,
				limit: 20,
				total: 0,
				totalPages: 0
			}
		};
	}

	// authStoreの初期化を待つ
	await authStore.waitForInit();

	// URLパラメータからページネーション情報を取得
	const page = Number(url.searchParams.get('page')) || 1;
	const limit = Number(url.searchParams.get('limit')) || 20;

	try {
		// APIから比較タスク一覧とリポジトリ一覧を並行取得
		const offset = (page - 1) * limit;
		const [compareResponse, repositories] = await Promise.all([
			compareService.list({ limit, offset }),
			repositoryService.list()
		]);

		return {
			compareTasks: compareResponse.tasks,
			repositories,
			pagination: {
				page,
				limit,
				total: compareResponse.total,
				totalPages: Math.ceil(compareResponse.total / limit)
			}
		};
	} catch (err) {
		console.error('Failed to load compare tasks:', err);
		// エラーページを表示
		error(500, '比較タスクの読み込みに失敗しました');
	}
};

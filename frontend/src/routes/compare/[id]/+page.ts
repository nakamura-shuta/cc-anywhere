// 比較タスク詳細ページのデータロード

import type { PageLoad } from './$types';
import { compareService } from '$lib/services/compare.service';
import { error } from '@sveltejs/kit';
import { browser } from '$app/environment';
import { authStore } from '$lib/stores/auth.svelte';

// このページは動的データを扱うため、プリレンダリングを無効化
export const prerender = false;

export const load: PageLoad = async ({ params }) => {
	// SSRを避けてクライアントサイドでのみ実行
	if (!browser) {
		return {
			compareTask: null,
			files: null
		};
	}

	// authStoreの初期化を待つ
	await authStore.waitForInit();

	try {
		// 比較タスク詳細と変更ファイル一覧を並行取得
		const [compareTask, files] = await Promise.all([
			compareService.get(params.id),
			compareService.getFiles(params.id).catch(() => null) // ファイル取得失敗時はnull
		]);

		return {
			compareTask,
			files
		};
	} catch (err) {
		console.error('Failed to load compare task:', err);
		error(404, '比較タスクが見つかりません');
	}
};

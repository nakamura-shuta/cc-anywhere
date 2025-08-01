// タスク一覧ページのデータロード

import type { PageLoad } from './$types';
import { apiClient, ApiError } from '$lib/api/client';
import type { TaskResponse } from '$lib/types/api';
import { error } from '@sveltejs/kit';
import { browser } from '$app/environment';
import { authStore } from '$lib/stores/auth.svelte';

// このページは動的データを扱うため、プリレンダリングを無効化
export const prerender = false;

export const load: PageLoad = async ({ url }) => {
	// SSRを避けてクライアントサイドでのみ実行
	if (!browser) {
		return {
			tasks: [],
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

		// APIからタスク一覧を取得
		const offset = (page - 1) * limit;
		const response = await apiClient.get<{ tasks: TaskResponse[], total: number, limit: number, offset: number }>('/api/tasks', {
			params: {
				limit,
				offset
			}
		});

		return {
			tasks: response.tasks,
			pagination: {
				page,
				limit,
				total: response.total,
				totalPages: Math.ceil(response.total / limit)
			}
		};
	} catch (err) {
		console.error('Failed to load tasks:', err);
		// エラーページを表示
		error(500, 'タスクの読み込みに失敗しました');
	}
};
// タスク一覧ページのデータロード

import type { PageLoad } from './$types';
import { apiClient } from '$lib/api/client';
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
	const status = url.searchParams.get('status') || undefined;
	const repository = url.searchParams.get('repository') || undefined;

	try {

		// APIからタスク一覧を取得
		const offset = (page - 1) * limit;
		const params: any = {
			limit,
			offset
		};
		
		// ステータスフィルターがある場合は追加
		if (status && status !== 'all') {
			params.status = status;
		}
		
		// リポジトリフィルターがある場合は追加
		if (repository) {
			params.repository = repository;
		}
		
		const response = await apiClient.get<{ tasks: TaskResponse[], total: number, limit: number, offset: number }>('/api/tasks', {
			params
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
// SPA（シングルページアプリケーション）として動作させる設定
// これにより、すべてのルーティングがクライアントサイドで処理される

import { redirect } from '@sveltejs/kit';
import type { LayoutLoad } from './$types';
import { authStore } from '$lib/stores/auth.svelte';
import { browser } from '$app/environment';

// プリレンダリングを無効化（SPAなので不要）
export const prerender = false;

// サーバーサイドレンダリングを無効化（SPAモード）
export const ssr = false;

// クライアントサイドレンダリングを有効化
export const csr = true;

export const load: LayoutLoad = async ({ url }) => {
	// ブラウザ環境でのみ認証チェック
	if (!browser) return {};
	
	// 認証エラーページは認証チェックをスキップ
	if (url.pathname === '/auth/error') {
		return {};
	}
	
	// 認証状態を確認
	const authStatus = await authStore.checkAuth();
	
	// QR認証が無効な場合はスキップ
	if (!authStatus.enabled || !authStatus.requiresAuth) {
		return {};
	}
	
	// URLパラメータから認証トークンを取得
	const token = url.searchParams.get('auth_token');
	
	// トークンがある場合は認証を試みる
	if (token) {
		const success = await authStore.authenticate(token);
		if (success) {
			// 認証成功後、URLからトークンを削除してリダイレクト
			const cleanUrl = new URL(url);
			cleanUrl.searchParams.delete('auth_token');
			throw redirect(307, cleanUrl.pathname + cleanUrl.search);
		}
	}
	
	// 認証済みでない場合はエラーページへ
	if (!authStore.isAuthenticated) {
		throw redirect(307, '/auth/error');
	}
	
	return {};
};
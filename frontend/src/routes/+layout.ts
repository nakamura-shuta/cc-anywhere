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
	
	// URLパラメータから認証トークンを取得（トップページでも処理するため先に取得）
	const token = url.searchParams.get('auth_token');
	
	// 認証エラーページは認証チェックをスキップ
	// トップページはauth_tokenがない場合のみスキップ
	if (url.pathname === '/auth/error' || (url.pathname === '/' && !token)) {
		return {};
	}
	
	// 認証状態を確認
	const authStatus = await authStore.checkAuth();
	
	// QR認証が無効な場合はスキップ
	if (!authStatus.enabled || !authStatus.requiresAuth) {
		return {};
	}
	
	
	// トークンがある場合は認証を試みる
	if (token) {
		const success = await authStore.authenticate(token);
		if (success) {
			// 認証成功後、URLからトークンを削除してリダイレクト
			const cleanUrl = new URL(url);
			cleanUrl.searchParams.delete('auth_token');
			// 認証情報を確実に保存するために少し待つ
			await new Promise(resolve => setTimeout(resolve, 100));
			throw redirect(307, cleanUrl.pathname + cleanUrl.search);
		}
	}
	
	// 認証済みでない場合はエラーページへ
	if (!authStore.isAuthenticated) {
		// ローカルアクセスの場合は認証をスキップ
		const hostname = url.hostname;
		if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.includes('localhost')) {
			return {};
		}
		
		// トークンがURLに含まれている場合は、認証処理中の可能性があるので少し待つ
		if (token) {
			await new Promise(resolve => setTimeout(resolve, 500));
			// 再度認証状態を確認
			await authStore.checkAuth();
			if (authStore.isAuthenticated) {
				return {};
			}
		}
		// URLパラメータを保持してリダイレクト
		const errorUrl = new URL('/auth/error', url.origin);
		if (token) {
			errorUrl.searchParams.set('auth_token', token);
		}
		throw redirect(307, errorUrl.toString());
	}
	
	return {};
};
// API設定
// 開発時とプロダクション時で異なるAPIエンドポイントを管理

import { browser } from '$app/environment';
import { dev } from '$app/environment';

// APIのベースURL取得関数（動的評価）
export const getApiBaseUrl = (): string => {
	// クライアントサイドでの実行時
	if (typeof window !== 'undefined') {
		// 開発環境では別ポートのバックエンドを使用
		if (dev) {
			return 'http://localhost:5000';
		}
		// プロダクション環境では現在のオリジンを使用
		return window.location.origin;
	}
	// ビルド時やSSR時のデフォルト値
	return '';
};

// 後方互換性のため、API_BASE_URLを維持（ただし関数として使用）
export const API_BASE_URL = getApiBaseUrl();

// APIエンドポイント（動的生成）
export const API_ENDPOINTS = {
	// タスク関連
	get tasks() { return `${getApiBaseUrl()}/api/tasks`; },
	task: (id: string) => `${getApiBaseUrl()}/api/tasks/${id}`,
	taskCancel: (id: string) => `${getApiBaseUrl()}/api/tasks/${id}/cancel`,
	taskLogs: (id: string) => `${getApiBaseUrl()}/api/tasks/${id}/logs`,
	
	// バッチタスク
	get batchTasks() { return `${getApiBaseUrl()}/api/batch/tasks`; },
	batchTaskStatus: (groupId: string) => `${getApiBaseUrl()}/api/batch/tasks/${groupId}/status`,
	
	// プリセット
	get presets() { return `${getApiBaseUrl()}/api/presets`; },
	preset: (id: string) => `${getApiBaseUrl()}/api/presets/${id}`,
	
	// スケジュール
	get schedules() { return `${getApiBaseUrl()}/api/schedules`; },
	schedule: (id: string) => `${getApiBaseUrl()}/api/schedules/${id}`,
	
	// セッション
	get sessions() { return `${getApiBaseUrl()}/api/sessions`; },
	session: (id: string) => `${getApiBaseUrl()}/api/sessions/${id}`,
	
	// ヘルスチェック
	get health() { return `${getApiBaseUrl()}/api/health`; },
	
	// WebSocket
	get websocket() {
		if (typeof window !== 'undefined') {
			const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
			if (dev) {
				return 'ws://localhost:5000/ws';
			}
			return `${protocol}//${window.location.host}/ws`;
		}
		return dev ? 'ws://localhost:5000/ws' : '';
	}
};

// APIキーの取得
export const getApiKey = (): string | null => {
	if (browser) {
		// ローカルストレージから取得（設定画面で保存された場合）
		const storedKey = localStorage.getItem('cc-anywhere-api-key');
		if (storedKey) return storedKey;
		
		// 開発環境のデフォルトAPIキー
		if (dev) {
			return 'hoge';
		}
	}
	return null;
};

// APIキーの保存
export const setApiKey = (key: string): void => {
	if (browser) {
		localStorage.setItem('cc-anywhere-api-key', key);
	}
};

// APIリクエストのヘッダー
export const getApiHeaders = (): HeadersInit => {
	const headers: HeadersInit = {
		'Content-Type': 'application/json'
	};
	
	const apiKey = getApiKey();
	if (apiKey) {
		headers['X-API-Key'] = apiKey;
	}
	
	return headers;
};
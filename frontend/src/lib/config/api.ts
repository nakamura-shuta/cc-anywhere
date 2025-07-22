// API設定
// 開発時とプロダクション時で異なるAPIエンドポイントを管理

import { browser } from '$app/environment';
import { dev } from '$app/environment';

// APIのベースURL
export const API_BASE_URL = (() => {
	// ブラウザ環境の場合
	if (browser) {
		// 開発環境では別ポートのバックエンドを使用
		if (dev) {
			return 'http://localhost:5000';
		}
		// プロダクション環境では同一オリジン（相対パス）
		return '';
	}
	// SSR時はlocalhost経由
	return dev ? 'http://localhost:5000' : '';
})();

// APIエンドポイント
export const API_ENDPOINTS = {
	// タスク関連
	tasks: `${API_BASE_URL}/api/tasks`,
	task: (id: string) => `${API_BASE_URL}/api/tasks/${id}`,
	taskCancel: (id: string) => `${API_BASE_URL}/api/tasks/${id}/cancel`,
	taskLogs: (id: string) => `${API_BASE_URL}/api/tasks/${id}/logs`,
	
	// バッチタスク
	batchTasks: `${API_BASE_URL}/api/batch/tasks`,
	batchTaskStatus: (groupId: string) => `${API_BASE_URL}/api/batch/tasks/${groupId}/status`,
	
	// プリセット
	presets: `${API_BASE_URL}/api/presets`,
	preset: (id: string) => `${API_BASE_URL}/api/presets/${id}`,
	
	// スケジュール
	schedules: `${API_BASE_URL}/api/schedules`,
	schedule: (id: string) => `${API_BASE_URL}/api/schedules/${id}`,
	
	// セッション
	sessions: `${API_BASE_URL}/api/sessions`,
	session: (id: string) => `${API_BASE_URL}/api/sessions/${id}`,
	
	// ヘルスチェック
	health: `${API_BASE_URL}/api/health`,
	
	// WebSocket
	websocket: (() => {
		if (browser) {
			const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
			if (dev) {
				return 'ws://localhost:5000';
			}
			return `${protocol}//${window.location.host}`;
		}
		return dev ? 'ws://localhost:5000' : '';
	})()
};

// APIキーの取得
export const getApiKey = (): string | null => {
	if (browser) {
		// ローカルストレージから取得（設定画面で保存された場合のみ）
		return localStorage.getItem('cc-anywhere-api-key');
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
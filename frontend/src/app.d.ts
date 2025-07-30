// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces

// SvelteKitアプリケーション全体で使用される型定義を宣言するファイル
declare global {
	namespace App {
		// エラーオブジェクトの型定義
		// アプリケーション全体で統一されたエラー形式を定義
		interface Error {
			message: string;
			code?: string;
		}

		// ローカル変数の型定義
		// load関数やserver関数で使用される変数の型
		// interface Locals {}

		// ページデータの型定義
		// +page.svelteで受け取るdataプロパティの型
		// interface PageData {}

		// ページの状態の型定義
		// ナビゲーション時に保持される状態の型
		// interface PageState {}

		// プラットフォーム固有の型定義
		// Cloudflare WorkersやVercelなど、特定のプラットフォームに依存する型
		// interface Platform {}
	}

	// WebSocket統合のグローバル型
	interface Window {
		__wsIntegration?: {
			ws: import('$lib/stores/websocket-enhanced.svelte').EnhancedWebSocketStore;
			router: import('$lib/stores/message-router.svelte').MessageRouter;
			cleanup: () => void;
		};
	}
}

export {};
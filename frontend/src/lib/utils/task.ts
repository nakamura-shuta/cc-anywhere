/**
 * タスク関連の共通ユーティリティ関数
 */

import type { TaskStatus } from '$lib/types/api';

/**
 * タスクのステータスに応じたバッジのバリアントを取得
 * @param status - タスクのステータス
 * @returns バッジのバリアント
 */
export function getStatusVariant(status: string | TaskStatus) {
	switch (status) {
		case 'completed': return 'default';
		case 'running': return 'secondary';
		case 'failed': return 'destructive';
		case 'cancelled': return 'outline';
		case 'pending': return 'secondary';
		default: return 'secondary';
	}
}

/**
 * タスクのステータスラベルを取得
 * @param status - タスクのステータス
 * @returns 日本語のステータスラベル
 */
export function getStatusLabel(status: string | TaskStatus): string {
	switch (status) {
		case 'pending': return '待機中';
		case 'running': return '実行中';
		case 'completed': return '完了';
		case 'failed': return '失敗';
		case 'cancelled': return 'キャンセル';
		case 'timeout': return 'タイムアウト';
		default: return status;
	}
}

/**
 * タスクのステータスアイコンのCSSクラスを取得
 * @param status - タスクのステータス
 * @returns アイコンのCSSクラス
 */
export function getStatusIconClass(status: string | TaskStatus): string {
	switch (status) {
		case 'completed': return 'text-green-600 dark:text-green-400';
		case 'running': return 'text-blue-600 dark:text-blue-400 animate-spin';
		case 'failed': return 'text-red-600 dark:text-red-400';
		case 'cancelled': return 'text-gray-600 dark:text-gray-400';
		case 'pending': return 'text-yellow-600 dark:text-yellow-400';
		default: return 'text-gray-600 dark:text-gray-400';
	}
}
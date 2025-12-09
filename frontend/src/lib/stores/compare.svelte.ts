import { compareService } from '$lib/services/compare.service';
import type {
	CreateCompareTaskRequest,
	CreateCompareTaskResponse,
	CompareTaskDetailResponse,
	CompareFilesResponse
} from '$lib/types/api';

/**
 * 比較モードストア
 * Claude, Codex, Geminiの同時実行結果を比較するための状態管理
 */
class CompareStore {
	// 状態管理
	items = $state<CompareTaskDetailResponse[]>([]);
	selectedId = $state<string | null>(null);
	loading = $state(false);
	error = $state<Error | null>(null);
	total = $state(0);

	// 選択中のタスク
	selected = $derived(this.items.find((item) => item.compareId === this.selectedId) || null);

	// カウント
	count = $derived(this.items.length);
	isEmpty = $derived(this.items.length === 0);

	// ステータス別カウント
	runningCount = $derived(this.items.filter((t) => t.status === 'running').length);
	completedCount = $derived(this.items.filter((t) => t.status === 'completed').length);
	failedCount = $derived(this.items.filter((t) => t.status === 'failed').length);

	constructor() {
		console.log('[compareStore] Initialized');
	}

	/**
	 * 比較タスク一覧を読み込み
	 */
	async load(params?: { limit?: number; offset?: number }): Promise<void> {
		try {
			this.loading = true;
			this.error = null;
			const response = await compareService.list(params);
			this.items = response.tasks;
			this.total = response.total;
		} catch (err) {
			this.error = err instanceof Error ? err : new Error('Failed to load compare tasks');
			console.error('[compareStore] Load error:', err);
		} finally {
			this.loading = false;
		}
	}

	/**
	 * 比較タスク詳細を取得
	 */
	async getById(compareId: string): Promise<CompareTaskDetailResponse | null> {
		try {
			this.loading = true;
			this.error = null;
			const item = await compareService.get(compareId);
			// 既存のアイテムを更新または追加
			const index = this.items.findIndex((i) => i.compareId === compareId);
			if (index >= 0) {
				this.items = [...this.items.slice(0, index), item, ...this.items.slice(index + 1)];
			} else {
				this.items = [...this.items, item];
			}
			return item;
		} catch (err) {
			this.error = err instanceof Error ? err : new Error('Failed to get compare task');
			console.error('[compareStore] Get error:', err);
			return null;
		} finally {
			this.loading = false;
		}
	}

	/**
	 * 比較タスクを作成
	 * @returns 作成されたタスクのcompareId、失敗時はnull
	 */
	async create(data: CreateCompareTaskRequest): Promise<CreateCompareTaskResponse | null> {
		try {
			this.loading = true;
			this.error = null;
			const response = await compareService.create(data);
			// リストを再読み込み
			await this.load();
			return response;
		} catch (err) {
			this.error = err instanceof Error ? err : new Error('Failed to create compare task');
			console.error('[compareStore] Create error:', err);
			return null;
		} finally {
			this.loading = false;
		}
	}

	/**
	 * 比較タスクをキャンセル
	 */
	async cancel(compareId: string): Promise<boolean> {
		try {
			this.loading = true;
			this.error = null;
			await compareService.cancel(compareId);
			// ローカル状態を更新
			const index = this.items.findIndex((i) => i.compareId === compareId);
			if (index >= 0) {
				const updated = { ...this.items[index], status: 'cancelled' as const };
				this.items = [...this.items.slice(0, index), updated, ...this.items.slice(index + 1)];
			}
			return true;
		} catch (err) {
			this.error = err instanceof Error ? err : new Error('Failed to cancel compare task');
			console.error('[compareStore] Cancel error:', err);
			return false;
		} finally {
			this.loading = false;
		}
	}

	/**
	 * 変更ファイル一覧を取得
	 */
	async getFiles(id: string): Promise<CompareFilesResponse | null> {
		try {
			return await compareService.getFiles(id);
		} catch (err) {
			console.error('[compareStore] Get files error:', err);
			return null;
		}
	}

	/**
	 * 選択中のタスクIDを設定
	 */
	select(id: string | null): void {
		this.selectedId = id;
	}

	/**
	 * エラーをクリア
	 */
	clearError(): void {
		this.error = null;
	}
}

// シングルトンインスタンス
export const compareStore = new CompareStore();

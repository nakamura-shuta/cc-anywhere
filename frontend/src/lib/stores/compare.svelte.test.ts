// 比較ストアのテスト
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { compareService } from '$lib/services/compare.service';
import type {
	CompareTaskDetailResponse,
	CompareTaskListResponse,
	CreateCompareTaskResponse,
	CompareFilesResponse
} from '$lib/types/api';

// compareServiceのモック
vi.mock('$lib/services/compare.service', () => ({
	compareService: {
		list: vi.fn(),
		get: vi.fn(),
		create: vi.fn(),
		cancel: vi.fn(),
		getFiles: vi.fn()
	}
}));

// compareStoreを動的にインポート（モックの後にインポートするため）
const getCompareStore = async () => {
	const module = await import('./compare.svelte');
	return module.compareStore;
};

describe('compareStore', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('load', () => {
		it('比較タスク一覧を読み込む', async () => {
			const mockResponse: CompareTaskListResponse = {
				tasks: [
					{
						compareId: 'compare-1',
						instruction: 'Test instruction',
						repositoryId: 'test-repo',
						baseCommit: 'abc123',
						status: 'completed',
						claudeTaskId: 'task-claude-1',
						codexTaskId: 'task-codex-1',
						geminiTaskId: 'task-gemini-1',
						createdAt: '2024-01-01T00:00:00Z',
						completedAt: '2024-01-01T01:00:00Z'
					}
				],
				total: 1,
				limit: 20,
				offset: 0
			};

			vi.mocked(compareService.list).mockResolvedValueOnce(mockResponse);

			const compareStore = await getCompareStore();
			await compareStore.load();

			expect(compareStore.items).toEqual(mockResponse.tasks);
			expect(compareStore.total).toBe(1);
			expect(compareService.list).toHaveBeenCalled();
		});

		it('読み込みエラー時にエラーを設定', async () => {
			const error = new Error('Failed to load');
			vi.mocked(compareService.list).mockRejectedValueOnce(error);

			const compareStore = await getCompareStore();
			await compareStore.load();

			expect(compareStore.error).toBeTruthy();
			expect(compareStore.error?.message).toBe('Failed to load');
		});
	});

	describe('getById', () => {
		it('比較タスク詳細を取得', async () => {
			const mockTask: CompareTaskDetailResponse = {
				compareId: 'compare-1',
				instruction: 'Test instruction',
				repositoryId: 'test-repo',
				baseCommit: 'abc123',
				status: 'running',
				claudeTaskId: 'task-claude-1',
				codexTaskId: 'task-codex-1',
				geminiTaskId: null,
				createdAt: '2024-01-01T00:00:00Z',
				completedAt: null
			};

			vi.mocked(compareService.get).mockResolvedValueOnce(mockTask);

			const compareStore = await getCompareStore();
			const result = await compareStore.getById('compare-1');

			expect(result).toEqual(mockTask);
			expect(compareService.get).toHaveBeenCalledWith('compare-1');
		});

		it('取得エラー時にnullを返す', async () => {
			vi.mocked(compareService.get).mockRejectedValueOnce(new Error('Not found'));

			const compareStore = await getCompareStore();
			const result = await compareStore.getById('non-existent');

			expect(result).toBeNull();
			expect(compareStore.error).toBeTruthy();
		});
	});

	describe('create', () => {
		it('比較タスクを作成', async () => {
			const createResponse: CreateCompareTaskResponse = {
				compareId: 'compare-new',
				claudeTaskId: 'task-claude-new',
				codexTaskId: 'task-codex-new',
				geminiTaskId: 'task-gemini-new',
				status: 'pending'
			};

			const listResponse: CompareTaskListResponse = {
				tasks: [],
				total: 0,
				limit: 20,
				offset: 0
			};

			vi.mocked(compareService.create).mockResolvedValueOnce(createResponse);
			vi.mocked(compareService.list).mockResolvedValueOnce(listResponse);

			const compareStore = await getCompareStore();
			const result = await compareStore.create({
				instruction: 'Test instruction',
				repositoryId: 'test-repo'
			});

			expect(result).toEqual(createResponse);
			expect(compareService.create).toHaveBeenCalledWith({
				instruction: 'Test instruction',
				repositoryId: 'test-repo'
			});
			// 作成後にリストを再読み込み
			expect(compareService.list).toHaveBeenCalled();
		});

		it('作成エラー時にnullを返す', async () => {
			vi.mocked(compareService.create).mockRejectedValueOnce(new Error('Creation failed'));

			const compareStore = await getCompareStore();
			const result = await compareStore.create({
				instruction: 'Test instruction',
				repositoryId: 'test-repo'
			});

			expect(result).toBeNull();
			expect(compareStore.error).toBeTruthy();
		});
	});

	describe('cancel', () => {
		it('比較タスクをキャンセル', async () => {
			vi.mocked(compareService.cancel).mockResolvedValueOnce(undefined);

			// 先にタスクをセットアップ
			const mockListResponse: CompareTaskListResponse = {
				tasks: [
					{
						compareId: 'compare-1',
						instruction: 'Test',
						repositoryId: 'repo',
						baseCommit: 'abc123',
						status: 'running',
						claudeTaskId: 'task-1',
						codexTaskId: null,
						geminiTaskId: null,
						createdAt: '2024-01-01T00:00:00Z',
						completedAt: null
					}
				],
				total: 1,
				limit: 20,
				offset: 0
			};
			vi.mocked(compareService.list).mockResolvedValueOnce(mockListResponse);

			const compareStore = await getCompareStore();
			await compareStore.load();

			const result = await compareStore.cancel('compare-1');

			expect(result).toBe(true);
			expect(compareService.cancel).toHaveBeenCalledWith('compare-1');
			// ローカル状態が更新される
			const task = compareStore.items.find((t) => t.compareId === 'compare-1');
			expect(task?.status).toBe('cancelled');
		});

		it('キャンセルエラー時にfalseを返す', async () => {
			vi.mocked(compareService.cancel).mockRejectedValueOnce(new Error('Cancel failed'));

			const compareStore = await getCompareStore();
			const result = await compareStore.cancel('compare-1');

			expect(result).toBe(false);
			expect(compareStore.error).toBeTruthy();
		});
	});

	describe('getFiles', () => {
		it('変更ファイル一覧を取得', async () => {
			const mockFiles: CompareFilesResponse = {
				files: [
					{ path: 'src/index.ts', claude: 'M', codex: 'M', gemini: null }
				],
				truncated: false,
				totalCount: 1
			};

			vi.mocked(compareService.getFiles).mockResolvedValueOnce(mockFiles);

			const compareStore = await getCompareStore();
			const result = await compareStore.getFiles('compare-1');

			expect(result).toEqual(mockFiles);
			expect(compareService.getFiles).toHaveBeenCalledWith('compare-1');
		});

		it('取得エラー時にnullを返す', async () => {
			vi.mocked(compareService.getFiles).mockRejectedValueOnce(new Error('Not found'));

			const compareStore = await getCompareStore();
			const result = await compareStore.getFiles('compare-1');

			expect(result).toBeNull();
		});
	});

	describe('select', () => {
		it('選択IDを設定', async () => {
			const compareStore = await getCompareStore();

			compareStore.select('compare-1');
			expect(compareStore.selectedId).toBe('compare-1');

			compareStore.select(null);
			expect(compareStore.selectedId).toBeNull();
		});
	});

	describe('clearError', () => {
		it('エラーをクリア', async () => {
			vi.mocked(compareService.list).mockRejectedValueOnce(new Error('Test error'));

			const compareStore = await getCompareStore();
			await compareStore.load();
			expect(compareStore.error).toBeTruthy();

			compareStore.clearError();
			expect(compareStore.error).toBeNull();
		});
	});
});

// 比較サービスのテスト
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { compareService } from './compare.service';
import { apiClient } from '$lib/api/client';
import type {
	CreateCompareTaskRequest,
	CompareTaskDetailResponse,
	CompareTaskListResponse,
	CreateCompareTaskResponse,
	CompareFilesResponse
} from '$lib/types/api';

// apiClientのモック
vi.mock('$lib/api/client', () => ({
	apiClient: {
		get: vi.fn(),
		post: vi.fn(),
		delete: vi.fn()
	}
}));

describe('compareService', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('list', () => {
		it('比較タスク一覧を取得', async () => {
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

			vi.mocked(apiClient.get).mockResolvedValueOnce(mockResponse);

			const result = await compareService.list({ limit: 20, offset: 0 });

			expect(result).toEqual(mockResponse);
			expect(apiClient.get).toHaveBeenCalledWith('/api/compare', {
				params: { limit: 20, offset: 0 }
			});
		});

		it('パラメータなしでデフォルト値を使用', async () => {
			const mockResponse: CompareTaskListResponse = {
				tasks: [],
				total: 0,
				limit: 20,
				offset: 0
			};

			vi.mocked(apiClient.get).mockResolvedValueOnce(mockResponse);

			const result = await compareService.list();

			expect(result).toEqual(mockResponse);
			expect(apiClient.get).toHaveBeenCalledWith('/api/compare', {
				params: undefined
			});
		});
	});

	describe('get', () => {
		it('比較タスク詳細を取得', async () => {
			const mockResponse: CompareTaskDetailResponse = {
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

			vi.mocked(apiClient.get).mockResolvedValueOnce(mockResponse);

			const result = await compareService.get('compare-1');

			expect(result).toEqual(mockResponse);
			expect(apiClient.get).toHaveBeenCalledWith('/api/compare/compare-1');
		});
	});

	describe('create', () => {
		it('比較タスクを作成', async () => {
			const request: CreateCompareTaskRequest = {
				instruction: 'Test instruction',
				repositoryId: 'test-repo'
			};

			const mockResponse: CreateCompareTaskResponse = {
				compareId: 'compare-new',
				claudeTaskId: 'task-claude-new',
				codexTaskId: 'task-codex-new',
				geminiTaskId: 'task-gemini-new',
				status: 'pending'
			};

			vi.mocked(apiClient.post).mockResolvedValueOnce(mockResponse);

			const result = await compareService.create(request);

			expect(result).toEqual(mockResponse);
			expect(apiClient.post).toHaveBeenCalledWith('/api/compare', request);
		});
	});

	describe('cancel', () => {
		it('比較タスクをキャンセル', async () => {
			vi.mocked(apiClient.delete).mockResolvedValueOnce(undefined);

			await compareService.cancel('compare-1');

			expect(apiClient.delete).toHaveBeenCalledWith('/api/compare/compare-1');
		});
	});

	describe('getFiles', () => {
		it('変更ファイル一覧を取得', async () => {
			const mockResponse: CompareFilesResponse = {
				files: [
					{
						path: 'src/index.ts',
						claude: 'M',
						codex: 'M',
						gemini: 'A'
					},
					{
						path: 'README.md',
						claude: 'A',
						codex: null,
						gemini: 'A'
					}
				],
				truncated: false,
				totalCount: 2
			};

			vi.mocked(apiClient.get).mockResolvedValueOnce(mockResponse);

			const result = await compareService.getFiles('compare-1');

			expect(result).toEqual(mockResponse);
			expect(apiClient.get).toHaveBeenCalledWith('/api/compare/compare-1/files');
		});

		it('多数のファイルがある場合はtruncated=trueを返す', async () => {
			const mockResponse: CompareFilesResponse = {
				files: Array(100).fill({
					path: 'file.ts',
					claude: 'M',
					codex: null,
					gemini: null
				}),
				truncated: true,
				totalCount: 500
			};

			vi.mocked(apiClient.get).mockResolvedValueOnce(mockResponse);

			const result = await compareService.getFiles('compare-1');

			expect(result.truncated).toBe(true);
			expect(result.totalCount).toBe(500);
			expect(result.files).toHaveLength(100);
		});
	});
});

// タスクサービスのテスト
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { taskService } from './task.service';
import { apiClient } from '$lib/api/client';

// apiClientのモック
vi.mock('$lib/api/client', () => ({
	apiClient: {
		get: vi.fn(),
		post: vi.fn(),
		delete: vi.fn(),
		stream: vi.fn()
	}
}));

describe('taskService', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});
	
	describe('list', () => {
		it('タスク一覧を取得', async () => {
			const mockApiResponse = {
				tasks: [
					{ id: '1', instruction: 'Task 1', status: 'completed' },
					{ id: '2', instruction: 'Task 2', status: 'running' }
				],
				total: 2,
				limit: 20,
				offset: 0
			};
			
			const expectedResponse = {
				data: mockApiResponse.tasks,
				pagination: {
					page: 1,
					limit: 20,
					total: 2,
					totalPages: 1,
					hasNext: false,
					hasPrev: false
				}
			};
			
			vi.mocked(apiClient.get).mockResolvedValueOnce(mockApiResponse);
			
			const result = await taskService.list({ page: 1, limit: 20 });
			
			expect(result).toEqual(expectedResponse);
			expect(apiClient.get).toHaveBeenCalledWith('/api/tasks', {
				params: { offset: 0, limit: 20 }
			});
		});
		
		it('ステータスでフィルタリング', async () => {
			const mockApiResponse = {
				tasks: [{ id: '1', instruction: 'Task 1', status: 'running' }],
				total: 1,
				limit: 20,
				offset: 0
			};
			
			vi.mocked(apiClient.get).mockResolvedValueOnce(mockApiResponse);
			
			await taskService.list({ status: 'running' });
			
			expect(apiClient.get).toHaveBeenCalledWith('/api/tasks', {
				params: { status: 'running' }
			});
		});
	});
	
	describe('create', () => {
		it('タスクを作成', async () => {
			const taskRequest = {
				instruction: 'Test task',
				context: { workingDirectory: '/test' }
			};
			
			const mockResponse = {
				id: '123',
				...taskRequest,
				status: 'pending',
				createdAt: '2024-01-01T00:00:00Z',
				updatedAt: '2024-01-01T00:00:00Z'
			};
			
			vi.mocked(apiClient.post).mockResolvedValueOnce(mockResponse);
			
			const result = await taskService.create(taskRequest);
			
			expect(result).toEqual(mockResponse);
			expect(apiClient.post).toHaveBeenCalledWith('/api/tasks', taskRequest);
		});
	});
	
	describe('cancel', () => {
		it('DELETEメソッドでキャンセルを試みる', async () => {
			const mockResponse = { id: '123', status: 'cancelled' };
			vi.mocked(apiClient.delete).mockResolvedValueOnce(mockResponse);
			
			const result = await taskService.cancel('123');
			
			expect(result).toEqual(mockResponse);
			expect(apiClient.delete).toHaveBeenCalledWith('/api/tasks/123');
		});
		
		it('DELETEが失敗したらPOSTメソッドを試す', async () => {
			const mockResponse = { id: '123', status: 'cancelled' };
			
			// taskService内でtry-catchを使っているため、実際のコードを修正
			const originalDelete = apiClient.delete;
			let deleteCallCount = 0;
			
			apiClient.delete = vi.fn().mockImplementation(() => {
				deleteCallCount++;
				throw new Error('Not found');
			});
			apiClient.post = vi.fn().mockResolvedValueOnce(mockResponse);
			
			const result = await taskService.cancel('123');
			
			expect(deleteCallCount).toBe(1);
			expect(result).toEqual(mockResponse);
			expect(apiClient.post).toHaveBeenCalledWith('/api/tasks/123/cancel');
			
			// 元に戻す
			apiClient.delete = originalDelete;
		});
	});
	
	describe('streamLogs', () => {
		it('ログのストリームを取得', async () => {
			const mockStream = new ReadableStream();
			vi.mocked(apiClient.stream).mockResolvedValueOnce(mockStream);
			
			const result = await taskService.streamLogs('123');
			
			expect(result).toBe(mockStream);
			expect(apiClient.stream).toHaveBeenCalledWith('/api/tasks/123/logs');
		});
	});
});
// APIクライアントのテスト
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiClient, ApiError } from './client';

describe('ApiClient', () => {
	let client: ApiClient;
	
	beforeEach(() => {
		client = new ApiClient('http://localhost:5000');
		vi.clearAllMocks();
	});
	
	describe('request', () => {
		it('成功時にデータを返す', async () => {
			const mockData = { id: '1', name: 'Test' };
			global.fetch = vi.fn().mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: async () => mockData
			} as Response);
			
			const result = await client.get('/api/test');
			
			expect(result).toEqual(mockData);
			expect(global.fetch).toHaveBeenCalledWith(
				'http://localhost:5000/api/test',
				expect.objectContaining({
					method: 'GET',
					headers: expect.objectContaining({
						'Content-Type': 'application/json'
					})
				})
			);
		});
		
		it('エラーレスポンスの場合はApiErrorをスロー', async () => {
			global.fetch = vi.fn().mockResolvedValueOnce({
				ok: false,
				status: 404,
				statusText: 'Not Found',
				json: async () => ({ error: 'Resource not found' })
			} as Response);
			
			await expect(client.get('/api/test')).rejects.toThrow(ApiError);
		});
		
		it('タイムアウトの場合はエラーをスロー', async () => {
			global.fetch = vi.fn().mockImplementation(() => 
				new Promise((_, reject) => {
					setTimeout(() => reject(new Error('AbortError')), 100);
				})
			);
			
			await expect(
				client.get('/api/test', { timeout: 50 })
			).rejects.toThrow();
		});
	});
	
	describe('HTTPメソッド', () => {
		it('POSTリクエストでボディを送信', async () => {
			const mockData = { success: true };
			const postData = { name: 'Test' };
			
			global.fetch = vi.fn().mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: async () => mockData
			} as Response);
			
			await client.post('/api/test', postData);
			
			expect(global.fetch).toHaveBeenCalledWith(
				'http://localhost:5000/api/test',
				expect.objectContaining({
					method: 'POST',
					body: JSON.stringify(postData)
				})
			);
		});
		
		it('DELETEリクエストを送信', async () => {
			global.fetch = vi.fn().mockResolvedValueOnce({
				ok: true,
				status: 204
			} as Response);
			
			await client.delete('/api/test/1');
			
			expect(global.fetch).toHaveBeenCalledWith(
				'http://localhost:5000/api/test/1',
				expect.objectContaining({
					method: 'DELETE'
				})
			);
		});
	});
	
	describe('URLパラメータ', () => {
		it('パラメータをURLに追加', async () => {
			global.fetch = vi.fn().mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: async () => ({})
			} as Response);
			
			await client.get('/api/test', {
				params: { page: 1, limit: 10 }
			});
			
			expect(global.fetch).toHaveBeenCalledWith(
				'http://localhost:5000/api/test?page=1&limit=10',
				expect.any(Object)
			);
		});
	});
});
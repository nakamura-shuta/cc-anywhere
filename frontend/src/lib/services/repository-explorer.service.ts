import { apiClient } from '$lib/api/client';
import { getApiBaseUrl, getApiKey } from '$lib/config/api';
import type { TreeNode, FileContent } from '$lib/components/repository-explorer/types';

export const repositoryExplorerService = {
	/**
	 * リポジトリのファイルツリーを取得
	 */
	async getTree(repositoryName: string, path?: string): Promise<TreeNode> {
		const params: Record<string, string> = {
			repository: repositoryName
		};
		if (path) {
			params.path = path;
		}
		
		return await apiClient.get<TreeNode>('/api/repositories/tree', { params });
	},

	/**
	 * ファイル内容を取得
	 */
	async getFileContent(repositoryName: string, filePath: string): Promise<FileContent> {
		return await apiClient.get<FileContent>('/api/repositories/file', { 
			params: { 
				repository: repositoryName,
				path: filePath 
			} 
		});
	},

	/**
	 * リポジトリの監視を開始
	 */
	async startWatching(repositoryName: string): Promise<void> {
		// POSTリクエストをparamsのみで送信（bodyなし）
		const baseUrl = getApiBaseUrl();
		const apiKey = getApiKey();
		const response = await fetch(`${baseUrl}/api/repositories/watch?${new URLSearchParams({ repository: repositoryName })}`, {
			method: 'POST',
			headers: apiKey ? {
				'X-API-Key': apiKey
			} : {}
		});
		
		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Failed to start watching: ${error}`);
		}
	},

	/**
	 * リポジトリの監視を停止
	 */
	async stopWatching(repositoryName: string): Promise<void> {
		const baseUrl = getApiBaseUrl();
		const apiKey = getApiKey();
		const response = await fetch(`${baseUrl}/api/repositories/watch?${new URLSearchParams({ repository: repositoryName })}`, {
			method: 'DELETE',
			headers: apiKey ? {
				'X-API-Key': apiKey
			} : {}
		});
		
		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Failed to stop watching: ${error}`);
		}
	},

	/**
	 * 監視中のリポジトリ一覧を取得
	 */
	async getWatchedRepositories(): Promise<string[]> {
		const response = await apiClient.get<{ repositories: string[] }>('/api/repositories/watched');
		return response.repositories;
	}
};
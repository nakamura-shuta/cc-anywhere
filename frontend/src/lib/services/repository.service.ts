// リポジトリサービス

import { apiClient } from '$lib/api/client';

export interface Repository {
	id: string;
	name: string;
	path: string;
	remote?: string;
	branch?: string;
	createdAt: string;
	updatedAt: string;
}

export const repositoryService = {
	// リポジトリ一覧の取得
	async list(): Promise<Repository[]> {
		return apiClient.get<Repository[]>('/api/repositories');
	},

	// リポジトリの取得
	async get(id: string): Promise<Repository> {
		return apiClient.get<Repository>(`/api/repositories/${id}`);
	}
};
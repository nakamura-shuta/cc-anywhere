// リポジトリサービス

import { apiClient } from '$lib/api/client';

export interface Repository {
	name: string;
	path: string;
}

export interface RepositoriesResponse {
	repositories: Repository[];
}

export const repositoryService = {
	// リポジトリ一覧の取得
	async list(): Promise<Repository[]> {
		const response = await apiClient.get<RepositoriesResponse>('/api/repositories');
		return response.repositories;
	}
};
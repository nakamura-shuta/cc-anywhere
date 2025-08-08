import { apiClient } from '$lib/api/client';
import type { TreeNode, FileContent } from '$lib/components/repository-explorer/types';

export const repositoryExplorerService = {
	/**
	 * リポジトリのファイルツリーを取得
	 */
	async getTree(repositoryName: string, path?: string): Promise<TreeNode> {
		const params: Record<string, string> = {};
		if (path) {
			params.path = path;
		}
		
		return await apiClient.get<TreeNode>(
			`/api/repositories/${encodeURIComponent(repositoryName)}/tree`,
			{ params }
		);
	},

	/**
	 * ファイル内容を取得
	 */
	async getFileContent(repositoryName: string, filePath: string): Promise<FileContent> {
		return await apiClient.get<FileContent>(
			`/api/repositories/${encodeURIComponent(repositoryName)}/file`,
			{ 
				params: { 
					path: filePath 
				} 
			}
		);
	}
};
/**
 * Workspace API client
 */

import { apiClient } from './client';

export interface Workspace {
	id: string;
	name: string;
	fileCount: number;
	totalSize: number;
	createdAt: string;
	expiresAt: string;
}

export interface FileTreeEntry {
	path: string;
	type: 'file' | 'directory';
	size?: number;
}

export async function uploadWorkspace(file: File, name?: string): Promise<Workspace> {
	const formData = new FormData();
	formData.append('file', file);
	if (name) formData.append('name', name);

	const baseUrl = apiClient['baseUrl'] || '';
	const response = await fetch(`${baseUrl}/api/workspaces`, {
		method: 'POST',
		body: formData,
		headers: {
			// Don't set Content-Type - browser sets it with boundary for multipart
			'X-API-Key': localStorage.getItem('api-key') || '',
		},
	});

	if (!response.ok) {
		const err = await response.json().catch(() => ({ error: 'Upload failed' }));
		throw new Error(err.error || 'Upload failed');
	}

	return response.json();
}

export async function getWorkspaces(): Promise<{ workspaces: Workspace[] }> {
	return apiClient.get<{ workspaces: Workspace[] }>('/api/workspaces');
}

export async function getWorkspaceTree(id: string): Promise<{ tree: FileTreeEntry[] }> {
	return apiClient.get<{ tree: FileTreeEntry[] }>(`/api/workspaces/${id}/tree`);
}

export async function deleteWorkspace(id: string): Promise<void> {
	await apiClient.delete(`/api/workspaces/${id}`);
}

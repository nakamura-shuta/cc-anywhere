import { apiClient } from '$lib/api/client';
import type { TaskResponse, TaskRequest } from '$lib/types/api';
import type { EntityService } from '$lib/stores/factory.svelte';

/**
 * タスクサービス
 * EntityServiceインターフェースを実装
 */
export class TaskService implements EntityService<TaskResponse> {
  async list(params?: {
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<TaskResponse[]> {
    const response = await apiClient.get<{ tasks: TaskResponse[], total: number, limit: number, offset: number }>('/api/tasks', { params });
    return response.tasks;
  }
  
  async get(id: string): Promise<TaskResponse> {
    const response = await apiClient.get<TaskResponse>(`/api/tasks/${id}`);
    return response;
  }
  
  async create(data: Partial<TaskRequest>): Promise<TaskResponse> {
    const response = await apiClient.post<TaskResponse>('/api/tasks', data);
    return response;
  }
  
  async update(id: string, data: Partial<TaskRequest>): Promise<TaskResponse> {
    const response = await apiClient.put<TaskResponse>(`/api/tasks/${id}`, data);
    return response;
  }
  
  async delete(id: string): Promise<void> {
    await apiClient.delete(`/api/tasks/${id}`);
  }
  
  // タスク固有のメソッド
  async cancel(id: string): Promise<void> {
    await apiClient.delete(`/api/tasks/${id}`);
  }
  
  async retry(id: string): Promise<TaskResponse> {
    const response = await apiClient.post<TaskResponse>(`/api/tasks/${id}/retry`);
    return response;
  }
  
  async getLogs(id: string): Promise<string[]> {
    const response = await apiClient.get<{ taskId: string; logs: string[] }>(`/api/tasks/${id}/logs`);
    return response.logs || [];
  }
}

// シングルトンインスタンス
export const taskService = new TaskService();
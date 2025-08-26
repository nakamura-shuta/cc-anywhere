import { apiClient } from './api-client';
import type { TaskGroupExecutionRequest, TaskGroupExecutionResponse, TaskGroupListResponse, TaskGroupStatusResponse } from '$lib/types/task-groups';

class TaskGroupService {
  /**
   * Execute a task group
   */
  async execute(request: TaskGroupExecutionRequest): Promise<TaskGroupExecutionResponse> {
    return apiClient.post('/api/task-groups/execute', request);
  }

  /**
   * Get all task groups
   */
  async getAll(status?: string): Promise<TaskGroupListResponse> {
    const params = status ? { status } : undefined;
    return apiClient.get('/api/task-groups', { params });
  }

  /**
   * Get task group status
   */
  async getStatus(groupId: string): Promise<TaskGroupStatusResponse> {
    return apiClient.get(`/api/task-groups/${groupId}/status`);
  }

  /**
   * Cancel a task group
   */
  async cancel(groupId: string): Promise<{ success: boolean; message: string }> {
    return apiClient.delete(`/api/task-groups/${groupId}`);
  }

  /**
   * Cleanup completed task groups
   */
  async cleanup(): Promise<{ success: boolean; message: string }> {
    return apiClient.post('/api/task-groups/cleanup');
  }
}

export const taskGroupService = new TaskGroupService();
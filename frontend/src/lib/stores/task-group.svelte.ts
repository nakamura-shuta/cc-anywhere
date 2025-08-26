import { taskGroupService } from '$lib/services/task-group.service';
import type { 
  TaskGroupSummary, 
  TaskGroupStats, 
  TaskGroupStatusResponse,
  TaskGroupExecutionRequest,
  TaskGroupExecutionResponse 
} from '$lib/types/task-groups';

/**
 * Task Group Store
 * Manages task group state with Svelte 5 reactivity
 */
class TaskGroupStore {
  // State
  groups = $state<TaskGroupSummary[]>([]);
  stats = $state<TaskGroupStats>({
    total: 0,
    pending: 0,
    running: 0,
    completed: 0,
    failed: 0,
    cancelled: 0
  });
  selectedGroup = $state<TaskGroupStatusResponse | null>(null);
  loading = $state(false);
  error = $state<Error | null>(null);
  
  // Task group logs (keyed by groupId) - using object instead of Map for better reactivity
  logs = $state<Record<string, Array<{
    taskId: string;
    taskName: string;
    log: string;
    timestamp: string;
    level?: 'info' | 'warning' | 'error' | 'debug';
  }>>>({});
  
  // Derived state
  runningGroups = $derived(
    this.groups.filter(g => g.status === 'running')
  );
  
  completedGroups = $derived(
    this.groups.filter(g => g.status === 'completed')
  );
  
  failedGroups = $derived(
    this.groups.filter(g => g.status === 'failed')
  );
  
  // Methods
  async fetchAll(status?: string): Promise<void> {
    try {
      this.loading = true;
      this.error = null;
      const response = await taskGroupService.getAll(status);
      this.groups = response.groups;
      this.stats = response.stats;
    } catch (err) {
      this.error = err instanceof Error ? err : new Error('Failed to fetch task groups');
    } finally {
      this.loading = false;
    }
  }
  
  async fetchStatus(groupId: string): Promise<TaskGroupStatusResponse | null> {
    try {
      this.loading = true;
      this.error = null;
      const status = await taskGroupService.getStatus(groupId);
      this.selectedGroup = status;
      
      // Update the group in the list
      const index = this.groups.findIndex(g => g.id === groupId);
      if (index !== -1) {
        this.groups[index] = {
          ...this.groups[index],
          status: status.status,
          completedTasks: status.completedTasks,
          progress: status.progress
        };
      }
      
      return status;
    } catch (err) {
      this.error = err instanceof Error ? err : new Error('Failed to fetch task group status');
      return null;
    } finally {
      this.loading = false;
    }
  }
  
  async execute(request: TaskGroupExecutionRequest): Promise<TaskGroupExecutionResponse | null> {
    try {
      this.loading = true;
      this.error = null;
      const response = await taskGroupService.execute(request);
      
      // Refresh the list to include the new group
      await this.fetchAll();
      
      return response;
    } catch (err) {
      this.error = err instanceof Error ? err : new Error('Failed to execute task group');
      return null;
    } finally {
      this.loading = false;
    }
  }
  
  async cancel(groupId: string): Promise<boolean> {
    try {
      this.loading = true;
      this.error = null;
      const response = await taskGroupService.cancel(groupId);
      
      if (response.success) {
        // Update local state
        const index = this.groups.findIndex(g => g.id === groupId);
        if (index !== -1) {
          this.groups[index] = {
            ...this.groups[index],
            status: 'cancelled'
          };
        }
        
        // Update stats
        this.stats = {
          ...this.stats,
          running: Math.max(0, this.stats.running - 1),
          cancelled: this.stats.cancelled + 1
        };
      }
      
      return response.success;
    } catch (err) {
      this.error = err instanceof Error ? err : new Error('Failed to cancel task group');
      return false;
    } finally {
      this.loading = false;
    }
  }
  
  async cleanup(): Promise<boolean> {
    try {
      this.loading = true;
      this.error = null;
      const response = await taskGroupService.cleanup();
      
      if (response.success) {
        // Remove completed groups from local state
        this.groups = this.groups.filter(
          g => !['completed', 'failed', 'cancelled'].includes(g.status)
        );
        
        // Update stats
        this.stats = {
          ...this.stats,
          total: this.groups.length,
          completed: 0,
          failed: 0,
          cancelled: 0
        };
      }
      
      return response.success;
    } catch (err) {
      this.error = err instanceof Error ? err : new Error('Failed to cleanup task groups');
      return false;
    } finally {
      this.loading = false;
    }
  }
  
  // WebSocket handling
  handleWebSocketUpdate(message: any): void {
    const { type, payload } = message;
    
    switch (type) {
      case 'task-group:created':
        // Add new group to the list
        if (payload.group) {
          this.groups = [payload.group, ...this.groups];
          this.stats.total++;
          this.stats.pending++;
        }
        break;
        
      case 'task-group:status':
        // Update group status
        if (payload.groupId && payload.status) {
          const index = this.groups.findIndex(g => g.id === payload.groupId);
          if (index !== -1) {
            const oldStatus = this.groups[index].status;
            this.groups[index] = {
              ...this.groups[index],
              status: payload.status
            };
            
            // Update stats
            if (oldStatus !== payload.status) {
              this.updateStats(oldStatus, payload.status);
            }
          }
        }
        break;
        
      case 'task-group:progress':
        // Update group progress
        if (payload.groupId) {
          const index = this.groups.findIndex(g => g.id === payload.groupId);
          if (index !== -1) {
            this.groups[index] = {
              ...this.groups[index],
              completedTasks: payload.completedTasks || this.groups[index].completedTasks,
              progress: payload.progress || this.groups[index].progress,
              currentTask: payload.currentTask
            };
          }
          
          // Update selected group if it matches
          if (this.selectedGroup && this.selectedGroup.groupId === payload.groupId) {
            this.selectedGroup = {
              ...this.selectedGroup,
              completedTasks: payload.completedTasks || this.selectedGroup.completedTasks,
              progress: payload.progress || this.selectedGroup.progress
            };
          }
        }
        break;
        
      case 'task-group:task-completed':
        // Update task status in selected group
        if (this.selectedGroup && this.selectedGroup.groupId === payload.groupId && payload.taskId) {
          const taskIndex = this.selectedGroup.tasks.findIndex(t => t.id === payload.taskId);
          if (taskIndex !== -1 && this.selectedGroup.tasks[taskIndex]) {
            this.selectedGroup.tasks[taskIndex] = {
              ...this.selectedGroup.tasks[taskIndex]!,
              status: payload.status || 'completed',
              error: payload.error,
              completedAt: payload.completedAt
            };
          }
        }
        break;
        
      case 'task-group:log':
        // Add log to the logs object
        if (payload.groupId) {
          const groupLogs = this.logs[payload.groupId] || [];
          groupLogs.push({
            taskId: payload.taskId,
            taskName: payload.taskName,
            log: payload.log,
            timestamp: payload.timestamp,
            level: payload.level
          });
          
          // Keep only the last 1000 logs per group to prevent memory issues
          if (groupLogs.length > 1000) {
            groupLogs.splice(0, groupLogs.length - 1000);
          }
          
          // Create a new object to trigger reactivity in Svelte 5
          this.logs = {
            ...this.logs,
            [payload.groupId]: groupLogs
          };
        }
        break;
    }
  }
  
  private updateStats(oldStatus: string, newStatus: string): void {
    // Decrement old status count
    if (oldStatus in this.stats) {
      (this.stats as any)[oldStatus] = Math.max(0, (this.stats as any)[oldStatus] - 1);
    }
    
    // Increment new status count
    if (newStatus in this.stats) {
      (this.stats as any)[newStatus]++;
    }
  }
  
  // Clear logs for a specific group
  clearLogs(groupId: string): void {
    const newLogs = { ...this.logs };
    delete newLogs[groupId];
    this.logs = newLogs;
  }
  
  // Get logs for a specific group
  getLogsForGroup(groupId: string) {
    return this.logs[groupId] || [];
  }
  
  // Initialize WebSocket subscription
  async init(): Promise<void> {
    // WebSocket event handlers are already set up in websocket-integration.svelte.ts
    // Just load initial data
    await this.fetchAll();
  }
}

// Export singleton instance
export const taskGroupStore = new TaskGroupStore();
/**
 * Task Groups Types for Frontend
 */

export interface Task {
  id: string;
  name: string;
  instruction: string;
  dependencies?: string[];
}

export interface ExecutionConfig {
  mode: 'sequential' | 'parallel' | 'mixed';
  continueSession: true;
  continueOnError?: boolean;
  timeout?: number;
}

export interface TaskGroup {
  id: string;
  name: string;
  tasks: Task[];
  execution: ExecutionConfig;
}

export interface ExecutionStage {
  tasks: Task[];
  parallel: boolean;
}

export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed';
export type GroupStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface TaskGroupExecutionRequest {
  name: string;
  tasks: Task[];
  execution: ExecutionConfig;
  context?: {
    workingDirectory?: string;
    repositoryPath?: string;
  };
}

export interface TaskGroupExecutionResponse {
  success: boolean;
  groupId: string;
  message: string;
  totalTasks: number;
  executionPlan: ExecutionStage[];
}

export interface TaskGroupStatusResponse {
  groupId: string;
  status: GroupStatus;
  sessionId?: string;
  completedTasks: number;
  totalTasks: number;
  progress: number;
  tasks: Array<{
    id: string;
    name: string;
    status: TaskStatus;
    error?: string;
    startedAt?: string;
    completedAt?: string;
  }>;
  startedAt: string;
  completedAt?: string;
}

export interface TaskGroupSummary {
  id: string;
  name: string;
  status: GroupStatus;
  totalTasks: number;
  completedTasks: number;
  progress: number;
  currentTask?: string;
  startedAt: string;
  updatedAt: string;
  executionMode: 'sequential' | 'parallel' | 'mixed';
}

export interface TaskGroupStats {
  total: number;
  pending: number;
  running: number;
  completed: number;
  failed: number;
  cancelled: number;
}

export interface TaskGroupListResponse {
  groups: TaskGroupSummary[];
  stats: TaskGroupStats;
}

export interface TaskGroupLog {
  taskId: string;
  taskName: string;
  logMessage: string;
  logLevel?: 'info' | 'warning' | 'error' | 'debug';
  timestamp: string;
}

export interface TaskGroupHistoryResponse {
  id: string;
  name: string;
  status: GroupStatus;
  sessionId?: string;
  totalTasks: number;
  completedTasks: number;
  progress: number;
  tasks: Array<{
    id: string;
    name: string;
    status: TaskStatus;
    error?: string;
    startedAt?: string;
    completedAt?: string;
  }>;
  startedAt: string;
  completedAt?: string;
  logs: TaskGroupLog[];
}
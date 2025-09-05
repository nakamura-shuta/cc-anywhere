import type { GroupStatus, TaskStatus } from "./task-groups.js";

export interface TaskGroupHistoryRecord {
  id: string;
  name: string;
  description?: string;
  executionMode: "sequential" | "parallel" | "mixed";
  maxParallel?: number;
  sessionId?: string;
  status: GroupStatus;
  error?: string;
  progressCompleted: number;
  progressTotal: number;
  progressPercentage: number;
  currentTask?: string;
  startedAt: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  tasks: TaskGroupTaskRecord[];
}

export interface TaskGroupTaskRecord {
  id: string;
  groupId: string;
  name: string;
  instruction: string;
  dependencies?: string[];
  context?: any;
  options?: any;
  status: TaskStatus;
  result?: any;
  error?: string;
  executionOrder?: number;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface TaskGroupFilter {
  status?: GroupStatus;
  sessionId?: string;
  startedAfter?: Date;
  startedBefore?: Date;
  limit?: number;
  offset?: number;
}

export interface TaskGroupStatistics {
  total: number;
  pending: number;
  running: number;
  completed: number;
  failed: number;
  cancelled: number;
  averageExecutionTime?: number;
  successRate?: number;
}

export interface TaskGroupLogRecord {
  id?: number;
  groupId: string;
  taskId: string;
  taskName: string;
  logMessage: string;
  logLevel?: "info" | "warning" | "error" | "debug";
  timestamp: Date;
}

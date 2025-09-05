/**
 * Task Groups Types
 * Simple multiple task execution with session continuity
 */

/**
 * Individual task within a group
 */
export interface Task {
  id: string;
  name: string;
  instruction: string;
  dependencies?: string[]; // IDs of tasks this task depends on
  context?: any; // Optional context for the task
  options?: any; // Optional options for the task
}

/**
 * Execution configuration
 */
export interface ExecutionConfig {
  mode: "sequential" | "parallel" | "mixed";
  continueSession: true; // Always true - all tasks in group share same session
  continueOnError?: boolean; // Continue even if a task fails
  timeout?: number; // Timeout per task in milliseconds
  permissionMode?: "ask" | "allow" | "deny" | "acceptEdits" | "bypassPermissions" | "plan"; // Permission mode for Claude Code SDK
  maxParallel?: number; // Maximum number of parallel tasks
}

/**
 * Task group definition
 */
export interface TaskGroup {
  id: string;
  name: string;
  description?: string; // Optional description
  tasks: Task[];
  execution: ExecutionConfig;
}

/**
 * Execution stage (for internal use)
 */
export interface ExecutionStage {
  tasks: Task[];
  parallel: boolean; // True if tasks in this stage run in parallel
}

/**
 * Task execution status
 */
export type TaskStatus = "pending" | "running" | "completed" | "failed";

/**
 * Group execution status
 */
export type GroupStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

/**
 * Task group execution result
 */
export interface TaskGroupResult {
  groupId: string;
  status: GroupStatus;
  sessionId?: string;
  completedTasks: number;
  totalTasks: number;
  tasks: Array<{
    id: string;
    name: string;
    status: TaskStatus;
    result?: any;
    error?: string;
    startedAt?: Date;
    completedAt?: Date;
  }>;
  startedAt: Date;
  completedAt?: Date;
  progress: number; // 0-100
  error?: string; // Overall error for the group
}

/**
 * Request payload for task group execution
 */
export interface TaskGroupExecutionRequest {
  name: string;
  tasks: Task[];
  execution: ExecutionConfig;
  context?: {
    workingDirectory?: string;
    repositoryPath?: string;
  };
}

/**
 * Response for task group execution
 */
export interface TaskGroupExecutionResponse {
  success: boolean;
  groupId: string;
  message: string;
  totalTasks: number;
  executionPlan: ExecutionStage[];
}

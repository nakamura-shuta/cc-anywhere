/**
 * Error metrics for monitoring and analysis
 */
export interface ErrorMetrics {
  totalErrors: number;
  errorsByCode: Map<string, number>;
  errorsByStatus: Map<number, number>;
  errorsByRoute: Map<string, number>;
}

/**
 * Performance metrics
 */
export interface PerformanceMetrics {
  requestCount: number;
  averageResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
}

/**
 * Task execution metrics
 */
export interface TaskMetrics {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  cancelledTasks: number;
  averageExecutionTime: number;
  tasksByStatus: Map<string, number>;
}

/**
 * Worker metrics
 */
export interface WorkerMetrics {
  activeWorkers: number;
  idleWorkers: number;
  totalWorkers: number;
  queueLength: number;
  processingTasks: number;
}

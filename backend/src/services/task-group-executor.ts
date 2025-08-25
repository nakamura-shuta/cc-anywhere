/**
 * Task Group Executor Service
 * Simple multiple task execution with dependency management
 */

import crypto from 'crypto';
import { TaskExecutorImpl } from '../claude/executor.js';
import { logger } from '../utils/logger.js';
import type { 
  TaskGroup, 
  Task, 
  ExecutionStage, 
  TaskGroupResult, 
  TaskStatus
} from '../types/task-groups.js';
import type { TaskRequest } from '../claude/types.js';

/**
 * Executes task groups with dependency management and session continuity
 */
export class TaskGroupExecutor {
  private executor: TaskExecutorImpl;
  private activeGroups = new Map<string, TaskGroupResult>();

  constructor() {
    this.executor = new TaskExecutorImpl();
  }

  /**
   * Execute a task group
   */
  async execute(group: TaskGroup, context?: {
    workingDirectory?: string;
    repositoryPath?: string;
  }): Promise<TaskGroupResult> {
    const groupId = group.id || crypto.randomUUID();
    const startTime = new Date();

    logger.info('Starting task group execution', {
      groupId,
      groupName: group.name,
      taskCount: group.tasks.length,
      executionMode: group.execution.mode
    });

    // Initialize result tracking
    const result: TaskGroupResult = {
      groupId,
      status: 'running',
      completedTasks: 0,
      totalTasks: group.tasks.length,
      tasks: group.tasks.map(task => ({
        id: task.id,
        name: task.name,
        status: 'pending' as TaskStatus
      })),
      startedAt: startTime,
      progress: 0
    };

    this.activeGroups.set(groupId, result);

    try {
      // 1. Validate dependencies
      this.validateDependencies(group.tasks);

      // 2. Build execution plan
      const executionPlan = this.buildExecutionPlan(group.tasks);
      
      logger.info('Execution plan created', {
        groupId,
        stages: executionPlan.length,
        plan: executionPlan.map(stage => ({
          taskCount: stage.tasks.length,
          parallel: stage.parallel,
          tasks: stage.tasks.map(t => t.id)
        }))
      });

      // 3. Execute stages
      let sessionId: string | undefined;
      
      for (let stageIndex = 0; stageIndex < executionPlan.length; stageIndex++) {
        const stage = executionPlan[stageIndex];
        if (!stage) continue;
        
        logger.info('Executing stage', {
          groupId,
          stageIndex: stageIndex + 1,
          totalStages: executionPlan.length,
          taskCount: stage.tasks.length,
          parallel: stage.parallel
        });

        if (stage.parallel && stage.tasks.length > 1) {
          // Parallel execution
          const stageResults = await Promise.allSettled(
            stage.tasks.map(task => this.executeTask(task, sessionId, result, context))
          );

          // Update session ID from any successful task
          for (const stageResult of stageResults) {
            if (stageResult.status === 'fulfilled' && stageResult.value?.sessionId) {
              sessionId = stageResult.value.sessionId;
              break;
            }
          }

          // Handle failures
          const failures = stageResults.filter(r => r.status === 'rejected');
          if (failures.length > 0 && !group.execution.continueOnError) {
            throw new Error(`Stage ${stageIndex + 1} failed: ${failures.length} tasks failed`);
          }
        } else {
          // Sequential execution
          for (const task of stage.tasks) {
            const taskResult = await this.executeTask(task, sessionId, result, context);
            if (taskResult?.sessionId) {
              sessionId = taskResult.sessionId;
            }
          }
        }

        // Update progress after each stage
        result.progress = Math.round((result.completedTasks / result.totalTasks) * 100);
        this.activeGroups.set(groupId, { ...result });
      }

      // Mark as completed
      result.status = 'completed';
      result.completedAt = new Date();
      result.progress = 100;
      result.sessionId = sessionId;

      logger.info('Task group execution completed successfully', {
        groupId,
        duration: result.completedAt.getTime() - result.startedAt.getTime(),
        completedTasks: result.completedTasks,
        totalTasks: result.totalTasks,
        sessionId
      });

    } catch (error) {
      result.status = 'failed';
      result.completedAt = new Date();
      
      logger.error('Task group execution failed', {
        groupId,
        error: error instanceof Error ? error.message : String(error),
        completedTasks: result.completedTasks,
        totalTasks: result.totalTasks
      });

      throw error;
    } finally {
      this.activeGroups.set(groupId, result);
    }

    return result;
  }

  /**
   * Execute a single task within a group
   */
  private async executeTask(
    task: Task,
    sessionId: string | undefined,
    groupResult: TaskGroupResult,
    context?: { workingDirectory?: string; repositoryPath?: string; }
  ): Promise<{ sessionId?: string } | null> {
    const taskIndex = groupResult.tasks.findIndex(t => t.id === task.id);
    if (taskIndex === -1) return null;

    // Update task status to running
    const taskRecord = groupResult.tasks[taskIndex];
    if (taskRecord) {
      taskRecord.status = 'running';
      taskRecord.startedAt = new Date();
      this.activeGroups.set(groupResult.groupId, { ...groupResult });
    }

    logger.info('Executing task', {
      groupId: groupResult.groupId,
      taskId: task.id,
      taskName: task.name,
      instruction: task.instruction,
      sessionId
    });

    try {
      const taskRequest: TaskRequest = {
        instruction: task.instruction,
        context: {
          workingDirectory: context?.workingDirectory || process.cwd(),
          repositoryPath: context?.repositoryPath
        },
        options: {
          timeout: 60000, // 1 minute default
          sdk: {
            continueSession: sessionId ? true : undefined,
            resumeSession: sessionId || undefined
          }
        }
      };

      const result = await this.executor.execute(taskRequest, task.id);

      // Update task status to completed
      const completedTaskRecord = groupResult.tasks[taskIndex];
      if (completedTaskRecord) {
        completedTaskRecord.status = 'completed';
        completedTaskRecord.completedAt = new Date();
        completedTaskRecord.result = result;
        groupResult.completedTasks++;
      }

      logger.info('Task completed successfully', {
        groupId: groupResult.groupId,
        taskId: task.id,
        taskName: task.name,
        sessionId: result.sdkSessionId
      });

      return {
        sessionId: result.sdkSessionId
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Update task status to failed
      const failedTaskRecord = groupResult.tasks[taskIndex];
      if (failedTaskRecord) {
        failedTaskRecord.status = 'failed';
        failedTaskRecord.completedAt = new Date();
        failedTaskRecord.error = errorMessage;
      }

      logger.error('Task execution failed', {
        groupId: groupResult.groupId,
        taskId: task.id,
        taskName: task.name,
        error: errorMessage
      });

      throw error;
    } finally {
      this.activeGroups.set(groupResult.groupId, { ...groupResult });
    }
  }

  /**
   * Get execution status for a task group
   */
  getStatus(groupId: string): TaskGroupResult | undefined {
    return this.activeGroups.get(groupId);
  }

  /**
   * Validate task dependencies
   */
  private validateDependencies(tasks: Task[]): void {
    const taskIds = new Set(tasks.map(t => t.id));
    
    // Check for invalid dependencies
    for (const task of tasks) {
      if (task.dependencies) {
        for (const dep of task.dependencies) {
          if (!taskIds.has(dep)) {
            throw new Error(`Task '${task.id}' depends on non-existent task '${dep}'`);
          }
        }
      }
    }

    // Check for circular dependencies
    if (this.hasCircularDependencies(tasks)) {
      throw new Error('Circular dependencies detected in task group');
    }
  }

  /**
   * Check for circular dependencies using DFS
   */
  private hasCircularDependencies(tasks: Task[]): boolean {
    const taskMap = new Map(tasks.map(t => [t.id, t]));
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (taskId: string): boolean => {
      if (recursionStack.has(taskId)) return true;
      if (visited.has(taskId)) return false;

      visited.add(taskId);
      recursionStack.add(taskId);

      const task = taskMap.get(taskId);
      if (task?.dependencies) {
        for (const dep of task.dependencies) {
          if (hasCycle(dep)) return true;
        }
      }

      recursionStack.delete(taskId);
      return false;
    };

    for (const task of tasks) {
      if (!visited.has(task.id) && hasCycle(task.id)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Build execution plan using topological sort
   */
  buildExecutionPlan(tasks: Task[]): ExecutionStage[] {
    const stages: ExecutionStage[] = [];
    const executed = new Set<string>();

    while (executed.size < tasks.length) {
      // Find tasks that can be executed (no pending dependencies)
      const executable = tasks.filter(task => {
        if (executed.has(task.id)) return false;
        
        if (!task.dependencies || task.dependencies.length === 0) return true;
        
        return task.dependencies.every(dep => executed.has(dep));
      });

      if (executable.length === 0) {
        throw new Error('Unable to resolve task dependencies - possible circular dependency');
      }

      // Create stage
      stages.push({
        tasks: executable,
        parallel: executable.length > 1
      });

      // Mark as executed
      executable.forEach(task => executed.add(task.id));
    }

    return stages;
  }

  /**
   * Cancel a running task group
   */
  async cancel(groupId: string): Promise<boolean> {
    const result = this.activeGroups.get(groupId);
    if (!result || result.status !== 'running') {
      return false;
    }

    result.status = 'cancelled';
    result.completedAt = new Date();
    this.activeGroups.set(groupId, result);

    logger.info('Task group cancelled', { groupId });
    return true;
  }

  /**
   * Clear completed task groups from memory
   */
  cleanup(): void {
    const completed = Array.from(this.activeGroups.entries())
      .filter(([, result]) => ['completed', 'failed', 'cancelled'].includes(result.status))
      .map(([groupId]) => groupId);

    for (const groupId of completed) {
      this.activeGroups.delete(groupId);
    }

    logger.debug('Cleaned up completed task groups', { count: completed.length });
  }
}
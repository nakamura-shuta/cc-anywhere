/**
 * Task Group Executor Service
 * Simple multiple task execution with dependency management
 */

import crypto from "crypto";
import { TaskExecutorImpl } from "../claude/executor.js";
import { logger } from "../utils/logger.js";
import { taskGroupStore } from "./task-group-store.js";
import type {
  TaskGroup,
  Task,
  ExecutionStage,
  TaskGroupResult,
  TaskStatus,
} from "../types/task-groups.js";
import type { TaskRequest } from "../claude/types.js";
import { getSharedWebSocketServer } from "../websocket/shared-instance.js";
import type { WebSocketServer } from "../websocket/websocket-server.js";
import { WebSocketBroadcaster } from "../websocket/websocket-broadcaster.js";
import {
  ProgressFormatter,
  type ProgressMessage,
  type FormattedLog,
} from "../utils/progress-formatter.js";

/**
 * Executes task groups with dependency management and session continuity
 */
export class TaskGroupExecutor {
  private executor: TaskExecutorImpl;
  private activeGroups = new Map<string, TaskGroupResult>();
  private broadcaster?: WebSocketBroadcaster;

  constructor() {
    this.executor = new TaskExecutorImpl();
  }

  /**
   * Broadcast log message via WebSocket
   */
  private broadcastLog(
    wsServer: WebSocketServer | null | undefined,
    groupId: string,
    taskId: string,
    taskName: string,
    log: FormattedLog,
  ): void {
    if (!wsServer) {
      logger.warn("WebSocket server not available for broadcasting", { groupId, taskId });
      return;
    }

    // Create broadcaster if not exists
    if (!this.broadcaster) {
      this.broadcaster = new WebSocketBroadcaster(wsServer);
    }

    // Use the new WebSocketBroadcaster
    this.broadcaster.taskGroup(groupId, "task-group:log", {
      taskId,
      taskName,
      log: log.message,
      timestamp: new Date().toISOString(),
      level: log.level,
    });
  }

  /**
   * Create progress handler for task execution
   */
  private createProgressHandler(
    groupId: string,
    task: Task,
    wsServer: WebSocketServer | null | undefined,
  ): (progress: ProgressMessage) => Promise<void> {
    return async (progress: ProgressMessage) => {
      const formattedLog = ProgressFormatter.formatProgressMessage(progress);
      if (formattedLog) {
        this.broadcastLog(wsServer, groupId, task.id, task.name, formattedLog);
      }
    };
  }

  /**
   * Execute a task group
   */
  async execute(
    group: TaskGroup,
    context?: {
      workingDirectory?: string;
      repositoryPath?: string;
    },
  ): Promise<TaskGroupResult> {
    const groupId = group.id || crypto.randomUUID();
    const startTime = new Date();

    logger.info("Starting task group execution", {
      groupId,
      groupName: group.name,
      taskCount: group.tasks.length,
      executionMode: group.execution.mode,
    });

    // Initialize result tracking
    const result: TaskGroupResult = {
      groupId,
      status: "running",
      completedTasks: 0,
      totalTasks: group.tasks.length,
      tasks: group.tasks.map((task) => ({
        id: task.id,
        name: task.name,
        status: "pending" as TaskStatus,
      })),
      startedAt: startTime,
      progress: 0,
    };

    this.activeGroups.set(groupId, result);

    // Store in TaskGroupStore for centralized state management
    const storedGroup = { ...group, id: groupId };
    taskGroupStore.store(storedGroup, result);

    try {
      // 1. Validate dependencies
      this.validateDependencies(group.tasks);

      // 2. Build execution plan
      const executionPlan = this.buildExecutionPlan(group.tasks);

      logger.debug("Execution plan created", {
        groupId,
        stages: executionPlan.length,
      });

      // 3. Execute stages
      let sessionId: string | undefined;

      for (let stageIndex = 0; stageIndex < executionPlan.length; stageIndex++) {
        const stage = executionPlan[stageIndex];
        if (!stage) {
          logger.warn("Stage is undefined", { groupId, stageIndex });
          continue;
        }

        logger.debug("Executing stage", {
          groupId,
          stageIndex: stageIndex + 1,
          parallel: stage.parallel,
        });

        if (stage.parallel && stage.tasks.length > 1) {
          // Parallel execution
          const stageResults = await Promise.allSettled(
            stage.tasks.map((task) => this.executeTask(task, sessionId, result, group, context)),
          );

          // Update session ID from any successful task
          for (const stageResult of stageResults) {
            if (stageResult.status === "fulfilled" && stageResult.value?.sessionId) {
              sessionId = stageResult.value.sessionId;
              break;
            }
          }

          // Handle failures
          const failures = stageResults.filter((r) => r.status === "rejected");
          if (failures.length > 0 && !group.execution.continueOnError) {
            throw new Error(`Stage ${stageIndex + 1} failed: ${failures.length} tasks failed`);
          }
        } else {
          // Sequential execution
          for (const task of stage.tasks) {
            const taskResult = await this.executeTask(task, sessionId, result, group, context);
            if (taskResult?.sessionId) {
              sessionId = taskResult.sessionId;
              // Update session ID in parent result object
              result.sessionId = sessionId;
            }
          }
        }

        // Update progress after each stage
        result.progress = Math.round((result.completedTasks / result.totalTasks) * 100);
        // Ensure session ID is propagated to result
        if (sessionId) {
          result.sessionId = sessionId;
        }
        this.activeGroups.set(groupId, { ...result });
        // Don't call updateStatus here as it broadcasts with potentially stale data
        // The status is already being broadcast by updateTaskProgress
      }

      // Mark as completed
      result.status = "completed";
      result.completedAt = new Date();
      result.progress = 100;
      result.sessionId = sessionId;

      taskGroupStore.updateSessionId(groupId, sessionId);
      taskGroupStore.updateStatus(groupId, "completed");

      logger.info("Task group execution completed successfully", {
        groupId,
        duration: result.completedAt.getTime() - result.startedAt.getTime(),
        completedTasks: result.completedTasks,
        totalTasks: result.totalTasks,
        sessionId,
      });
    } catch (error) {
      result.status = "failed";
      result.completedAt = new Date();

      const errorMessage = error instanceof Error ? error.message : String(error);
      taskGroupStore.updateStatus(groupId, "failed", errorMessage);

      logger.error("Task group execution failed", {
        groupId,
        error: errorMessage,
        completedTasks: result.completedTasks,
        totalTasks: result.totalTasks,
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
    group: TaskGroup,
    context?: { workingDirectory?: string; repositoryPath?: string },
  ): Promise<{ sessionId?: string } | null> {
    logger.debug("executeTask called", {
      taskId: task.id,
      taskName: task.name,
      sessionId,
    });

    const taskIndex = groupResult.tasks.findIndex((t) => t.id === task.id);
    if (taskIndex === -1) {
      logger.error("Task not found in group result", {
        taskId: task.id,
        groupId: groupResult.groupId,
      });
      return null;
    }

    // If we have a session ID, ensure it's updated in the store before status changes
    if (sessionId && !groupResult.sessionId) {
      groupResult.sessionId = sessionId;
      taskGroupStore.updateSessionId(groupResult.groupId, sessionId);
    }

    // Update task status to running
    const taskRecord = groupResult.tasks[taskIndex];
    if (taskRecord) {
      taskRecord.status = "running";
      taskRecord.startedAt = new Date();
      // Update activeGroups first to ensure latest state is available
      this.activeGroups.set(groupResult.groupId, { ...groupResult });
      // Then update task progress which will broadcast the latest state with current sessionId
      taskGroupStore.updateTaskProgress(groupResult.groupId, task.id, "running");
    }

    logger.debug("Executing task", {
      groupId: groupResult.groupId,
      taskId: task.id,
      taskName: task.name,
      sessionId,
    });

    // Get WebSocket server for log streaming (get at execution time, not constructor time)
    const wsServer = getSharedWebSocketServer();

    // Log if WebSocket server is not available
    if (!wsServer) {
      logger.warn("WebSocket server not available for task group log streaming", {
        groupId: groupResult.groupId,
        taskId: task.id,
      });
    }

    try {
      // Validate instruction
      if (!task.instruction || task.instruction.trim().length === 0) {
        throw new Error(`Task instruction is empty for task: ${task.name} (${task.id})`);
      }

      // Send start logs
      this.broadcastLog(wsServer, groupResult.groupId, task.id, task.name, {
        message: `▶️ タスク開始: ${task.name}`,
        level: "info",
      });
      this.broadcastLog(wsServer, groupResult.groupId, task.id, task.name, {
        message: `📝 実行内容: ${task.instruction}`,
        level: "info",
      });

      const taskRequest: TaskRequest = {
        instruction: task.instruction,
        context: {
          workingDirectory: context?.workingDirectory || process.cwd(),
          repositoryPath: context?.repositoryPath,
        },
        options: {
          timeout: group.execution.timeout || 60000, // Use group timeout or 1 minute default
          sdk: {
            continueSession: sessionId ? true : undefined,
            resumeSession: sessionId || undefined,
            // タスクグループ実行時の権限モードを設定
            // デフォルトはbypassPermissionsで承認プロンプトなしで実行
            permissionMode: group.execution.permissionMode || "bypassPermissions",
          },
          // Use the refactored progress handler
          onProgress: this.createProgressHandler(groupResult.groupId, task, wsServer),
        },
      };

      logger.debug("Starting task execution", {
        groupId: groupResult.groupId,
        taskId: task.id,
        taskName: task.name,
      });

      const result = await this.executor.execute(taskRequest, task.id);

      logger.debug("Task execution completed", {
        groupId: groupResult.groupId,
        taskId: task.id,
        success: result?.success,
        sessionId: result?.sdkSessionId,
      });

      // Update session ID immediately after task completes, BEFORE updating task status
      if (result.sdkSessionId) {
        groupResult.sessionId = result.sdkSessionId;
        // Update activeGroups to persist session ID
        this.activeGroups.set(groupResult.groupId, { ...groupResult });
        // Update store so that subsequent broadcasts have the correct session ID
        taskGroupStore.updateSessionId(groupResult.groupId, result.sdkSessionId);
      }

      // Update task status to completed
      const completedTaskRecord = groupResult.tasks[taskIndex];
      if (completedTaskRecord) {
        completedTaskRecord.status = "completed";
        completedTaskRecord.completedAt = new Date();
        completedTaskRecord.result = result;
        groupResult.completedTasks++;
        // Now updateTaskProgress will broadcast with the correct session ID
        taskGroupStore.updateTaskProgress(groupResult.groupId, task.id, "completed");
        taskGroupStore.updateTaskResult(groupResult.groupId, task.id, result);
      }

      // Send completion log
      this.broadcastLog(wsServer, groupResult.groupId, task.id, task.name, {
        message: `✅ タスク完了: ${task.name}`,
        level: "info",
      });

      return {
        sessionId: result.sdkSessionId,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      // Update task status to failed
      const failedTaskRecord = groupResult.tasks[taskIndex];
      if (failedTaskRecord) {
        failedTaskRecord.status = "failed";
        failedTaskRecord.completedAt = new Date();
        failedTaskRecord.error = errorMessage;
        taskGroupStore.updateTaskProgress(groupResult.groupId, task.id, "failed");
        taskGroupStore.updateTaskResult(groupResult.groupId, task.id, null, errorMessage);
      }

      logger.error("Task execution failed", {
        groupId: groupResult.groupId,
        taskId: task.id,
        taskName: task.name,
        instruction: task.instruction?.substring(0, 100),
        error: errorMessage,
        stack: errorStack,
      });

      // Send error log
      this.broadcastLog(wsServer, groupResult.groupId, task.id, task.name, {
        message: `❌ エラー: ${errorMessage}`,
        level: "error",
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
    // First check the store for persistent state
    const storedRecord = taskGroupStore.get(groupId);
    if (storedRecord) {
      return storedRecord.result;
    }
    // Fallback to in-memory state
    return this.activeGroups.get(groupId);
  }

  /**
   * Validate task dependencies
   */
  private validateDependencies(tasks: Task[]): void {
    const taskIds = new Set(tasks.map((t) => t.id));

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
      throw new Error("Circular dependencies detected in task group");
    }
  }

  /**
   * Check for circular dependencies using DFS
   */
  private hasCircularDependencies(tasks: Task[]): boolean {
    const taskMap = new Map(tasks.map((t) => [t.id, t]));
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
      const executable = tasks.filter((task) => {
        if (executed.has(task.id)) return false;

        if (!task.dependencies || task.dependencies.length === 0) return true;

        return task.dependencies.every((dep) => executed.has(dep));
      });

      if (executable.length === 0) {
        throw new Error("Unable to resolve task dependencies - possible circular dependency");
      }

      // Create stage
      stages.push({
        tasks: executable,
        parallel: executable.length > 1,
      });

      // Mark as executed
      executable.forEach((task) => executed.add(task.id));
    }

    return stages;
  }

  /**
   * Cancel a running task group
   */
  async cancel(groupId: string): Promise<boolean> {
    const result = this.activeGroups.get(groupId);
    if (!result || result.status !== "running") {
      return false;
    }

    result.status = "cancelled";
    result.completedAt = new Date();
    this.activeGroups.set(groupId, result);

    logger.info("Task group cancelled", { groupId });
    return true;
  }

  /**
   * Clear completed task groups from memory
   */
  cleanup(): void {
    const completed = Array.from(this.activeGroups.entries())
      .filter(([, result]) => ["completed", "failed", "cancelled"].includes(result.status))
      .map(([groupId]) => groupId);

    for (const groupId of completed) {
      this.activeGroups.delete(groupId);
    }

    logger.debug("Cleaned up completed task groups", { count: completed.length });
  }
}

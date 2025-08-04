import type { FastifyPluginAsync } from "fastify";
import { TaskStatus, type TaskRequest, type TaskResponse } from "../../claude/types.js";
import { logger } from "../../utils/logger.js";
import type { ErrorResponse, TaskLogResponse, TaskCancelResponse } from "../../types/api.js";
import { RetryService } from "../../services/retry-service.js";
import { checkApiKey } from "../middleware/auth.js";
import {
  TaskNotFoundError,
  InvalidTaskRequestError,
  TaskExecutionError,
  TaskCancellationError,
} from "../../utils/task-errors.js";
import { ConversationFormatter } from "../../utils/conversation-formatter.js";
import type { TaskFilter } from "../../db/types.js";

// eslint-disable-next-line @typescript-eslint/require-await
export const taskRoutes: FastifyPluginAsync = async (fastify) => {
  // Use shared services from app instance
  const taskQueue = fastify.queue;
  const repository = fastify.repository;

  // Get all tasks
  fastify.get<{
    Querystring: {
      status?: TaskStatus;
      repository?: string;
      limit?: number;
      offset?: number;
    };
    Reply: {
      tasks: TaskResponse[];
      total: number;
      limit: number;
      offset: number;
    };
  }>(
    "/tasks",
    {
      preHandler: checkApiKey,
      schema: {
        querystring: {
          type: "object",
          properties: {
            status: {
              type: "string",
              enum: Object.values(TaskStatus),
            },
            repository: { type: "string" },
            limit: { type: "number", minimum: 1, maximum: 100, default: 20 },
            offset: { type: "number", minimum: 0, default: 0 },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              tasks: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    taskId: { type: "string" },
                    status: { type: "string" },
                    instruction: { type: "string" },
                    createdAt: { type: "string" },
                    startedAt: { type: "string", nullable: true },
                    completedAt: { type: "string", nullable: true },
                    result: { nullable: true, additionalProperties: true },
                    error: {
                      type: "object",
                      nullable: true,
                      properties: {
                        message: { type: "string" },
                        code: { type: "string", nullable: true },
                      },
                    },
                    workingDirectory: { type: "string", nullable: true },
                    logs: { type: "array", nullable: true, items: { type: "string" } },
                    retryMetadata: { nullable: true, additionalProperties: true },
                    allowedTools: { type: "array", nullable: true, items: { type: "string" } },
                    continuedFrom: { type: "string", nullable: true },
                    sdkSessionId: { type: "string", nullable: true },
                  },
                },
              },
              total: { type: "number" },
              limit: { type: "number" },
              offset: { type: "number" },
            },
          },
        },
      },
    },
    (request, reply) => {
      const { status, repository: repositoryFilter, limit = 20, offset = 0 } = request.query;

      // Get tasks from database
      const filter: TaskFilter = {};
      if (status) {
        filter.status = status;
      }

      // Use partial matching for repository filter
      let tasks = [];
      let total = 0;

      if (repositoryFilter) {
        // Get all tasks first for repository filtering
        const allResult = repository.find(filter, { limit: 1000, offset: 0 });

        logger.debug("Repository filter - before filtering:", {
          repositoryFilter,
          allTasksCount: allResult.data.length,
        });

        // Filter by repository name in workingDirectory
        const filteredTasks = allResult.data.filter((task) => {
          const queuedTask = repository.toQueuedTask(task);
          const workingDir = queuedTask.request.context?.workingDirectory || "";
          const matches = workingDir.toLowerCase().includes(repositoryFilter.toLowerCase());

          if (matches) {
            logger.debug("Task matches repository filter:", {
              taskId: task.id,
              workingDir,
              repositoryFilter,
            });
          }

          return matches;
        });

        // Apply pagination to filtered results
        total = filteredTasks.length;
        tasks = filteredTasks.slice(offset, offset + limit);

        logger.debug("Repository filter applied:", {
          repositoryFilter,
          allTasksCount: allResult.data.length,
          filteredCount: filteredTasks.length,
          pageSize: limit,
          offset,
          returnedCount: tasks.length,
        });
      } else {
        const result = repository.find(filter, { limit, offset });
        tasks = result.data;
        total = result.total;
      }

      // Convert TaskRecords to TaskResponses
      const taskResponses = tasks.map((record) => {
        const queuedTask = repository.toQueuedTask(record);

        logger.debug("Task record context:", {
          taskId: record.id,
          recordContext: record.context,
          queuedTaskContext: queuedTask.request.context,
          workingDirectory: queuedTask.request.context?.workingDirectory,
          continuedFrom: record.continuedFrom,
        });

        const taskResponse = {
          taskId: queuedTask.id,
          status: queuedTask.status,
          instruction: queuedTask.request.instruction,
          createdAt: queuedTask.addedAt,
          startedAt: queuedTask.startedAt,
          completedAt: queuedTask.completedAt,
          result: queuedTask.result,
          error: queuedTask.error
            ? {
                message: queuedTask.error.message,
                code: "EXECUTION_ERROR",
              }
            : undefined,
          logs: record.progressData?.logs,
          retryMetadata: queuedTask.retryMetadata,
          allowedTools: queuedTask.request.options?.allowedTools,
          workingDirectory: queuedTask.request.context?.workingDirectory,
          todos: queuedTask.result?.todos,
          continuedFrom: record.continuedFrom || undefined,
          sdkSessionId: record.sdkSessionId,
          options: queuedTask.request.options || undefined,
        };

        return taskResponse;
      });

      const response = {
        tasks: taskResponses,
        total,
        limit,
        offset,
      };

      logger.debug("Final API response:", {
        taskCount: taskResponses.length,
        firstTask: taskResponses[0]
          ? {
              taskId: taskResponses[0].taskId,
              workingDirectory: taskResponses[0].workingDirectory,
            }
          : null,
      });

      void reply.send(response);
    },
  );

  // Create a new task
  fastify.post<{
    Body: TaskRequest;
    Reply: TaskResponse | ErrorResponse;
  }>(
    "/tasks",
    {
      preHandler: checkApiKey,
      schema: {
        body: {
          type: "object",
          properties: {
            instruction: { type: "string", minLength: 1 },
            context: {
              type: "object",
              properties: {
                workingDirectory: { type: "string" },
                files: { type: "array", items: { type: "string" } },
              },
            },
            options: {
              type: "object",
              properties: {
                timeout: {
                  oneOf: [
                    { type: "number", minimum: 1000, maximum: 600000 },
                    {
                      type: "object",
                      properties: {
                        total: { type: "number", minimum: 1000, maximum: 600000 },
                        setup: { type: "number", minimum: 100, maximum: 300000 },
                        execution: { type: "number", minimum: 1000, maximum: 600000 },
                        cleanup: { type: "number", minimum: 100, maximum: 60000 },
                        warningThreshold: { type: "number", minimum: 0.1, maximum: 1 },
                        behavior: { type: "string", enum: ["hard", "soft"] },
                      },
                    },
                  ],
                  default: 300000,
                },
                async: { type: "boolean", default: false },
                allowedTools: {
                  type: "array",
                  items: { type: "string" },
                  description: "Legacy option - use sdk.allowedTools instead",
                },
                sdk: {
                  type: "object",
                  properties: {
                    // Priority: High
                    maxTurns: {
                      type: "integer",
                      minimum: 1,
                      maximum: 50,
                      description: "Maximum conversation turns",
                    },
                    allowedTools: {
                      type: "array",
                      items: { type: "string" },
                      description: "List of allowed tools",
                    },
                    disallowedTools: {
                      type: "array",
                      items: { type: "string" },
                      description: "List of disallowed tools",
                    },
                    systemPrompt: {
                      type: "string",
                      maxLength: 10000,
                      description: "Custom system prompt",
                    },
                    permissionMode: {
                      type: "string",
                      enum: [
                        "default",
                        "acceptEdits",
                        "bypassPermissions",
                        "plan",
                        "ask",
                        "allow",
                        "deny",
                      ],
                      description: "Permission mode (ask/allow/deny will be mapped to SDK modes)",
                    },
                    // Priority: Medium
                    executable: {
                      type: "string",
                      enum: ["node", "bun", "deno"],
                      description: "JavaScript execution environment",
                    },
                    executableArgs: {
                      type: "array",
                      items: { type: "string" },
                      description: "Additional arguments for executable",
                    },
                    mcpConfig: {
                      type: "object",
                      additionalProperties: {
                        type: "object",
                        properties: {
                          command: { type: "string" },
                          args: {
                            type: "array",
                            items: { type: "string" },
                          },
                          env: {
                            type: "object",
                            additionalProperties: { type: "string" },
                          },
                          cwd: { type: "string" },
                        },
                        required: ["command"],
                      },
                      description: "MCP configuration",
                    },
                    continueSession: {
                      type: "boolean",
                      description: "Continue latest session",
                    },
                    resumeSession: {
                      type: "string",
                      description: "Resume specific session ID",
                    },
                    continueFromTaskId: {
                      type: "string",
                      description: "Continue from a previous task using its SDK session ID",
                    },
                    outputFormat: {
                      type: "string",
                      enum: ["text", "json", "stream-json"],
                      description: "Output format",
                    },
                    // Priority: Low
                    verbose: {
                      type: "boolean",
                      description: "Enable verbose logging",
                    },
                    permissionPromptTool: {
                      type: "string",
                      description: "Custom permission prompt tool",
                    },
                    pathToClaudeCodeExecutable: {
                      type: "string",
                      description: "Path to Claude Code executable",
                    },
                  },
                  additionalProperties: false,
                },
                useWorktree: {
                  type: "boolean",
                  description: "Enable Git worktree for isolated execution",
                },
                worktree: {
                  type: "object",
                  properties: {
                    enabled: { type: "boolean" },
                    baseBranch: { type: "string" },
                    branchName: { type: "string" },
                    keepAfterCompletion: { type: "boolean" },
                    autoCommit: { type: "boolean" },
                    commitMessage: { type: "string" },
                    autoMerge: { type: "boolean" },
                    mergeStrategy: {
                      type: "string",
                      enum: ["merge", "rebase", "squash"],
                    },
                    targetBranch: { type: "string" },
                  },
                  additionalProperties: false,
                },
              },
            },
          },
          required: ["instruction"],
        },
        response: {
          201: {
            type: "object",
            properties: {
              taskId: { type: "string" },
              status: { type: "string" },
              instruction: { type: "string" },
              createdAt: { type: "string" },
              startedAt: { type: "string", nullable: true },
              completedAt: { type: "string", nullable: true },
              result: { nullable: true, additionalProperties: true },
              error: {
                type: "object",
                nullable: true,
                properties: {
                  message: { type: "string" },
                  code: { type: "string", nullable: true },
                },
              },
              workingDirectory: { type: "string", nullable: true },
              logs: { type: "array", nullable: true, items: { type: "string" } },
              retryMetadata: { nullable: true, additionalProperties: true },
              allowedTools: { type: "array", nullable: true, items: { type: "string" } },
              sdkSessionId: { type: "string", nullable: true },
            },
          },
          202: {
            type: "object",
            properties: {
              taskId: { type: "string" },
              status: { type: "string" },
              instruction: { type: "string" },
              createdAt: { type: "string" },
              workingDirectory: { type: "string", nullable: true },
              retryMetadata: { nullable: true, additionalProperties: true },
              sdkSessionId: { type: "string", nullable: true },
            },
          },
        },
      },
    },
    async (request, reply) => {
      // Handle continueFromTaskId option
      let taskRequest = request.body;

      if (request.body.options?.sdk?.continueFromTaskId) {
        const previousTaskId = request.body.options.sdk.continueFromTaskId;
        const previousTask = repository.getById(previousTaskId);

        if (!previousTask) {
          throw new TaskNotFoundError(previousTaskId);
        }

        // Get the latest SDK session ID in the continuation chain
        const latestSdkSessionId = repository.getLatestSdkSessionId(previousTaskId);

        if (!latestSdkSessionId) {
          throw new InvalidTaskRequestError(
            "No SDK session ID found in the task chain. The tasks may have been executed before this feature was available.",
            "continueFromTaskId",
          );
        }

        // Update the request to use resumeSession with the latest SDK session ID
        taskRequest = {
          ...request.body,
          options: {
            ...request.body.options,
            sdk: {
              ...request.body.options?.sdk,
              resumeSession: latestSdkSessionId,
              // Keep continueFromTaskId for the queue to process
              continueFromTaskId: previousTaskId,
            },
          },
        };

        logger.info("Using latest SDK session from task chain", {
          previousTaskId,
          latestSdkSessionId,
          originalSdkSessionId: previousTask.sdkSessionId,
        });
      }

      // Add task to queue
      const taskId = taskQueue.add(taskRequest, 0);

      // Get task details
      const queuedTask = taskQueue.get(taskId);
      if (!queuedTask) {
        throw new TaskExecutionError("Failed to create task", taskId);
      }

      const task: TaskResponse = {
        taskId,
        status: TaskStatus.PENDING,
        instruction: taskRequest.instruction,
        createdAt: queuedTask.addedAt,
        retryMetadata: queuedTask.retryMetadata,
        workingDirectory: taskRequest.context?.workingDirectory,
      };

      // Handle async tasks
      if (taskRequest.options?.async) {
        return reply.status(202).send(task);
      }

      // Wait for task completion for sync tasks
      const timeout =
        typeof taskRequest.options?.timeout === "number"
          ? taskRequest.options.timeout
          : taskRequest.options?.timeout?.total || 300000;
      const startTime = Date.now();

      while (Date.now() - startTime < timeout) {
        const updatedTask = taskQueue.get(taskId);
        if (!updatedTask) break;

        if (
          updatedTask.status === TaskStatus.COMPLETED ||
          updatedTask.status === TaskStatus.FAILED ||
          updatedTask.status === TaskStatus.CANCELLED
        ) {
          // Get updated record to include sdkSessionId
          const updatedRecord = repository.getById(taskId);

          return reply.status(201).send({
            taskId,
            status: updatedTask.status,
            instruction: updatedTask.request.instruction,
            createdAt: updatedTask.addedAt,
            startedAt: updatedTask.startedAt,
            completedAt: updatedTask.completedAt,
            result: updatedTask.result,
            error: updatedTask.error
              ? {
                  message: updatedTask.error.message,
                  code: "EXECUTION_ERROR",
                }
              : undefined,
            logs: updatedTask.result?.logs,
            retryMetadata: updatedTask.retryMetadata,
            allowedTools: updatedTask.request.options?.allowedTools,
            workingDirectory: updatedTask.request.context?.workingDirectory,
            sdkSessionId: updatedRecord?.sdkSessionId,
            options: updatedTask.request.options || undefined,
          });
        }

        // Wait a bit before checking again
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // Timeout
      return reply.status(408).send({
        error: {
          message: "Task execution timed out",
          statusCode: 408,
          code: "TIMEOUT",
        },
      });
    },
  );

  // Get task status
  fastify.get<{
    Params: { taskId: string };
    Reply: TaskResponse | ErrorResponse;
  }>(
    "/tasks/:taskId",
    {
      preHandler: checkApiKey,
      schema: {
        params: {
          type: "object",
          properties: {
            taskId: { type: "string" },
          },
          required: ["taskId"],
        },
        // レスポンススキーマを削除（Fastifyのバグ回避）
      },
    },
    (request, reply) => {
      const record = repository.getById(request.params.taskId);

      if (!record) {
        throw new TaskNotFoundError(request.params.taskId);
      }

      const queuedTask = repository.toQueuedTask(record);
      const task: TaskResponse = {
        taskId: queuedTask.id,
        status: queuedTask.status,
        instruction: queuedTask.request.instruction,
        createdAt: queuedTask.addedAt,
        startedAt: queuedTask.startedAt,
        completedAt: queuedTask.completedAt,
        result: queuedTask.result,
        error: queuedTask.error
          ? {
              message: queuedTask.error.message,
              code: "EXECUTION_ERROR",
            }
          : undefined,
        logs: record.progressData?.logs,
        retryMetadata: queuedTask.retryMetadata,
        allowedTools: queuedTask.request.options?.allowedTools,
        workingDirectory: queuedTask.request.context?.workingDirectory,
        repositoryName: record.repositoryName || undefined,
        groupId: record.groupId || undefined,
        todos: record.progressData?.todos,
        continuedFrom: record.continuedFrom || undefined,
        progressData: record.progressData || undefined,
        sdkSessionId: record.sdkSessionId,
        conversationHistory: record.conversationHistory || undefined,
        options: {
          ...(queuedTask.request.options || {}),
          // SDK情報やworktree情報を含む
        },
      };

      void reply.send(task);
    },
  );

  // Get task logs
  fastify.get<{
    Params: { taskId: string };
    Reply: TaskLogResponse | ErrorResponse;
  }>(
    "/tasks/:taskId/logs",
    {
      preHandler: checkApiKey,
    },
    (request, reply) => {
      const record = repository.getById(request.params.taskId);

      if (!record) {
        throw new TaskNotFoundError(request.params.taskId);
      }

      const logResponse: TaskLogResponse = {
        taskId: request.params.taskId,
        logs: record.progressData?.logs || [],
      };
      void reply.send(logResponse);
    },
  );

  // Cancel a task
  fastify.delete<{
    Params: { taskId: string };
    Reply: TaskCancelResponse | ErrorResponse;
  }>(
    "/tasks/:taskId",
    {
      preHandler: checkApiKey,
    },
    async (request, reply) => {
      const record = repository.getById(request.params.taskId);

      if (!record) {
        const errorResponse: ErrorResponse = {
          error: {
            message: "Task not found",
            statusCode: 404,
            code: "TASK_NOT_FOUND",
          },
        };
        return reply.status(404).send(errorResponse);
      }

      if (record.status !== "pending" && record.status !== "running") {
        throw new InvalidTaskRequestError("Task cannot be cancelled in current state", "status");
      }

      // Cancel the task
      const success = await taskQueue.cancelTask(request.params.taskId);

      if (!success) {
        throw new TaskCancellationError(request.params.taskId, "Failed to cancel task");
      }

      const cancelResponse: TaskCancelResponse = {
        message: "Task cancelled successfully",
        taskId: request.params.taskId,
      };
      return reply.send(cancelResponse);
    },
  );

  // Retry a failed task
  fastify.post<{
    Params: { taskId: string };
    Reply: TaskResponse | ErrorResponse;
  }>(
    "/tasks/:taskId/retry",
    {
      preHandler: checkApiKey,
    },
    async (request, reply) => {
      const record = repository.getById(request.params.taskId);

      if (!record) {
        const errorResponse: ErrorResponse = {
          error: {
            message: "Task not found",
            statusCode: 404,
            code: "TASK_NOT_FOUND",
          },
        };
        return reply.status(404).send(errorResponse);
      }

      // Check if task can be retried
      if (record.status !== "failed") {
        throw new InvalidTaskRequestError("Only failed tasks can be retried", "status");
      }

      // Check if task has retries configured
      const queuedTask = repository.toQueuedTask(record);
      const retryConfig = RetryService.getRetryOptions(queuedTask.request.options);

      if (!retryConfig.maxRetries || retryConfig.maxRetries === 0) {
        throw new InvalidTaskRequestError("Task does not have retry configured", "retryConfig");
      }

      // Check if max retries already reached
      if (record.retryCount >= record.maxRetries) {
        throw new InvalidTaskRequestError("Maximum retry attempts already reached", "retryCount");
      }

      try {
        // Reset task for retry
        repository.resetTaskForRetry(request.params.taskId);

        // Update retry metadata
        const error = queuedTask.error || new Error("Previous attempt failed");
        const errorInfo = {
          message: error.message,
          code: "MANUAL_RETRY",
        };

        const updatedRetryMetadata = RetryService.updateRetryMetadata(
          queuedTask.retryMetadata,
          errorInfo,
          queuedTask.startedAt || new Date(),
          queuedTask.completedAt || new Date(),
          retryConfig,
        );

        repository.updateRetryMetadata(request.params.taskId, updatedRetryMetadata);

        // Re-add task to queue
        const newTaskId = taskQueue.add(queuedTask.request, queuedTask.priority);

        // Get the new task
        const newTask = taskQueue.get(newTaskId);
        if (!newTask) {
          throw new TaskExecutionError(
            "Failed to create retry task",
            newTaskId,
            new Error(`Original task ID: ${request.params.taskId}`),
          );
        }

        const response: TaskResponse = {
          taskId: newTaskId,
          status: TaskStatus.PENDING,
          instruction: newTask.request.instruction,
          createdAt: newTask.addedAt,
          retryMetadata: updatedRetryMetadata,
        };

        logger.info("Task manually retried", {
          originalTaskId: request.params.taskId,
          newTaskId,
          currentAttempt: updatedRetryMetadata.currentAttempt,
          maxRetries: updatedRetryMetadata.maxRetries,
        });

        return reply.status(201).send(response);
      } catch (error) {
        logger.error("Failed to retry task", { taskId: request.params.taskId, error });
        throw new TaskExecutionError(
          "Failed to retry task",
          request.params.taskId,
          error instanceof Error ? error : undefined,
        );
      }
    },
  );

  // Continue task from completed task
  fastify.post<{
    Params: { taskId: string };
    Body: TaskRequest;
    Reply: (TaskResponse & { continuedFrom?: string }) | ErrorResponse;
  }>(
    "/tasks/:taskId/continue",
    {
      preHandler: checkApiKey,
      schema: {
        params: {
          type: "object",
          properties: {
            taskId: { type: "string" },
          },
          required: ["taskId"],
        },
        body: {
          type: "object",
          properties: {
            instruction: { type: "string", minLength: 1 },
            context: {
              type: "object",
              properties: {
                workingDirectory: { type: "string" },
                files: { type: "array", items: { type: "string" } },
              },
            },
            options: {
              type: "object",
              properties: {
                timeout: {
                  oneOf: [
                    { type: "number", minimum: 1000, maximum: 600000 },
                    {
                      type: "object",
                      properties: {
                        total: { type: "number", minimum: 1000, maximum: 600000 },
                        setup: { type: "number", minimum: 100, maximum: 300000 },
                        execution: { type: "number", minimum: 1000, maximum: 600000 },
                        cleanup: { type: "number", minimum: 100, maximum: 60000 },
                        warningThreshold: { type: "number", minimum: 0.1, maximum: 1 },
                        behavior: { type: "string", enum: ["hard", "soft"] },
                      },
                    },
                  ],
                  default: 300000,
                },
                async: { type: "boolean", default: false },
                sdk: {
                  type: "object",
                  additionalProperties: true,
                },
              },
            },
          },
          required: ["instruction"],
        },
        response: {
          201: {
            type: "object",
            properties: {
              taskId: { type: "string" },
              status: { type: "string" },
              instruction: { type: "string" },
              createdAt: { type: "string" },
              continuedFrom: { type: "string" },
              parentTaskId: { type: "string", nullable: true },
              conversationHistory: { type: "array", nullable: true, items: { type: "object" } },
            },
          },
          400: {
            type: "object",
            properties: {
              error: {
                type: "object",
                properties: {
                  message: { type: "string" },
                  statusCode: { type: "number" },
                  code: { type: "string" },
                },
              },
            },
          },
          404: {
            type: "object",
            properties: {
              error: {
                type: "object",
                properties: {
                  message: { type: "string" },
                  statusCode: { type: "number" },
                  code: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const parentTaskId = request.params.taskId;
      const parentRecord = repository.getById(parentTaskId);

      if (!parentRecord) {
        throw new TaskNotFoundError(parentTaskId);
      }

      // Check if parent task is completed
      if (parentRecord.status !== "completed") {
        throw new InvalidTaskRequestError("Can only continue from completed tasks", "status");
      }

      // Build continuation task request
      const parentTask = repository.toQueuedTask(parentRecord);

      // Check if working directory matches
      const parentWorkingDir = parentTask.request.context?.workingDirectory;
      const requestWorkingDir = request.body.context?.workingDirectory;

      // Check if cross-repository continuation is allowed
      // Automatically allow cross-repository if working directory is explicitly specified and different
      const allowCrossRepository =
        request.body.options?.allowCrossRepository === true ||
        (requestWorkingDir !== undefined && requestWorkingDir !== parentWorkingDir);

      // If both are specified and they don't match, log the cross-repository continuation
      if (parentWorkingDir && requestWorkingDir && parentWorkingDir !== requestWorkingDir) {
        // Log cross-repository continuation
        logger.info("Cross-repository continuation detected", {
          parentTaskId,
          parentWorkingDir,
          requestWorkingDir,
          allowCrossRepository,
        });
      }

      // Use saved conversation history if available
      let systemPrompt: string;
      let conversationHistory: any;

      // Add cross-repository context if needed
      const crossRepoContext =
        allowCrossRepository && parentWorkingDir !== requestWorkingDir
          ? `\n\nNote: This is a cross-repository continuation. Previous task was in ${parentWorkingDir}, now working in ${requestWorkingDir || "current directory"}.`
          : "";

      if (parentRecord.conversationHistory) {
        // Format SDK messages for system prompt
        systemPrompt =
          ConversationFormatter.formatForSystemPrompt(parentRecord.conversationHistory) +
          crossRepoContext;
        conversationHistory = parentRecord.conversationHistory;
      } else {
        // Fallback to simple format
        systemPrompt = `Previous conversation:
User: ${parentTask.request.instruction}
Assistant: ${String(parentTask.result?.result || "Task completed")}

Please continue from the above conversation, maintaining context and remembering what was discussed.${crossRepoContext}`;
        conversationHistory = [
          {
            instruction: parentTask.request.instruction,
            response: parentTask.result?.result || "Task completed",
            logs: parentTask.result?.logs,
          },
        ];
      }

      // Determine working directory
      let workingDirectory: string | undefined;
      if (allowCrossRepository && requestWorkingDir) {
        workingDirectory = requestWorkingDir;
      } else if (parentWorkingDir) {
        // Check if parent working directory exists
        const fs = await import("fs");
        try {
          const stats = await fs.promises.stat(parentWorkingDir);
          if (stats.isDirectory()) {
            workingDirectory = parentWorkingDir;
          } else {
            logger.warn("Parent working directory is not a directory", { parentWorkingDir });
            workingDirectory = request.body.context?.workingDirectory;
          }
        } catch (error) {
          logger.warn("Parent working directory does not exist", {
            parentWorkingDir,
            error: error instanceof Error ? error.message : String(error),
          });
          // Fallback to request working directory or undefined
          workingDirectory = request.body.context?.workingDirectory;
        }
      } else {
        workingDirectory = request.body.context?.workingDirectory;
      }

      // Create new task with parent context
      const continuationRequest: TaskRequest = {
        instruction: request.body.instruction,
        context: {
          ...request.body.context,
          parentTaskId,
          continuedFrom: parentTaskId,
          conversationHistory,
          workingDirectory,
        },
        options: {
          ...request.body.options,
          sdk: {
            ...request.body.options?.sdk,
            // Use formatted system prompt
            systemPrompt: request.body.options?.sdk?.systemPrompt || systemPrompt,
          },
        },
      };

      // Add task to queue
      const taskId = taskQueue.add(continuationRequest, 0);
      const queuedTask = taskQueue.get(taskId);

      if (!queuedTask) {
        throw new TaskExecutionError(
          "Failed to create continuation task",
          taskId,
          new Error(`Parent task ID: ${parentTaskId}`),
        );
      }

      const response: TaskResponse & { continuedFrom?: string } = {
        taskId,
        status: TaskStatus.PENDING,
        instruction: request.body.instruction,
        createdAt: queuedTask.addedAt,
        continuedFrom: parentTaskId,
        workingDirectory: continuationRequest.context?.workingDirectory,
      };

      // Handle async option
      if (request.body.options?.async) {
        return reply.status(202).send(response);
      }

      return reply.status(201).send(response);
    },
  );
};

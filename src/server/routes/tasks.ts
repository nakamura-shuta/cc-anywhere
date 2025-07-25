import type { FastifyPluginAsync } from "fastify";
import { TaskStatus, type TaskRequest, type TaskResponse } from "../../claude/types";
import { logger } from "../../utils/logger";
import type { ErrorResponse, TaskLogResponse, TaskCancelResponse } from "../../types/api";
import { RetryService } from "../../services/retry-service";
import { checkApiKey } from "../middleware/auth";
import { SystemError } from "../../utils/errors";
import { ConversationFormatter } from "../../utils/conversation-formatter";

// eslint-disable-next-line @typescript-eslint/require-await
export const taskRoutes: FastifyPluginAsync = async (fastify) => {
  // Use shared services from app instance
  const taskQueue = fastify.queue;
  const repository = fastify.repository;

  // Get all tasks
  fastify.get<{
    Querystring: {
      status?: TaskStatus;
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
      const { status, limit = 20, offset = 0 } = request.query;

      // Get tasks from database
      const filter = status ? { status } : {};
      const result = repository.find(filter, { limit, offset });

      // Convert TaskRecords to TaskResponses
      const tasks = result.data.map((record) => {
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
          result: queuedTask.result?.result,
          error: queuedTask.error
            ? {
                message: queuedTask.error.message,
                code: "EXECUTION_ERROR",
              }
            : undefined,
          logs: queuedTask.result?.logs,
          retryMetadata: queuedTask.retryMetadata,
          allowedTools: queuedTask.request.options?.allowedTools,
          workingDirectory: queuedTask.request.context?.workingDirectory,
          todos: queuedTask.result?.todos,
          continuedFrom: record.continuedFrom || undefined,
        };

        return taskResponse;
      });

      const response = {
        tasks,
        total: result.total,
        limit: result.limit,
        offset: result.offset,
      };

      logger.debug("Final API response:", {
        taskCount: tasks.length,
        firstTask: tasks[0]
          ? {
              taskId: tasks[0].taskId,
              workingDirectory: tasks[0].workingDirectory,
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
            },
          },
        },
      },
    },
    async (request, reply) => {
      // Add task to queue
      const taskId = taskQueue.add(request.body, 0);

      // Get task details
      const queuedTask = taskQueue.get(taskId);
      if (!queuedTask) {
        throw new SystemError("Failed to create task", { taskId });
      }

      const task: TaskResponse = {
        taskId,
        status: TaskStatus.PENDING,
        instruction: request.body.instruction,
        createdAt: queuedTask.addedAt,
        retryMetadata: queuedTask.retryMetadata,
        workingDirectory: request.body.context?.workingDirectory,
      };

      // Handle async tasks
      if (request.body.options?.async) {
        return reply.status(202).send(task);
      }

      // Wait for task completion for sync tasks
      const timeout =
        typeof request.body.options?.timeout === "number"
          ? request.body.options.timeout
          : request.body.options?.timeout?.total || 300000;
      const startTime = Date.now();

      while (Date.now() - startTime < timeout) {
        const updatedTask = taskQueue.get(taskId);
        if (!updatedTask) break;

        if (
          updatedTask.status === TaskStatus.COMPLETED ||
          updatedTask.status === TaskStatus.FAILED ||
          updatedTask.status === TaskStatus.CANCELLED
        ) {
          return reply.status(201).send({
            taskId,
            status: updatedTask.status,
            instruction: updatedTask.request.instruction,
            createdAt: updatedTask.addedAt,
            startedAt: updatedTask.startedAt,
            completedAt: updatedTask.completedAt,
            result: updatedTask.result?.result,
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
    },
    (request, reply) => {
      const record = repository.getById(request.params.taskId);

      if (!record) {
        const errorResponse: ErrorResponse = {
          error: {
            message: "Task not found",
            statusCode: 404,
            code: "TASK_NOT_FOUND",
          },
        };
        void reply.status(404).send(errorResponse);
        return;
      }

      const queuedTask = repository.toQueuedTask(record);
      const task: TaskResponse = {
        taskId: queuedTask.id,
        status: queuedTask.status,
        instruction: queuedTask.request.instruction,
        createdAt: queuedTask.addedAt,
        startedAt: queuedTask.startedAt,
        completedAt: queuedTask.completedAt,
        result: queuedTask.result?.result,
        error: queuedTask.error
          ? {
              message: queuedTask.error.message,
              code: "EXECUTION_ERROR",
            }
          : undefined,
        logs: queuedTask.result?.logs,
        retryMetadata: queuedTask.retryMetadata,
        allowedTools: queuedTask.request.options?.allowedTools,
        workingDirectory: queuedTask.request.context?.workingDirectory,
        repositoryName: record.repositoryName || undefined,
        groupId: record.groupId || undefined,
        todos: queuedTask.result?.todos || record.progressData?.todos,
        continuedFrom: record.continuedFrom || undefined,
        progressData: record.progressData || undefined,
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
        const errorResponse: ErrorResponse = {
          error: {
            message: "Task not found",
            statusCode: 404,
            code: "TASK_NOT_FOUND",
          },
        };
        void reply.status(404).send(errorResponse);
        return;
      }

      const queuedTask = repository.toQueuedTask(record);
      const logResponse: TaskLogResponse = {
        taskId: request.params.taskId,
        logs: queuedTask.result?.logs || [],
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
        const errorResponse: ErrorResponse = {
          error: {
            message: "Task cannot be cancelled in current state",
            statusCode: 400,
            code: "INVALID_STATE",
          },
        };
        return reply.status(400).send(errorResponse);
      }

      // Cancel the task
      const success = await taskQueue.cancelTask(request.params.taskId);

      if (!success) {
        const errorResponse: ErrorResponse = {
          error: {
            message: "Failed to cancel task",
            statusCode: 500,
            code: "CANCEL_FAILED",
          },
        };
        return reply.status(500).send(errorResponse);
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
        const errorResponse: ErrorResponse = {
          error: {
            message: "Only failed tasks can be retried",
            statusCode: 400,
            code: "INVALID_STATE",
          },
        };
        return reply.status(400).send(errorResponse);
      }

      // Check if task has retries configured
      const queuedTask = repository.toQueuedTask(record);
      const retryConfig = RetryService.getRetryOptions(queuedTask.request.options);

      if (!retryConfig.maxRetries || retryConfig.maxRetries === 0) {
        const errorResponse: ErrorResponse = {
          error: {
            message: "Task does not have retry configured",
            statusCode: 400,
            code: "NO_RETRY_CONFIG",
          },
        };
        return reply.status(400).send(errorResponse);
      }

      // Check if max retries already reached
      if (record.retryCount >= record.maxRetries) {
        const errorResponse: ErrorResponse = {
          error: {
            message: "Maximum retry attempts already reached",
            statusCode: 400,
            code: "MAX_RETRIES_REACHED",
          },
        };
        return reply.status(400).send(errorResponse);
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
          throw new SystemError("Failed to create retry task", {
            originalTaskId: request.params.taskId,
            newTaskId,
          });
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

        const errorResponse: ErrorResponse = {
          error: {
            message: "Failed to retry task",
            statusCode: 500,
            code: "RETRY_FAILED",
          },
        };
        return reply.status(500).send(errorResponse);
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
        const errorResponse: ErrorResponse = {
          error: {
            message: "Parent task not found",
            statusCode: 404,
            code: "PARENT_TASK_NOT_FOUND",
          },
        };
        return reply.status(404).send(errorResponse);
      }

      // Check if parent task is completed
      if (parentRecord.status !== "completed") {
        const errorResponse: ErrorResponse = {
          error: {
            message: "Can only continue from completed tasks",
            statusCode: 400,
            code: "INVALID_STATE",
          },
        };
        return reply.status(400).send(errorResponse);
      }

      // Build continuation task request
      const parentTask = repository.toQueuedTask(parentRecord);

      // Check if working directory matches
      const parentWorkingDir = parentTask.request.context?.workingDirectory;
      const requestWorkingDir = request.body.context?.workingDirectory;

      // Check if cross-repository continuation is allowed
      const allowCrossRepository = request.body.options?.allowCrossRepository === true;

      // If both are specified and they don't match, check if cross-repository is allowed
      if (parentWorkingDir && requestWorkingDir && parentWorkingDir !== requestWorkingDir) {
        if (!allowCrossRepository) {
          const errorResponse: ErrorResponse = {
            error: {
              message:
                "Continuation tasks must use the same working directory as the parent task. Set options.allowCrossRepository to true to enable cross-repository continuation.",
              statusCode: 400,
              code: "WORKING_DIRECTORY_MISMATCH",
            },
          };
          return reply.status(400).send(errorResponse);
        }

        // Log cross-repository continuation
        logger.info("Cross-repository continuation enabled", {
          parentTaskId,
          parentWorkingDir,
          requestWorkingDir,
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

      // Create new task with parent context
      const continuationRequest: TaskRequest = {
        instruction: request.body.instruction,
        context: {
          ...request.body.context,
          parentTaskId,
          continuedFrom: parentTaskId,
          conversationHistory,
          // Use requested working directory for cross-repository, otherwise use parent's
          workingDirectory:
            allowCrossRepository && requestWorkingDir
              ? requestWorkingDir
              : parentWorkingDir || request.body.context?.workingDirectory,
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
        throw new SystemError("Failed to create continuation task", { parentTaskId, taskId });
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

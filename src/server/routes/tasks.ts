import type { FastifyPluginAsync } from "fastify";
import { TaskStatus, type TaskRequest, type TaskResponse } from "../../claude/types";
import { logger } from "../../utils/logger";
import type { ErrorResponse, TaskLogResponse, TaskCancelResponse } from "../../types/api";
import { RetryService } from "../../services/retry-service";
import { TaskRepository } from "../../db/task-repository";
import { checkApiKey } from "../middleware/auth";
import { SystemError } from "../../utils/errors";

// eslint-disable-next-line @typescript-eslint/require-await
export const taskRoutes: FastifyPluginAsync = async (fastify) => {
  // Use shared services from app instance
  const taskQueue = fastify.queue;
  const repository = new TaskRepository();

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
        return {
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
        } as TaskResponse;
      });

      void reply.send({
        tasks,
        total: result.total,
        limit: result.limit,
        offset: result.offset,
      });
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
            },
          },
          202: {
            type: "object",
            properties: {
              taskId: { type: "string" },
              status: { type: "string" },
              instruction: { type: "string" },
              createdAt: { type: "string" },
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
        repositoryName: record.repository_name || undefined,
        groupId: record.group_id || undefined,
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
      const retryConfig = RetryService.getRetryConfig(queuedTask.request.options);

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
      if (record.current_attempt >= record.max_retries) {
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

        repository.updateRetryMetadata(
          request.params.taskId,
          updatedRetryMetadata,
          undefined, // No delay for manual retry
        );

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
};

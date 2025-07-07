import type { FastifyPluginAsync } from "fastify";
import { BatchTaskService } from "../../services/batch-task-service";
import { TaskRepository } from "../../db/task-repository";
import { checkApiKey } from "../middleware/auth";

export const batchTaskRoutes: FastifyPluginAsync = async (app: any) => {
  // Initialize services
  const taskRepository = new TaskRepository();

  // Ensure queue is available
  if (!app.queue) {
    app.log.error("Task queue not initialized");
    throw new Error("Task queue not initialized");
  }

  const batchTaskService = new BatchTaskService(taskRepository, app.queue);

  // POST /batch/tasks - Create batch tasks
  app.post(
    "/batch/tasks",
    {
      preHandler: checkApiKey,
      schema: {
        body: {
          type: "object",
          required: ["instruction", "repositories"],
          properties: {
            instruction: { type: "string", minLength: 1 },
            repositories: {
              type: "array",
              minItems: 1,
              items: {
                type: "object",
                required: ["name", "path"],
                properties: {
                  name: { type: "string", minLength: 1 },
                  path: { type: "string", minLength: 1 },
                  timeout: { type: "number" },
                  retryOptions: {
                    type: "object",
                    properties: {
                      maxRetries: { type: "number" },
                      initialDelay: { type: "number" },
                      maxDelay: { type: "number" },
                    },
                  },
                },
              },
            },
            options: {
              type: "object",
              properties: {
                timeout: { type: "number" },
                allowedTools: { type: "array", items: { type: "string" } },
                retry: {
                  type: "object",
                  properties: {
                    maxRetries: { type: "number" },
                    initialDelay: { type: "number" },
                    maxDelay: { type: "number" },
                  },
                },
              },
            },
          },
        },
        response: {
          201: {
            type: "object",
            properties: {
              groupId: { type: "string" },
              tasks: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    taskId: { type: "string" },
                    repository: { type: "string" },
                    status: { type: "string" },
                  },
                },
              },
            },
          },
          400: {
            type: "object",
            properties: {
              message: { type: "string" },
              error: { type: "string" },
            },
          },
        },
      },
    },
    async (request: any, reply: any) => {
      try {
        const params = request.body;

        // Validate instruction
        if (!params.instruction) {
          return reply.status(400).send({
            message: "instruction is required",
          });
        }

        // Validate repositories
        if (!params.repositories || params.repositories.length === 0) {
          return reply.status(400).send({
            message: "At least one repository is required",
          });
        }

        const result = await batchTaskService.createBatchTasks(params);

        return reply.status(201).send(result);
      } catch (error) {
        app.log.error("Failed to create batch tasks", {
          error: error instanceof Error ? error.message : error,
          stack: error instanceof Error ? error.stack : undefined,
        });

        if (error instanceof Error && error.message.includes("at least one repository")) {
          return reply.status(400).send({
            message: error.message,
          });
        }

        throw error;
      }
    },
  );

  // GET /batch/tasks/:groupId/status - Get batch task status
  app.get(
    "/batch/tasks/:groupId/status",
    {
      preHandler: checkApiKey,
      schema: {
        params: {
          type: "object",
          properties: {
            groupId: { type: "string" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              groupId: { type: "string" },
              summary: {
                type: "object",
                properties: {
                  total: { type: "number" },
                  pending: { type: "number" },
                  running: { type: "number" },
                  completed: { type: "number" },
                  failed: { type: "number" },
                },
              },
              tasks: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    taskId: { type: "string" },
                    repository: { type: "string" },
                    status: { type: "string" },
                    duration: { type: "number" },
                    result: {},
                    error: {},
                  },
                },
              },
            },
          },
          404: {
            type: "object",
            properties: {
              message: { type: "string" },
            },
          },
        },
      },
    },
    async (request: any, reply: any) => {
      const { groupId } = request.params;

      const status = await batchTaskService.getBatchTaskStatus(groupId);

      if (!status) {
        return reply.status(404).send({
          message: `Batch task group ${groupId} not found`,
        });
      }

      return reply.send(status);
    },
  );
};

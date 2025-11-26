import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { SystemError } from "../../utils/errors.js";
import { logger } from "../../utils/logger.js";

// Request schemas
const addToQueueSchema = z.object({
  instruction: z.string().min(1),
  context: z
    .object({
      workingDirectory: z.string().optional(),
      files: z.array(z.string()).optional(),
    })
    .optional(),
  options: z
    .object({
      timeout: z.number().positive().optional(),
      allowedTools: z.array(z.string()).optional(),
      executor: z.enum(["claude", "codex", "gemini"]).optional(),
      // Gemini SDK options
      gemini: z
        .object({
          model: z.string().optional(),
          thinkingBudget: z.number().positive().optional(),
          enableGoogleSearch: z.boolean().optional(),
          enableCodeExecution: z.boolean().optional(),
          streaming: z.boolean().optional(),
          systemPrompt: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
  priority: z.number().default(0),
  enableHooks: z.boolean().optional(),
  hookConfig: z
    .object({
      enablePreToolUse: z.boolean().optional(),
      enablePostToolUse: z.boolean().optional(),
      toolMatcher: z.string().optional(),
    })
    .optional(),
});

const queueRoutes: FastifyPluginAsync = async (fastify) => {
  // Get queue instance from app context
  const queue = fastify.queue;

  if (!queue) {
    throw new Error("Task queue not initialized");
  }

  // Add task to queue
  fastify.post<{ Body: z.infer<typeof addToQueueSchema> }>(
    "/queue/tasks",
    {
      schema: {
        body: zodToJsonSchema(addToQueueSchema),
        response: {
          201: {
            type: "object",
            properties: {
              taskId: { type: "string" },
              position: { type: "number" },
              status: { type: "string" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const parsed = addToQueueSchema.parse(request.body);
      const { priority, enableHooks, hookConfig, ...rest } = parsed;

      // Build TaskRequest with proper SDK options structure
      const taskRequest: Record<string, unknown> = {
        instruction: rest.instruction,
      };

      // Only add context if provided
      if (rest.context) {
        taskRequest.context = rest.context;
      }

      // Build options - enableHooks defaults to true
      taskRequest.options = {
        ...rest.options,
        sdk: {
          enableHooks: enableHooks ?? true, // Default to true
          hookConfig,
        },
      };

      try {
        const taskId = await queue.add(taskRequest as any, priority);
        const task = queue.get(taskId);
        const stats = queue.getStats();

        logger.info("Task added to queue", {
          taskId,
          instruction: taskRequest.instruction,
          priority,
          queueSize: stats.size,
        });

        return reply.status(201).send({
          taskId,
          position: stats.pending,
          status: task?.status || "pending",
        });
      } catch (error) {
        logger.error("Failed to add task to queue", { error });
        throw new SystemError("Failed to add task to queue", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
  );

  // Get queue statistics
  fastify.get(
    "/queue/stats",
    {
      schema: {
        response: {
          200: {
            type: "object",
            properties: {
              size: { type: "number" },
              pending: { type: "number" },
              running: { type: "number" },
              completed: { type: "number" },
              failed: { type: "number" },
              isPaused: { type: "boolean" },
              concurrency: { type: "number" },
            },
          },
        },
      },
    },
    async () => {
      const stats = queue.getStats();

      return {
        ...stats,
        concurrency: (queue as any).concurrency,
      };
    },
  );

  // Get all tasks in queue
  fastify.get(
    "/queue/tasks",
    {
      schema: {
        querystring: {
          type: "object",
          properties: {
            status: {
              type: "string",
              enum: ["pending", "running", "completed", "failed", "cancelled"],
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
                    id: { type: "string" },
                    instruction: { type: "string" },
                    status: { type: "string" },
                    priority: { type: "number" },
                    addedAt: { type: "string", format: "date-time" },
                    startedAt: { type: "string", format: "date-time", nullable: true },
                    completedAt: { type: "string", format: "date-time", nullable: true },
                  },
                },
              },
              total: { type: "number" },
            },
          },
        },
      },
    },
    async (request) => {
      const { status, limit, offset } = request.query as any;

      let tasks = queue.getAll();

      // Filter by status if provided
      if (status) {
        tasks = tasks.filter((t) => t.status === status);
      }

      const total = tasks.length;

      // Apply pagination
      tasks = tasks.slice(offset, offset + limit);

      return {
        tasks: tasks.map((t) => ({
          id: t.id,
          instruction: t.request.instruction,
          status: t.status,
          priority: t.priority,
          addedAt: t.addedAt.toISOString(),
          startedAt: t.startedAt?.toISOString() || null,
          completedAt: t.completedAt?.toISOString() || null,
        })),
        total,
      };
    },
  );

  // Get specific task from queue
  fastify.get<{ Params: { taskId: string } }>(
    "/queue/tasks/:taskId",
    {
      schema: {
        params: {
          type: "object",
          properties: {
            taskId: { type: "string" },
          },
          required: ["taskId"],
        },
      },
    },
    async (request, reply) => {
      const { taskId } = request.params;
      const task = queue.get(taskId);

      if (!task) {
        return reply.status(404).send({
          error: {
            message: "Task not found in queue",
            statusCode: 404,
            code: "TASK_NOT_FOUND",
          },
        });
      }

      return (
        task.result || {
          taskId: task.id,
          status: task.status,
          instruction: task.request.instruction,
          createdAt: task.addedAt,
          startedAt: task.startedAt,
          completedAt: task.completedAt,
          priority: task.priority,
        }
      );
    },
  );

  // Control queue operations
  fastify.post("/queue/start", async () => {
    queue.start();
    return { message: "Queue started" };
  });

  fastify.post("/queue/pause", async () => {
    queue.pause();
    return { message: "Queue paused" };
  });

  fastify.post("/queue/clear", async () => {
    queue.clear();
    return { message: "Queue cleared" };
  });

  // Update queue concurrency
  fastify.put(
    "/queue/concurrency",
    {
      schema: {
        body: {
          type: "object",
          properties: {
            concurrency: { type: "number", minimum: 1, maximum: 10 },
          },
          required: ["concurrency"],
        },
      },
    },
    async (request) => {
      const { concurrency } = request.body as any;
      (queue as any).concurrency = concurrency;

      return {
        message: "Queue concurrency updated",
        concurrency,
      };
    },
  );

  // Cancel a task in the queue
  fastify.delete<{ Params: { taskId: string } }>(
    "/queue/tasks/:taskId",
    {
      schema: {
        params: {
          type: "object",
          properties: {
            taskId: { type: "string" },
          },
          required: ["taskId"],
        },
        response: {
          200: {
            type: "object",
            properties: {
              message: { type: "string" },
              taskId: { type: "string" },
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
        },
      },
    },
    async (request, reply) => {
      const { taskId } = request.params;

      // Check if task exists
      const task = queue.get(taskId);
      if (!task) {
        return reply.status(404).send({
          error: {
            message: "Task not found in queue",
            statusCode: 404,
            code: "TASK_NOT_FOUND",
          },
        });
      }

      // Attempt to cancel the task
      const cancelled = await queue.cancelTask(taskId);

      if (!cancelled) {
        return reply.status(400).send({
          error: {
            message: "Task cannot be cancelled in current state",
            statusCode: 400,
            code: "INVALID_STATE",
          },
        });
      }

      return {
        message: "Task cancelled successfully",
        taskId,
      };
    },
  );
};

export default queueRoutes;

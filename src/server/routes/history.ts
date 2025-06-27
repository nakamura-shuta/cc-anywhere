import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { TaskRepository } from "../../db/task-repository.js";
import type { TaskFilter, PaginationOptions } from "../../db/types.js";

// Schema for query parameters
const taskHistoryQuerySchema = z.object({
  status: z
    .union([
      z.enum(["pending", "running", "completed", "failed", "cancelled"]),
      z.array(z.enum(["pending", "running", "completed", "failed", "cancelled"])),
    ])
    .optional(),
  priority: z.coerce.number().int().min(0).optional(),
  createdAfter: z.string().datetime().optional(),
  createdBefore: z.string().datetime().optional(),
  search: z.string().min(1).max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  orderBy: z.enum(["created_at", "updated_at", "priority"]).default("created_at"),
  orderDirection: z.enum(["ASC", "DESC"]).default("DESC"),
});

// Schema for task detail response
const taskDetailSchema = z.object({
  id: z.string(),
  instruction: z.string(),
  context: z.any().nullable(),
  options: z.any().nullable(),
  priority: z.number(),
  status: z.enum(["pending", "running", "completed", "failed", "cancelled"]),
  result: z.any().nullable(),
  error: z.any().nullable(),
  createdAt: z.string(),
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  updatedAt: z.string(),
});

export const historyRoutes: FastifyPluginAsync = async (fastify) => {
  // Create a new repository instance for simplicity
  const repository = new TaskRepository();

  // Get task history with filters and pagination
  fastify.get<{
    Querystring: z.infer<typeof taskHistoryQuerySchema>;
  }>(
    "/history/tasks",
    {
      schema: {
        querystring: zodToJsonSchema(taskHistoryQuerySchema),
        response: {
          200: {
            type: "object",
            properties: {
              data: {
                type: "array",
                items: zodToJsonSchema(taskDetailSchema),
              },
              pagination: {
                type: "object",
                properties: {
                  total: { type: "number" },
                  limit: { type: "number" },
                  offset: { type: "number" },
                  hasNext: { type: "boolean" },
                  hasPrev: { type: "boolean" },
                },
              },
            },
          },
        },
      },
      preHandler: [],
    },
    async (request) => {
      const {
        status,
        priority,
        createdAfter,
        createdBefore,
        search,
        limit,
        offset,
        orderBy,
        orderDirection,
      } = request.query;

      // Build filter
      const filter: TaskFilter = {};
      if (status) {
        filter.status = status as TaskFilter["status"];
      }
      if (priority !== undefined) {
        filter.priority = priority;
      }
      if (createdAfter) {
        filter.createdAfter = new Date(createdAfter);
      }
      if (createdBefore) {
        filter.createdBefore = new Date(createdBefore);
      }
      if (search) {
        filter.search = search;
      }

      // Build pagination options
      const pagination: PaginationOptions = {
        limit,
        offset,
        orderBy,
        orderDirection,
      };

      // Get paginated results
      const result = repository.find(filter, pagination);

      // Transform data for response
      const transformedData = result.data.map((record) => ({
        id: record.id,
        instruction: record.instruction,
        context: record.context ? JSON.parse(record.context) : null,
        options: record.options ? JSON.parse(record.options) : null,
        priority: record.priority,
        status: record.status,
        result: record.result ? JSON.parse(record.result) : null,
        error: record.error ? JSON.parse(record.error) : null,
        createdAt: record.created_at,
        startedAt: record.started_at,
        completedAt: record.completed_at,
        updatedAt: record.updated_at,
      }));

      return {
        data: transformedData,
        pagination: {
          total: result.total,
          limit: result.limit,
          offset: result.offset,
          hasNext: result.hasNext,
          hasPrev: result.hasPrev,
        },
      };
    },
  );

  // Get single task by ID
  fastify.get<{
    Params: { taskId: string };
  }>(
    "/history/tasks/:taskId",
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
          200: zodToJsonSchema(taskDetailSchema),
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
      preHandler: [],
    },
    async (request, reply) => {
      const { taskId } = request.params;
      const record = repository.getById(taskId);

      if (!record) {
        return reply.code(404).send({
          error: {
            message: `Task ${taskId} not found`,
            statusCode: 404,
            code: "TASK_NOT_FOUND",
          },
        });
      }

      return {
        id: record.id,
        instruction: record.instruction,
        context: record.context ? JSON.parse(record.context) : null,
        options: record.options ? JSON.parse(record.options) : null,
        priority: record.priority,
        status: record.status,
        result: record.result ? JSON.parse(record.result) : null,
        error: record.error ? JSON.parse(record.error) : null,
        createdAt: record.created_at,
        startedAt: record.started_at,
        completedAt: record.completed_at,
        updatedAt: record.updated_at,
      };
    },
  );

  // Clean up old tasks
  fastify.delete<{
    Body: { daysToKeep?: number };
  }>(
    "/history/cleanup",
    {
      schema: {
        body: {
          type: "object",
          properties: {
            daysToKeep: { type: "number", minimum: 1, default: 30 },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              message: { type: "string" },
              deletedCount: { type: "number" },
            },
          },
        },
      },
      preHandler: [],
    },
    async (request) => {
      const { daysToKeep = 30 } = request.body;
      const deletedCount = repository.cleanupOldTasks(daysToKeep);

      return {
        message: `Cleaned up tasks older than ${daysToKeep} days`,
        deletedCount,
      };
    },
  );
};

import type { FastifyInstance } from "fastify";
import type { ScheduledTask, ScheduleListOptions } from "../../types/scheduled-task.js";
import { ValidationError } from "../../utils/errors.js";
import {
  ScheduleNotFoundError,
  InvalidScheduleError,
  InvalidCronExpressionError,
} from "../../utils/schedule-errors.js";
import { logger } from "../../utils/logger.js";
import { serializeSchedule, serializeSchedules } from "../../utils/schedule-serializer.js";

interface CreateScheduleBody {
  name: string;
  description?: string;
  taskRequest: ScheduledTask["taskRequest"];
  schedule: ScheduledTask["schedule"];
  status?: ScheduledTask["status"];
}

interface UpdateScheduleBody extends Partial<CreateScheduleBody> {
  // All fields are optional for updates
}

interface ScheduleParams {
  id: string;
}

interface ScheduleListQuery extends ScheduleListOptions {
  // Inherits limit, offset, status from ScheduleListOptions
}

export async function scheduleRoutes(fastify: FastifyInstance): Promise<void> {
  const { schedulerService } = fastify;

  // Create a new schedule
  fastify.post<{ Body: CreateScheduleBody }>("/api/schedules", async (request, reply) => {
    const { name, description, taskRequest, schedule, status = "active" } = request.body;

    if (!name || !taskRequest || !schedule) {
      throw new ValidationError("Missing required fields");
    }

    try {
      // executeAtがある場合は文字列からDateオブジェクトに変換
      const processedSchedule = {
        ...schedule,
        executeAt: schedule.executeAt ? new Date(schedule.executeAt) : undefined,
      };

      const newSchedule = schedulerService.createSchedule({
        name,
        description,
        taskRequest,
        schedule: processedSchedule,
        status,
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          executionCount: 0,
        },
      });

      logger.info("Schedule created via API", {
        scheduleId: newSchedule.id,
        name: newSchedule.name,
      });

      return reply.code(201).send(serializeSchedule(newSchedule));
    } catch (error) {
      if (error instanceof Error && error.message.includes("Invalid cron expression")) {
        // Extract cron expression from error message if possible
        const cronMatch = error.message.match(/cron expression:\s*(.+)/);
        const cronExpression = cronMatch?.[1] || "unknown";
        throw new InvalidCronExpressionError(cronExpression);
      }
      if (error instanceof Error && error.message.includes("executeAt")) {
        throw new InvalidScheduleError(error.message, "executeAt");
      }
      throw error;
    }
  });

  // List schedules with pagination
  fastify.get<{ Querystring: ScheduleListQuery }>("/api/schedules", async (request) => {
    const { limit = 10, offset = 0, status } = request.query;

    const response = schedulerService.listSchedules({
      limit: Math.min(limit, 100), // Cap at 100
      offset,
      status,
    });

    return {
      schedules: serializeSchedules(response.schedules),
      total: response.total,
    };
  });

  // Get schedule by ID
  fastify.get<{ Params: ScheduleParams }>("/api/schedules/:id", async (request) => {
    const { id } = request.params;

    const schedule = schedulerService.getSchedule(id);
    if (!schedule) {
      throw new ScheduleNotFoundError(id);
    }

    return serializeSchedule(schedule);
  });

  // Update schedule
  fastify.put<{ Params: ScheduleParams; Body: UpdateScheduleBody }>(
    "/api/schedules/:id",
    async (request) => {
      const { id } = request.params;
      const updates = request.body;

      const updated = schedulerService.updateSchedule(id, updates);
      if (!updated) {
        throw new ScheduleNotFoundError(id);
      }

      logger.info("Schedule updated via API", { scheduleId: id });
      return serializeSchedule(updated);
    },
  );

  // Delete schedule
  fastify.delete<{ Params: ScheduleParams }>("/api/schedules/:id", async (request, reply) => {
    const { id } = request.params;

    const deleted = schedulerService.deleteSchedule(id);
    if (!deleted) {
      throw new ScheduleNotFoundError(id);
    }

    logger.info("Schedule deleted via API", { scheduleId: id });
    return reply.code(204).send();
  });

  // Enable schedule
  fastify.post<{ Params: ScheduleParams }>("/api/schedules/:id/enable", async (request) => {
    const { id } = request.params;

    const updated = schedulerService.enableSchedule(id);
    if (!updated) {
      throw new ScheduleNotFoundError(id);
    }

    logger.info("Schedule enabled via API", { scheduleId: id });
    return serializeSchedule(updated);
  });

  // Disable schedule
  fastify.post<{ Params: ScheduleParams }>("/api/schedules/:id/disable", async (request) => {
    const { id } = request.params;

    const updated = schedulerService.disableSchedule(id);
    if (!updated) {
      throw new ScheduleNotFoundError(id);
    }

    logger.info("Schedule disabled via API", { scheduleId: id });
    return serializeSchedule(updated);
  });

  // Get execution history
  fastify.get<{ Params: ScheduleParams }>("/api/schedules/:id/history", async (request) => {
    const { id } = request.params;

    // Verify schedule exists
    const schedule = schedulerService.getSchedule(id);
    if (!schedule) {
      throw new ScheduleNotFoundError(id);
    }

    const history = schedulerService.getHistory(id);
    return history;
  });
}

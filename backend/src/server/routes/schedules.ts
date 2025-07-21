import type { FastifyInstance } from "fastify";
import type { ScheduledTask, ScheduleListOptions } from "../../types/scheduled-task.js";
import { AppError } from "../../utils/errors.js";
import { logger } from "../../utils/logger.js";

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
      throw new AppError("Missing required fields", 400, "INVALID_REQUEST");
    }

    try {
      const newSchedule = schedulerService.createSchedule({
        name,
        description,
        taskRequest,
        schedule,
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

      return reply.code(201).send(newSchedule);
    } catch (error) {
      if (error instanceof Error && error.message.includes("Invalid cron expression")) {
        throw new AppError(error.message, 400, "INVALID_CRON");
      }
      if (error instanceof Error && error.message.includes("executeAt")) {
        throw new AppError(error.message, 400, "INVALID_SCHEDULE");
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

    return response;
  });

  // Get schedule by ID
  fastify.get<{ Params: ScheduleParams }>("/api/schedules/:id", async (request) => {
    const { id } = request.params;

    const schedule = schedulerService.getSchedule(id);
    if (!schedule) {
      throw new AppError(`Schedule ${id} not found`, 404, "SCHEDULE_NOT_FOUND");
    }

    return schedule;
  });

  // Update schedule
  fastify.put<{ Params: ScheduleParams; Body: UpdateScheduleBody }>(
    "/api/schedules/:id",
    async (request) => {
      const { id } = request.params;
      const updates = request.body;

      const updated = schedulerService.updateSchedule(id, updates);
      if (!updated) {
        throw new AppError(`Schedule ${id} not found`, 404, "SCHEDULE_NOT_FOUND");
      }

      logger.info("Schedule updated via API", { scheduleId: id });
      return updated;
    },
  );

  // Delete schedule
  fastify.delete<{ Params: ScheduleParams }>("/api/schedules/:id", async (request, reply) => {
    const { id } = request.params;

    const deleted = schedulerService.deleteSchedule(id);
    if (!deleted) {
      throw new AppError(`Schedule ${id} not found`, 404, "SCHEDULE_NOT_FOUND");
    }

    logger.info("Schedule deleted via API", { scheduleId: id });
    return reply.code(204).send();
  });

  // Enable schedule
  fastify.post<{ Params: ScheduleParams }>("/api/schedules/:id/enable", async (request) => {
    const { id } = request.params;

    const updated = schedulerService.enableSchedule(id);
    if (!updated) {
      throw new AppError(`Schedule ${id} not found`, 404, "SCHEDULE_NOT_FOUND");
    }

    logger.info("Schedule enabled via API", { scheduleId: id });
    return updated;
  });

  // Disable schedule
  fastify.post<{ Params: ScheduleParams }>("/api/schedules/:id/disable", async (request) => {
    const { id } = request.params;

    const updated = schedulerService.disableSchedule(id);
    if (!updated) {
      throw new AppError(`Schedule ${id} not found`, 404, "SCHEDULE_NOT_FOUND");
    }

    logger.info("Schedule disabled via API", { scheduleId: id });
    return updated;
  });

  // Get execution history
  fastify.get<{ Params: ScheduleParams }>("/api/schedules/:id/history", async (request) => {
    const { id } = request.params;

    // Verify schedule exists
    const schedule = schedulerService.getSchedule(id);
    if (!schedule) {
      throw new AppError(`Schedule ${id} not found`, 404, "SCHEDULE_NOT_FOUND");
    }

    const history = schedulerService.getHistory(id);
    return history;
  });
}

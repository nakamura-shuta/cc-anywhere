import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { createApp } from "../../../src/server/app";
import type { SchedulerService } from "../../../src/services/scheduler-service";
import type { ScheduledTask } from "../../../src/types/scheduled-task";

describe("Schedule routes", () => {
  let app: FastifyInstance;
  let schedulerService: SchedulerService;

  beforeEach(async () => {
    app = await createApp({ logger: false });
    schedulerService = app.schedulerService;
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  describe("POST /api/schedules", () => {
    it("should create a new cron schedule", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/schedules",
        headers: {
          "X-API-Key": process.env.API_KEY || "test-key",
        },
        payload: {
          name: "Daily backup",
          description: "Run backup every day",
          taskRequest: {
            instruction: "Run backup script",
            context: { workingDirectory: "/project" },
          },
          schedule: {
            type: "cron",
            expression: "0 2 * * *",
            timezone: "UTC",
          },
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.id).toBeDefined();
      expect(body.name).toBe("Daily backup");
      expect(body.status).toBe("active");
      expect(body.schedule.expression).toBe("0 2 * * *");
    });

    it.skip("should create a one-time schedule", async () => {
      const executeAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour later
      const response = await app.inject({
        method: "POST",
        url: "/api/schedules",
        headers: {
          "X-API-Key": process.env.API_KEY || "test-key",
        },
        payload: {
          name: "One-time task",
          taskRequest: {
            instruction: "Run once",
          },
          schedule: {
            type: "once",
            executeAt: executeAt.toISOString(),
          },
        },
      });

      // Debug error response
      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.schedule.type).toBe("once");
      expect(new Date(body.schedule.executeAt).toISOString()).toBe(executeAt.toISOString());
    });

    it("should validate required fields", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/schedules",
        headers: {
          "X-API-Key": process.env.API_KEY || "test-key",
        },
        payload: {
          // Missing required fields
          schedule: {
            type: "cron",
          },
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it("should reject invalid cron expression", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/schedules",
        headers: {
          "X-API-Key": process.env.API_KEY || "test-key",
        },
        payload: {
          name: "Invalid cron",
          taskRequest: {
            instruction: "Test",
          },
          schedule: {
            type: "cron",
            expression: "invalid",
          },
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.message).toContain("Invalid cron expression");
    });
  });

  describe("GET /api/schedules", () => {
    beforeEach(async () => {
      // Create test schedules
      for (let i = 0; i < 15; i++) {
        schedulerService.createSchedule({
          name: `Schedule ${i}`,
          taskRequest: { instruction: "test" },
          schedule: { type: "cron", expression: "0 * * * *" },
          status: i % 2 === 0 ? "active" : "inactive",
          metadata: {
            createdAt: new Date(),
            updatedAt: new Date(),
            executionCount: 0,
          },
        });
      }
    });

    it("should list schedules with pagination", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/schedules?limit=10&offset=0",
        headers: {
          "X-API-Key": process.env.API_KEY || "test-key",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.schedules).toHaveLength(10);
      expect(body.total).toBe(15);
    });

    it("should filter by status", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/schedules?status=active",
        headers: {
          "X-API-Key": process.env.API_KEY || "test-key",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.schedules.every((s: ScheduledTask) => s.status === "active")).toBe(true);
    });
  });

  describe("GET /api/schedules/:id", () => {
    it("should get schedule by id", async () => {
      const schedule = schedulerService.createSchedule({
        name: "Test schedule",
        taskRequest: { instruction: "test" },
        schedule: { type: "cron", expression: "0 * * * *" },
        status: "active",
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          executionCount: 0,
        },
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/schedules/${schedule.id}`,
        headers: {
          "X-API-Key": process.env.API_KEY || "test-key",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.id).toBe(schedule.id);
      expect(body.name).toBe("Test schedule");
    });

    it("should return 404 for non-existent schedule", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/schedules/non-existent",
        headers: {
          "X-API-Key": process.env.API_KEY || "test-key",
        },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("PUT /api/schedules/:id", () => {
    it("should update schedule", async () => {
      const schedule = schedulerService.createSchedule({
        name: "Original name",
        taskRequest: { instruction: "test" },
        schedule: { type: "cron", expression: "0 * * * *" },
        status: "active",
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          executionCount: 0,
        },
      });

      const response = await app.inject({
        method: "PUT",
        url: `/api/schedules/${schedule.id}`,
        headers: {
          "X-API-Key": process.env.API_KEY || "test-key",
        },
        payload: {
          name: "Updated name",
          status: "inactive",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.name).toBe("Updated name");
      expect(body.status).toBe("inactive");
    });
  });

  describe("DELETE /api/schedules/:id", () => {
    it("should delete schedule", async () => {
      const schedule = schedulerService.createSchedule({
        name: "To be deleted",
        taskRequest: { instruction: "test" },
        schedule: { type: "cron", expression: "0 * * * *" },
        status: "active",
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          executionCount: 0,
        },
      });

      const response = await app.inject({
        method: "DELETE",
        url: `/api/schedules/${schedule.id}`,
        headers: {
          "X-API-Key": process.env.API_KEY || "test-key",
        },
      });

      expect(response.statusCode).toBe(204);

      // Verify it's deleted
      const getResponse = await app.inject({
        method: "GET",
        url: `/api/schedules/${schedule.id}`,
        headers: {
          "X-API-Key": process.env.API_KEY || "test-key",
        },
      });
      expect(getResponse.statusCode).toBe(404);
    });
  });

  describe("POST /api/schedules/:id/enable", () => {
    it("should enable schedule", async () => {
      const schedule = schedulerService.createSchedule({
        name: "Test",
        taskRequest: { instruction: "test" },
        schedule: { type: "cron", expression: "0 * * * *" },
        status: "inactive",
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          executionCount: 0,
        },
      });

      const response = await app.inject({
        method: "POST",
        url: `/api/schedules/${schedule.id}/enable`,
        headers: {
          "X-API-Key": process.env.API_KEY || "test-key",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toBe("active");
    });
  });

  describe("POST /api/schedules/:id/disable", () => {
    it("should disable schedule", async () => {
      const schedule = schedulerService.createSchedule({
        name: "Test",
        taskRequest: { instruction: "test" },
        schedule: { type: "cron", expression: "0 * * * *" },
        status: "active",
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          executionCount: 0,
        },
      });

      const response = await app.inject({
        method: "POST",
        url: `/api/schedules/${schedule.id}/disable`,
        headers: {
          "X-API-Key": process.env.API_KEY || "test-key",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toBe("inactive");
    });
  });

  describe("GET /api/schedules/:id/history", () => {
    it("should get execution history", async () => {
      const schedule = schedulerService.createSchedule({
        name: "Test",
        taskRequest: { instruction: "test" },
        schedule: { type: "cron", expression: "0 * * * *" },
        status: "active",
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          executionCount: 0,
        },
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/schedules/${schedule.id}/history`,
        headers: {
          "X-API-Key": process.env.API_KEY || "test-key",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body)).toBe(true);
    });
  });
});

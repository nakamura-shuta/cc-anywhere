import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { AppError, ValidationError, NotFoundError } from "../../../../src/utils/errors.js";
import { TaskNotFoundError } from "../../../../src/utils/task-errors.js";

// Mock modules first
vi.mock("../../../../src/config/index.js", () => ({
  config: {
    isDevelopment: true,
    logging: {
      level: "info",
      pretty: false,
    },
  },
}));

vi.mock("../../../../src/utils/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

const mockEventBusInstance = {
  emit: vi.fn(),
};

vi.mock("../../../../src/events/event-bus.js", () => ({
  EventBus: {
    getInstance: vi.fn(() => mockEventBusInstance),
    createEvent: vi.fn((type, payload) => ({ type, payload })),
  },
  getGlobalEventBus: vi.fn(() => mockEventBusInstance),
}));

// Now import the plugin after mocks are set up
import { errorHandlerPlugin } from "../../../../src/server/plugins/error-handler.js";
import { config } from "../../../../src/config/index.js";
import { EventBus } from "../../../../src/events/event-bus.js";

describe("Error Handler Plugin", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = fastify({
      logger: false,
    });

    vi.clearAllMocks();

    await app.register(errorHandlerPlugin);

    // Add a test route that throws errors
    app.get("/test-error", async () => {
      throw new Error("Test error");
    });

    app.get("/test-app-error", async () => {
      throw new AppError("App error", 400, "APP_ERROR", { field: "test" });
    });

    app.get("/test-validation-error", async () => {
      throw new ValidationError("Validation failed");
    });

    app.get("/test-not-found", async () => {
      throw new NotFoundError("Resource not found");
    });

    app.get("/test-task-not-found", async () => {
      throw new TaskNotFoundError("task-123");
    });

    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it("should handle generic errors", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/test-error",
    });

    expect(response.statusCode).toBe(500);
    const body = JSON.parse(response.body);
    expect(body.error).toBeDefined();
    expect(body.error.message).toBe("Test error");
    expect(body.error.statusCode).toBe(500);
    expect(body.error.code).toBe("UNKNOWN_ERROR");
    expect(body.error.stack).toBeDefined();
    expect(body.error.originalMessage).toBe("Test error");
  });

  it("should handle AppError instances", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/test-app-error",
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error.message).toBe("App error");
    expect(body.error.statusCode).toBe(400);
    expect(body.error.code).toBe("APP_ERROR");
    expect(body.error.details).toEqual({ field: "test" });
    expect(body.error.stack).toBeDefined();
  });

  it("should handle ValidationError", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/test-validation-error",
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error.message).toBe("Validation failed");
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("should handle NotFoundError", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/test-not-found",
    });

    expect(response.statusCode).toBe(404);
    const body = JSON.parse(response.body);
    expect(body.error.message).toBe("Resource not found");
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("should handle custom TaskNotFoundError", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/test-task-not-found",
    });

    expect(response.statusCode).toBe(404);
    const body = JSON.parse(response.body);
    expect(body.error.message).toBe("Task task-123 not found");
    expect(body.error.code).toBe("TASK_NOT_FOUND");
    expect(body.error.details).toEqual({ taskId: "task-123" });
  });

  it("should emit error events", async () => {
    await app.inject({
      method: "GET",
      url: "/test-error",
    });

    expect(EventBus.createEvent).toHaveBeenCalledWith(
      "error.occurred",
      expect.objectContaining({
        error: expect.objectContaining({
          code: "UNKNOWN_ERROR",
          message: "Test error",
          statusCode: 500,
          name: "Error",
        }),
        request: expect.objectContaining({
          method: "GET",
          url: "/test-error",
        }),
        timestamp: expect.any(Date),
      }),
    );

    expect(mockEventBusInstance.emit).toHaveBeenCalled();
  });

  it("should expose error metrics endpoint in development", async () => {
    // Trigger some errors first
    await app.inject({ method: "GET", url: "/test-error" });
    await app.inject({ method: "GET", url: "/test-validation-error" });
    await app.inject({ method: "GET", url: "/test-not-found" });

    const response = await app.inject({
      method: "GET",
      url: "/api/internal/error-metrics",
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.totalErrors).toBeGreaterThan(0);
    expect(body.errorsByCode).toBeDefined();
    expect(body.errorsByStatus).toBeDefined();
    expect(body.errorsByRoute).toBeDefined();
  });

  it("should hide sensitive information in production", async () => {
    // Mock production environment
    (config as any).isDevelopment = false;

    const response = await app.inject({
      method: "GET",
      url: "/test-error",
    });

    expect(response.statusCode).toBe(500);
    const body = JSON.parse(response.body);
    expect(body.error.message).toBe("Internal Server Error");
    expect(body.error.stack).toBeUndefined();
    expect(body.error.originalMessage).toBeUndefined();

    // Restore development mode
    (config as any).isDevelopment = true;
  });

  it("should block error metrics endpoint in production", async () => {
    // Mock production environment
    (config as any).isDevelopment = false;

    const response = await app.inject({
      method: "GET",
      url: "/api/internal/error-metrics",
    });

    expect(response.statusCode).toBe(403);
    const body = JSON.parse(response.body);
    expect(body.error).toBe("Forbidden");

    // Restore development mode
    (config as any).isDevelopment = true;
  });

  it("should handle Fastify validation errors", async () => {
    // Create a new app instance for this test
    const testApp = fastify({ logger: false });
    await testApp.register(errorHandlerPlugin);

    // Add a route with schema validation
    testApp.post(
      "/test-validation",
      {
        schema: {
          body: {
            type: "object",
            properties: {
              name: { type: "string" },
              age: { type: "number" },
            },
            required: ["name", "age"],
          },
        },
      },
      async () => {
        return { success: true };
      },
    );

    await testApp.ready();

    const response = await testApp.inject({
      method: "POST",
      url: "/test-validation",
      payload: { name: "John" }, // Missing 'age'
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.message).toContain("body");

    await testApp.close();
  });
});

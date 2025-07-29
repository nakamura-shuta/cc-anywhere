import type { FastifyPluginAsync, FastifyError } from "fastify";
import fp from "fastify-plugin";
import { AppError } from "../../utils/errors.js";
import { logger } from "../../utils/logger.js";
import type { ErrorResponse } from "../../types/api.js";
import { config } from "../../config/index.js";
import { EventBus, getGlobalEventBus } from "../../events/event-bus.js";
import type { ErrorMetrics } from "../../types/metrics.js";

// Error metrics tracking
const errorMetrics: ErrorMetrics = {
  totalErrors: 0,
  errorsByCode: new Map(),
  errorsByStatus: new Map(),
  errorsByRoute: new Map(),
};

// eslint-disable-next-line @typescript-eslint/require-await
export const errorHandlerPlugin: FastifyPluginAsync = async (fastify) => {
  const eventBus = getGlobalEventBus();
  fastify.setErrorHandler((error: FastifyError | AppError | Error, request, reply) => {
    // Extract error details
    const errorCode = (error as AppError).code || (error as FastifyError).code || "UNKNOWN_ERROR";
    const statusCode = (error as AppError).statusCode || (error as FastifyError).statusCode || 500;
    const errorName = error.name || "Error";

    // Update metrics
    errorMetrics.totalErrors++;
    errorMetrics.errorsByCode.set(errorCode, (errorMetrics.errorsByCode.get(errorCode) || 0) + 1);
    errorMetrics.errorsByStatus.set(
      statusCode,
      (errorMetrics.errorsByStatus.get(statusCode) || 0) + 1,
    );
    errorMetrics.errorsByRoute.set(
      request.url,
      (errorMetrics.errorsByRoute.get(request.url) || 0) + 1,
    );

    // Detailed error logging
    const logContext = {
      error: {
        message: error.message,
        stack: error.stack,
        code: errorCode,
        name: errorName,
        statusCode,
        details: (error as AppError).details,
      },
      request: {
        method: request.method,
        url: request.url,
        id: request.id,
        headers: config.isDevelopment ? request.headers : undefined,
        body: config.isDevelopment && request.body ? request.body : undefined,
        query: request.query,
        params: request.params,
        ip: request.ip,
        userAgent: request.headers["user-agent"],
      },
      metrics: {
        totalErrors: errorMetrics.totalErrors,
        errorFrequency: errorMetrics.errorsByCode.get(errorCode),
      },
    };

    // Log based on severity
    if (statusCode >= 500) {
      logger.error("Server error occurred", logContext);
    } else if (statusCode >= 400) {
      logger.warn("Client error occurred", logContext);
    } else {
      logger.info("Error occurred", logContext);
    }

    // Emit error event for monitoring
    const errorEvent = EventBus.createEvent("error.occurred", {
      error: {
        code: errorCode,
        message: error.message,
        statusCode,
        name: errorName,
      },
      request: {
        method: request.method,
        url: request.url,
        id: request.id,
      },
      timestamp: new Date(),
    });

    // Fire and forget - don't await to avoid blocking the response
    void eventBus.emit(errorEvent);

    // Handle validation errors from Fastify
    if ((error as FastifyError).validation) {
      return reply.status(400).send({
        error: {
          message: error.message,
          statusCode: 400,
          code: "VALIDATION_ERROR",
        },
      });
    }

    // Handle AppError instances
    if (error instanceof AppError) {
      const response: ErrorResponse = {
        error: {
          message: error.message,
          statusCode: error.statusCode,
          code: error.code,
          details: config.isDevelopment ? error.details : undefined,
        },
      };

      if (config.isDevelopment) {
        response.error.stack = error.stack;
        response.error.timestamp = error.timestamp;
      }

      return reply.status(error.statusCode).send(response);
    }

    // Handle generic errors
    const response: ErrorResponse = {
      error: {
        message:
          statusCode === 500 && !config.isDevelopment ? "Internal Server Error" : error.message,
        statusCode,
        code: errorCode,
      },
    };

    if (config.isDevelopment) {
      response.error.stack = error.stack;
      if (statusCode === 500) {
        response.error.originalMessage = error.message;
      }
    }

    return reply.status(statusCode).send(response);
  });

  // Note: setNotFoundHandler is handled in static.ts for SPA routing support

  // Export metrics endpoint for monitoring
  fastify.get("/api/internal/error-metrics", async (_request, reply) => {
    // This endpoint should be protected in production
    if (!config.isDevelopment) {
      return reply.status(403).send({ error: "Forbidden" });
    }

    return {
      totalErrors: errorMetrics.totalErrors,
      errorsByCode: Object.fromEntries(errorMetrics.errorsByCode),
      errorsByStatus: Object.fromEntries(errorMetrics.errorsByStatus),
      errorsByRoute: Object.fromEntries(
        Array.from(errorMetrics.errorsByRoute.entries())
          .sort(([, a], [, b]) => b - a)
          .slice(0, 10), // Top 10 routes with errors
      ),
    };
  });
};

export default fp(errorHandlerPlugin, {
  name: "error-handler",
});

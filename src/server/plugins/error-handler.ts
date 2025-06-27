import type { FastifyPluginAsync, FastifyError } from "fastify";
import fp from "fastify-plugin";
import { AppError } from "../../utils/errors";
import { logger } from "../../utils/logger";
import type { ErrorResponse } from "../../types/api";
import { config } from "../../config";

// eslint-disable-next-line @typescript-eslint/require-await
export const errorHandlerPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.setErrorHandler((error: FastifyError | AppError | Error, request, reply) => {
    // Log the error
    logger.error({
      error: {
        message: error.message,
        stack: error.stack,
        code: (error as FastifyError).code,
      },
      request: {
        method: request.method,
        url: request.url,
        id: request.id,
      },
    });

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
        },
      };

      if (config.isDevelopment) {
        response.error.stack = error.stack;
      }

      return reply.status(error.statusCode).send(response);
    }

    // Handle generic errors
    const statusCode = (error as FastifyError).statusCode || 500;
    const response: ErrorResponse = {
      error: {
        message: statusCode === 500 ? "Internal Server Error" : error.message,
        statusCode,
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

  // Handle not found
  fastify.setNotFoundHandler((request, reply) => {
    void reply.status(404).send({
      error: {
        message: `Route ${request.method}:${request.url} not found`,
        statusCode: 404,
        code: "NOT_FOUND",
      },
    });
  });
};

export default fp(errorHandlerPlugin, {
  name: "error-handler",
});

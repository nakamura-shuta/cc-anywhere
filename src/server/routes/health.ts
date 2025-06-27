import type { FastifyPluginAsync } from "fastify";
import type { HealthResponse } from "../../types/api";
import { config } from "../../config";

const startTime = Date.now();

// eslint-disable-next-line @typescript-eslint/require-await
export const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get<{
    Reply: HealthResponse;
  }>("/health", () => {
    const response: HealthResponse = {
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - startTime) / 1000),
      environment: config.env,
    };
    return response;
  });
};

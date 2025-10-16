import type { FastifyPluginAsync } from "fastify";
import { AgentExecutorFactory } from "../../agents/agent-executor-factory.js";
import { logger } from "../../utils/logger.js";

/**
 * Executors routes
 * API endpoints for managing and querying available agent executors
 */
export const executorRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /api/executors
   * Get list of available agent executors
   */
  fastify.get(
    "/executors",
    {
      schema: {
        response: {
          200: {
            type: "object",
            properties: {
              executors: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    type: { type: "string" },
                    available: { type: "boolean" },
                    description: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
    },
    async () => {
      logger.debug("Fetching available executors");

      // Get available executors
      const availableTypes = await AgentExecutorFactory.getAvailableExecutors();

      // Build response with all executor types
      const allExecutors = [
        {
          type: "claude",
          available: availableTypes.includes("claude"),
          description: "Claude Agent SDK - Official Anthropic agent framework",
        },
        {
          type: "codex",
          available: availableTypes.includes("codex"),
          description: "OpenAI Codex SDK - AI coding assistant",
        },
      ];

      logger.debug("Available executors", { availableTypes, count: availableTypes.length });

      return {
        executors: allExecutors,
      };
    },
  );
};

export default executorRoutes;

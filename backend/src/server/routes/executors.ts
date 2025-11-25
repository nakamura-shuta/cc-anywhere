import type { FastifyPluginAsync } from "fastify";
import { AgentExecutorFactory } from "../../agents/agent-executor-factory.js";
import { EXECUTOR_CAPABILITIES } from "../../agents/types.js";
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
                    capabilities: {
                      type: "object",
                      properties: {
                        sessionContinuation: { type: "boolean" },
                        sessionResume: { type: "boolean" },
                        crossRepositorySession: { type: "boolean" },
                        maxTurnsLimit: { type: "boolean" },
                        toolFiltering: { type: "boolean" },
                        permissionModes: { type: "boolean" },
                        customSystemPrompt: { type: "boolean" },
                        outputFormatting: { type: "boolean" },
                        verboseMode: { type: "boolean" },
                        sandboxControl: { type: "boolean" },
                        networkAccess: { type: "boolean" },
                        webSearch: { type: "boolean" },
                        modelSelection: { type: "boolean" },
                      },
                    },
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
          type: "claude" as const,
          available: availableTypes.includes("claude"),
          description: "Claude Agent SDK - Official Anthropic agent framework",
          capabilities: EXECUTOR_CAPABILITIES.claude,
        },
        {
          type: "codex" as const,
          available: availableTypes.includes("codex"),
          description: "OpenAI Codex SDK - AI coding assistant",
          capabilities: EXECUTOR_CAPABILITIES.codex,
        },
        {
          type: "gemini" as const,
          available: availableTypes.includes("gemini"),
          description: "Google Gemini 3 Pro - Advanced AI with thinking and tools",
          capabilities: EXECUTOR_CAPABILITIES.gemini,
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

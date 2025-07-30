import type { FastifyPluginAsync } from "fastify";
import { getSharedClaudeClient } from "../../claude/shared-instance";
import type { ExecutionMode } from "../../claude/strategies";
import { logger } from "../../utils/logger";

export interface SettingsResponse {
  executionMode: "api-key" | "bedrock";
  availableModes: string[];
  credentials: {
    apiKey: boolean;
    bedrock: boolean;
  };
}

export interface UpdateSettingsRequest {
  executionMode: "api-key" | "bedrock";
}

export const settingsRoutes: FastifyPluginAsync = async (fastify) => {
  const claudeClient = getSharedClaudeClient();

  // Get current settings
  fastify.get<{
    Reply: SettingsResponse;
  }>(
    "/api/settings",
    {
      schema: {
        response: {
          200: {
            type: "object",
            properties: {
              executionMode: {
                type: "string",
                enum: ["api-key", "bedrock"],
              },
              availableModes: {
                type: "array",
                items: { type: "string" },
              },
              credentials: {
                type: "object",
                properties: {
                  apiKey: { type: "boolean" },
                  bedrock: { type: "boolean" },
                },
                required: ["apiKey", "bedrock"],
              },
            },
            required: ["executionMode", "availableModes", "credentials"],
          },
        },
      },
    },
    async () => {
      try {
        const availableModes: string[] = [];

        if (claudeClient.isAvailable("api-key")) {
          availableModes.push("api-key");
        }
        if (claudeClient.isAvailable("bedrock")) {
          availableModes.push("bedrock");
        }

        const response = {
          executionMode: claudeClient.getCurrentMode(),
          availableModes,
          credentials: {
            apiKey: claudeClient.isAvailable("api-key"),
            bedrock: claudeClient.isAvailable("bedrock"),
          },
        };

        logger.info("Settings retrieved", response);
        return response;
      } catch (error) {
        logger.error("Failed to get settings", { error });
        throw fastify.httpErrors.internalServerError("Failed to retrieve settings");
      }
    },
  );

  // Update settings
  fastify.put<{
    Body: UpdateSettingsRequest;
    Reply: SettingsResponse;
  }>(
    "/api/settings",
    {
      schema: {
        body: {
          type: "object",
          properties: {
            executionMode: {
              type: "string",
              enum: ["api-key", "bedrock"],
            },
          },
          required: ["executionMode"],
        },
        response: {
          200: {
            type: "object",
            properties: {
              executionMode: {
                type: "string",
                enum: ["api-key", "bedrock"],
              },
              availableModes: {
                type: "array",
                items: { type: "string" },
              },
              credentials: {
                type: "object",
                properties: {
                  apiKey: { type: "boolean" },
                  bedrock: { type: "boolean" },
                },
                required: ["apiKey", "bedrock"],
              },
            },
            required: ["executionMode", "availableModes", "credentials"],
          },
        },
      },
    },
    async (request) => {
      try {
        const { executionMode } = request.body;

        if (!claudeClient.isAvailable(executionMode as ExecutionMode)) {
          throw fastify.httpErrors.badRequest(
            `Execution mode '${executionMode}' is not available. Missing credentials.`,
          );
        }

        claudeClient.switchStrategy(executionMode as ExecutionMode);

        // Set environment variable to persist the setting
        process.env.FORCE_EXECUTION_MODE = executionMode;

        logger.info("Execution mode updated", { executionMode });

        return {
          executionMode: claudeClient.getCurrentMode(),
          availableModes: [
            ...(claudeClient.isAvailable("api-key") ? ["api-key"] : []),
            ...(claudeClient.isAvailable("bedrock") ? ["bedrock"] : []),
          ],
          credentials: {
            apiKey: claudeClient.isAvailable("api-key"),
            bedrock: claudeClient.isAvailable("bedrock"),
          },
        };
      } catch (error) {
        logger.error("Failed to update settings", { error });

        if (error instanceof Error && error.message.includes("not available")) {
          throw error;
        }

        throw fastify.httpErrors.internalServerError("Failed to update settings");
      }
    },
  );
};

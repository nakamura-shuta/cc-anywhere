import type { FastifyPluginAsync } from "fastify";
import { checkApiKey } from "../middleware/auth";
import { PresetService, type TaskPreset } from "../../services/preset-service";

// eslint-disable-next-line @typescript-eslint/require-await
export const presetRoutes: FastifyPluginAsync = async (fastify) => {
  const presetService = new PresetService();

  // GET /presets - Get all presets
  fastify.get<{
    Reply:
      | {
          presets: TaskPreset[];
          userPresets: TaskPreset[];
        }
      | {
          message: string;
        };
  }>(
    "/presets",
    {
      preHandler: checkApiKey,
    },
    (_request, reply) => {
      try {
        const config = presetService.loadPresets();

        // 明示的に新しいオブジェクトを作成してFastifyのシリアライゼーション問題を回避
        const response = {
          presets: config.presets.map((p) => ({
            id: p.id,
            name: p.name,
            description: p.description,
            isSystem: p.isSystem,
            settings: p.settings,
            createdAt: p.createdAt,
            updatedAt: p.updatedAt,
          })),
          userPresets: config.userPresets.map((p) => ({
            id: p.id,
            name: p.name,
            description: p.description,
            isSystem: p.isSystem,
            settings: p.settings,
            createdAt: p.createdAt,
            updatedAt: p.updatedAt,
          })),
        };

        void reply.send(response);
      } catch (error) {
        void reply.status(500).send({
          message: "Failed to load presets",
        });
      }
    },
  );

  // GET /presets/:id - Get a specific preset
  fastify.get<{
    Params: { id: string };
    Reply: TaskPreset | { message: string };
  }>(
    "/presets/:id",
    {
      preHandler: checkApiKey,
      schema: {
        params: {
          type: "object",
          properties: {
            id: { type: "string" },
          },
          required: ["id"],
        },
      },
    },
    (request, reply) => {
      try {
        const { id } = request.params;
        const preset = presetService.getPreset(id);

        if (!preset) {
          void reply.status(404).send({ message: "Preset not found" });
          return;
        }

        void reply.send(preset);
      } catch (error) {
        void reply.status(500).send({
          message: "Failed to load preset",
        });
      }
    },
  );

  // POST /presets - Create a new user preset
  fastify.post<{
    Body: {
      name: string;
      description?: string;
      settings: TaskPreset["settings"];
    };
    Reply: TaskPreset | { message: string };
  }>(
    "/presets",
    {
      preHandler: checkApiKey,
      schema: {
        body: {
          type: "object",
          properties: {
            name: { type: "string", minLength: 1 },
            description: { type: "string" },
            settings: {
              type: "object",
              properties: {
                sdk: { type: "object" },
                timeout: { type: "number" },
                useWorktree: { type: "boolean" },
                worktree: { type: "object" },
                allowedTools: {
                  type: "array",
                  items: { type: "string" },
                },
              },
            },
          },
          required: ["name", "settings"],
        },
      },
    },
    (request, reply) => {
      try {
        const { name, description, settings } = request.body;

        // Check if name already exists
        const config = presetService.loadPresets();
        const exists =
          config.presets.some((p) => p.name === name) ||
          config.userPresets.some((p) => p.name === name);

        if (exists) {
          void reply.status(400).send({
            message: "Preset with this name already exists",
          });
          return;
        }

        const newPreset = presetService.createPreset({ name, description, settings });
        void reply.status(201).send(newPreset);
      } catch (error) {
        void reply.status(500).send({
          message: "Failed to create preset",
        });
      }
    },
  );

  // PUT /presets/:id - Update a user preset
  fastify.put<{
    Params: { id: string };
    Body: {
      name?: string;
      description?: string;
      settings?: TaskPreset["settings"];
    };
    Reply: TaskPreset | { message: string };
  }>(
    "/presets/:id",
    {
      preHandler: checkApiKey,
      schema: {
        params: {
          type: "object",
          properties: {
            id: { type: "string" },
          },
          required: ["id"],
        },
        body: {
          type: "object",
          properties: {
            name: { type: "string", minLength: 1 },
            description: { type: "string" },
            settings: { type: "object" },
          },
        },
      },
    },
    (request, reply) => {
      try {
        const { id } = request.params;
        const updates = request.body;

        const updatedPreset = presetService.updatePreset(id, updates);
        void reply.send(updatedPreset);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to update preset";
        const statusCode = message.includes("not found")
          ? 404
          : message.includes("System presets cannot be")
            ? 403
            : 500;
        void reply.status(statusCode).send({ message });
      }
    },
  );

  // DELETE /presets/:id - Delete a user preset
  fastify.delete<{
    Params: { id: string };
    Reply: { message: string };
  }>(
    "/presets/:id",
    {
      preHandler: checkApiKey,
      schema: {
        params: {
          type: "object",
          properties: {
            id: { type: "string" },
          },
          required: ["id"],
        },
      },
    },
    (request, reply) => {
      try {
        const { id } = request.params;

        presetService.deletePreset(id);
        void reply.send({ message: "Preset deleted successfully" });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to delete preset";
        const statusCode = message.includes("not found")
          ? 404
          : message.includes("System presets cannot be")
            ? 403
            : 500;
        void reply.status(statusCode).send({ message });
      }
    },
  );
};

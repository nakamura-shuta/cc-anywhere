import type { FastifyPluginAsync } from "fastify";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { logger } from "../../utils/logger";
import { checkApiKey } from "../middleware/auth";
import { v4 as uuidv4 } from "uuid";

interface TaskPreset {
  id: string;
  name: string;
  description?: string;
  isSystem: boolean;
  settings: {
    sdk?: Record<string, any>;
    timeout?: number;
    useWorktree?: boolean;
    worktree?: Record<string, any>;
    allowedTools?: string[]; // Legacy support
  };
  createdAt?: string;
  updatedAt?: string;
}

interface PresetsConfig {
  presets: TaskPreset[];
  userPresets: TaskPreset[];
}

const PRESETS_FILE = join(process.cwd(), "config", "task-presets.json");

// Load presets from file
function loadPresets(): PresetsConfig {
  try {
    if (!existsSync(PRESETS_FILE)) {
      // Create default file if not exists
      const defaultConfig: PresetsConfig = {
        presets: [
          {
            id: "default",
            name: "デフォルト設定",
            description: "一般的なタスク用の標準設定",
            isSystem: true,
            settings: {
              sdk: {
                maxTurns: 3,
                permissionMode: "ask",
                allowedTools: ["Read", "Write", "Edit"],
                outputFormat: "text",
              },
              timeout: 600000,
              useWorktree: false,
            },
          },
        ],
        userPresets: [],
      };
      writeFileSync(PRESETS_FILE, JSON.stringify(defaultConfig, null, 2));
      return defaultConfig;
    }

    const content = readFileSync(PRESETS_FILE, "utf-8");
    return JSON.parse(content) as PresetsConfig;
  } catch (error) {
    logger.error("Failed to load presets", { error });
    throw new Error("Failed to load presets configuration");
  }
}

// Save presets to file
function savePresets(config: PresetsConfig): void {
  try {
    writeFileSync(PRESETS_FILE, JSON.stringify(config, null, 2));
  } catch (error) {
    logger.error("Failed to save presets", { error });
    throw new Error("Failed to save presets configuration");
  }
}

// eslint-disable-next-line @typescript-eslint/require-await
export const presetRoutes: FastifyPluginAsync = async (fastify) => {
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
      schema: {
        response: {
          200: {
            type: "object",
            properties: {
              presets: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    name: { type: "string" },
                    description: { type: "string" },
                    isSystem: { type: "boolean" },
                    settings: { type: "object" },
                    createdAt: { type: "string" },
                    updatedAt: { type: "string" },
                  },
                },
              },
              userPresets: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    name: { type: "string" },
                    description: { type: "string" },
                    isSystem: { type: "boolean" },
                    settings: { type: "object" },
                    createdAt: { type: "string" },
                    updatedAt: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
    },
    (_request, reply) => {
      try {
        const config = loadPresets();
        void reply.send(config);
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
        const config = loadPresets();

        // Search in both system and user presets
        const preset =
          config.presets.find((p) => p.id === id) || config.userPresets.find((p) => p.id === id);

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
        const config = loadPresets();

        // Check if name already exists
        const exists =
          config.presets.some((p) => p.name === name) ||
          config.userPresets.some((p) => p.name === name);

        if (exists) {
          void reply.status(400).send({
            message: "Preset with this name already exists",
          });
          return;
        }

        const newPreset: TaskPreset = {
          id: uuidv4(),
          name,
          description,
          isSystem: false,
          settings,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        config.userPresets.push(newPreset);
        savePresets(config);

        logger.info("Created new preset", { id: newPreset.id, name });
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
        const config = loadPresets();

        // Find preset in user presets (system presets cannot be updated)
        const presetIndex = config.userPresets.findIndex((p) => p.id === id);

        if (presetIndex === -1) {
          // Check if it's a system preset
          const systemPreset = config.presets.find((p) => p.id === id);
          if (systemPreset) {
            void reply.status(403).send({
              message: "System presets cannot be modified",
            });
            return;
          }
          void reply.status(404).send({ message: "Preset not found" });
          return;
        }

        // Update preset
        const currentPreset = config.userPresets[presetIndex];
        if (!currentPreset) {
          void reply.status(404).send({ message: "Preset not found" });
          return;
        }
        const updatedPreset: TaskPreset = {
          id: currentPreset.id,
          name: updates.name ?? currentPreset.name,
          description: updates.description ?? currentPreset.description,
          isSystem: currentPreset.isSystem,
          settings: updates.settings ?? currentPreset.settings,
          createdAt: currentPreset.createdAt,
          updatedAt: new Date().toISOString(),
        };

        config.userPresets[presetIndex] = updatedPreset;
        savePresets(config);

        logger.info("Updated preset", { id, updates });
        void reply.send(updatedPreset);
      } catch (error) {
        void reply.status(500).send({
          message: "Failed to update preset",
        });
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
        const config = loadPresets();

        // Check if it's a system preset
        const systemPreset = config.presets.find((p) => p.id === id);
        if (systemPreset) {
          void reply.status(403).send({
            message: "System presets cannot be deleted",
          });
          return;
        }

        // Find and remove from user presets
        const presetIndex = config.userPresets.findIndex((p) => p.id === id);

        if (presetIndex === -1) {
          void reply.status(404).send({ message: "Preset not found" });
          return;
        }

        config.userPresets.splice(presetIndex, 1);
        savePresets(config);

        logger.info("Deleted preset", { id });
        void reply.send({ message: "Preset deleted successfully" });
      } catch (error) {
        void reply.status(500).send({
          message: "Failed to delete preset",
        });
      }
    },
  );
};

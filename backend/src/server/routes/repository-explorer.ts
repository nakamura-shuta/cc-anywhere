import type { FastifyPluginAsync } from "fastify";
import { repositoryExplorerService } from "../../services/repository-explorer.service.js";
import { checkApiKey } from "../middleware/auth.js";
import { logger } from "../../utils/logger.js";

// スキーマ定義
const treeNodeSchema = {
  type: "object",
  properties: {
    name: { type: "string" },
    path: { type: "string" },
    type: { type: "string", enum: ["file", "directory"] },
    size: { type: "number" },
    modifiedAt: { type: "string" },
    children: {
      type: "array",
      items: { $ref: "#/definitions/treeNode" },
    },
  },
  required: ["name", "path", "type"],
};

const fileContentSchema = {
  type: "object",
  properties: {
    path: { type: "string" },
    content: { type: "string" },
    encoding: { type: "string", enum: ["utf8", "base64", "binary"] },
    size: { type: "number" },
    mimeType: { type: "string" },
    language: { type: "string" },
    modifiedAt: { type: "string" },
  },
  required: ["path", "content", "encoding", "size", "mimeType", "modifiedAt"],
};

export const repositoryExplorerRoutes: FastifyPluginAsync = async (fastify) => {
  // ツリー取得エンドポイント
  fastify.get<{
    Params: { name: string };
    Querystring: { path?: string };
  }>(
    "/repositories/:name/tree",
    {
      preHandler: checkApiKey,
      schema: {
        params: {
          type: "object",
          properties: {
            name: { type: "string" },
          },
          required: ["name"],
        },
        querystring: {
          type: "object",
          properties: {
            path: { type: "string" },
          },
        },
        response: {
          200: {
            definitions: {
              treeNode: treeNodeSchema,
            },
            ...treeNodeSchema,
          },
          400: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
          },
          404: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
          },
          500: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { name } = request.params;
      const { path = "" } = request.query;

      try {
        logger.info("Getting repository tree", { repository: name, path });

        const tree = await repositoryExplorerService.getDirectoryTree(name, path);

        return reply.send(tree);
      } catch (error) {
        logger.error("Failed to get repository tree", {
          repository: name,
          path,
          error: error instanceof Error ? error.message : String(error),
        });

        if (error instanceof Error) {
          if (error.message.includes("not found")) {
            return reply.status(404).send({ error: error.message });
          }
          if (error.message.includes("Access denied") || error.message.includes("Invalid path")) {
            return reply.status(400).send({ error: error.message });
          }
        }

        return reply.status(500).send({
          error: "Failed to retrieve repository tree",
        });
      }
    },
  );

  // ファイル内容取得エンドポイント
  fastify.get<{
    Params: { name: string };
    Querystring: { path: string };
  }>(
    "/repositories/:name/file",
    {
      preHandler: checkApiKey,
      schema: {
        params: {
          type: "object",
          properties: {
            name: { type: "string" },
          },
          required: ["name"],
        },
        querystring: {
          type: "object",
          properties: {
            path: { type: "string" },
          },
          required: ["path"],
        },
        response: {
          200: fileContentSchema,
          400: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
          },
          404: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
          },
          413: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
          },
          500: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { name } = request.params;
      const { path } = request.query;

      if (!path) {
        return reply.status(400).send({ error: "File path is required" });
      }

      try {
        logger.info("Getting file content", { repository: name, path });

        const content = await repositoryExplorerService.getFileContent(name, path);

        return reply.send(content);
      } catch (error) {
        logger.error("Failed to get file content", {
          repository: name,
          path,
          error: error instanceof Error ? error.message : String(error),
        });

        if (error instanceof Error) {
          if (error.message.includes("not found")) {
            return reply.status(404).send({ error: error.message });
          }
          if (error.message.includes("Access denied") || error.message.includes("Invalid path")) {
            return reply.status(400).send({ error: error.message });
          }
          if (error.message.includes("is a directory")) {
            return reply.status(400).send({ error: error.message });
          }
          if (error.message.includes("too large")) {
            return reply.status(413).send({ error: error.message });
          }
        }

        return reply.status(500).send({
          error: "Failed to retrieve file content",
        });
      }
    },
  );
};

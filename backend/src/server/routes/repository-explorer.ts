import type { FastifyPluginAsync } from "fastify";
import { repositoryExplorerService } from "../../services/repository-explorer.service.js";
import { fileWatcherService } from "../../services/file-watcher.service.js";
import { checkApiKey } from "../middleware/auth.js";
import { logger } from "../../utils/logger.js";
import type { WebSocketServer } from "../../websocket/websocket-server.js";

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
  // WebSocketサーバーマネージャーへの参照を取得
  const wsManager = (fastify as any).wsManager as WebSocketServer;

  // ファイル変更イベントリスナーを設定
  if (wsManager) {
    fileWatcherService.on("repositoryFileChange", (event) => {
      // WebSocket経由でファイル変更を通知
      wsManager.broadcastToAll({
        type: "repository-file-change",
        payload: event,
      });
      logger.debug("Broadcasted repository file change event", event);
    });
  }
  // ツリー取得エンドポイント
  fastify.get<{
    Querystring: { repository: string; path?: string };
  }>(
    "/repositories/tree",
    {
      preHandler: checkApiKey,
      schema: {
        querystring: {
          type: "object",
          properties: {
            repository: { type: "string" },
            path: { type: "string" },
          },
          required: ["repository"],
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
      const { repository, path = "" } = request.query;

      try {
        logger.info("Getting repository tree", { repository, path });

        const tree = await repositoryExplorerService.getDirectoryTree(repository, path);

        return reply.send(tree);
      } catch (error) {
        logger.error("Failed to get repository tree", {
          repository,
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
    Querystring: { repository: string; path: string };
  }>(
    "/repositories/file",
    {
      preHandler: checkApiKey,
      schema: {
        querystring: {
          type: "object",
          properties: {
            repository: { type: "string" },
            path: { type: "string" },
          },
          required: ["repository", "path"],
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
      const { repository, path } = request.query;

      if (!path) {
        return reply.status(400).send({ error: "File path is required" });
      }

      try {
        logger.info("Getting file content", { repository, path });

        const content = await repositoryExplorerService.getFileContent(repository, path);

        return reply.send(content);
      } catch (error) {
        logger.error("Failed to get file content", {
          repository,
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

  // リポジトリ監視開始エンドポイント
  fastify.post<{
    Querystring: { repository: string };
  }>(
    "/repositories/watch",
    {
      preHandler: checkApiKey,
      schema: {
        querystring: {
          type: "object",
          properties: {
            repository: { type: "string" },
          },
          required: ["repository"],
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
            },
          },
          400: {
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
      const { repository } = request.query;

      try {
        logger.info("Starting repository watch", { repository });

        await fileWatcherService.watchRepository(repository);

        return reply.send({
          success: true,
          message: `Started watching repository: ${repository}`,
        });
      } catch (error) {
        logger.error("Failed to start repository watch", {
          repository,
          error: error instanceof Error ? error.message : String(error),
        });

        // 400番台のエラーと500番台のエラーを分ける
        if (error instanceof Error) {
          if (error.message.includes("not found") || error.message.includes("does not exist")) {
            return reply.status(404).send({ error: error.message });
          }
          if (error.message.includes("Access denied") || error.message.includes("Invalid path")) {
            return reply.status(400).send({ error: error.message });
          }
        }

        return reply.status(500).send({
          error: "Failed to start repository watch",
        });
      }
    },
  );

  // リポジトリ監視停止エンドポイント
  fastify.delete<{
    Querystring: { repository: string };
  }>(
    "/repositories/watch",
    {
      preHandler: checkApiKey,
      schema: {
        querystring: {
          type: "object",
          properties: {
            repository: { type: "string" },
          },
          required: ["repository"],
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
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
      const { repository } = request.query;

      try {
        logger.info("Stopping repository watch", { repository });

        await fileWatcherService.unwatchRepository(repository);

        return reply.send({
          success: true,
          message: `Stopped watching repository: ${repository}`,
        });
      } catch (error) {
        logger.error("Failed to stop repository watch", {
          repository,
          error: error instanceof Error ? error.message : String(error),
        });

        return reply.status(500).send({
          error: "Failed to stop repository watch",
        });
      }
    },
  );

  // 監視中リポジトリ一覧取得エンドポイント
  fastify.get(
    "/repositories/watched",
    {
      preHandler: checkApiKey,
      schema: {
        response: {
          200: {
            type: "object",
            properties: {
              repositories: {
                type: "array",
                items: { type: "string" },
              },
            },
          },
        },
      },
    },
    async (_, reply) => {
      const repositories = fileWatcherService.getWatchedRepositories();
      return reply.send({ repositories });
    },
  );
};

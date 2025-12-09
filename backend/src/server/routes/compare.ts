import type { FastifyPluginAsync } from "fastify";
import { readFileSync } from "fs";
import { join } from "path";
import { checkApiKey } from "../middleware/auth.js";
import { CompareService, CompareErrorCode } from "../../services/compare/index.js";
import { CompareTaskRepositoryImpl } from "../../repositories/compare-task-repository.js";
import type {
  CreateCompareTaskRequest,
  CreateCompareTaskResponse,
  CompareTaskDetailResponse,
  CompareFilesResponse,
} from "../../services/compare/types.js";
import { AppError } from "../../utils/errors.js";
import { getTypedEventBus } from "../../events/typed-event-bus.js";
import { logger } from "../../utils/logger.js";

interface Repository {
  name: string;
  path: string;
}

interface RepositoriesConfig {
  repositories: Repository[];
}

// リポジトリ一覧を取得する関数
function getRepositories(): Repository[] {
  try {
    const configPath = join(process.cwd(), "config", "repositories.json");
    const configContent = readFileSync(configPath, "utf-8");
    const config = JSON.parse(configContent) as RepositoriesConfig;
    return config.repositories;
  } catch {
    // デフォルト値を返す
    return [
      {
        name: "cc-anywhere",
        path: process.cwd(),
      },
    ];
  }
}

export const compareRoutes: FastifyPluginAsync = async (fastify) => {
  // CompareServiceの初期化
  const db = fastify.db;
  if (!db) {
    fastify.log.warn("Database not available, compare routes will not be registered");
    return;
  }
  const compareTaskRepository = new CompareTaskRepositoryImpl(db);
  const taskQueue = fastify.queue;

  const compareService = new CompareService(compareTaskRepository, taskQueue, getRepositories);

  // タスク完了イベントをリッスンして比較タスクのステータスを更新
  const eventBus = getTypedEventBus();

  // 比較タスクIDを持つタスクを検索して更新する関数
  const updateCompareTaskStatusFromTask = async (taskId: string) => {
    try {
      // タスクIDから対応する比較タスクを検索
      const compareTasks = await compareTaskRepository.findByTaskId(taskId);
      for (const compareTask of compareTasks) {
        logger.debug("Updating compare task status", {
          compareId: compareTask.id,
          taskId,
        });
        await compareService.updateCompareTaskStatus(compareTask.id);
      }
    } catch (error) {
      logger.warn("Failed to update compare task status from task event", {
        taskId,
        error,
      });
    }
  };

  // タスク完了イベント
  eventBus.on("task.completed", async (event) => {
    await updateCompareTaskStatusFromTask(event.taskId);
  });

  // タスク失敗イベント
  eventBus.on("task.failed", async (event) => {
    await updateCompareTaskStatusFromTask(event.taskId);
  });

  // タスクキャンセルイベント
  eventBus.on("task.cancelled", async (event) => {
    await updateCompareTaskStatusFromTask(event.taskId);
  });

  logger.info("Compare routes initialized with event listeners");

  // POST /api/compare - 比較タスク作成
  fastify.post<{
    Body: CreateCompareTaskRequest;
    Reply: CreateCompareTaskResponse | { error: { code: string; message: string } };
  }>(
    "/compare",
    {
      preHandler: checkApiKey,
      schema: {
        body: {
          type: "object",
          required: ["instruction", "repositoryId"],
          properties: {
            instruction: { type: "string", minLength: 1 },
            repositoryId: { type: "string", minLength: 1 },
          },
        },
        response: {
          201: {
            type: "object",
            properties: {
              compareId: { type: "string" },
              claudeTaskId: { type: "string" },
              codexTaskId: { type: "string" },
              geminiTaskId: { type: "string" },
              status: { type: "string" },
            },
          },
          429: {
            type: "object",
            properties: {
              error: {
                type: "object",
                properties: {
                  code: { type: "string" },
                  message: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const result = await compareService.createCompareTask(request.body);
        return reply.status(201).send(result);
      } catch (error) {
        if (error instanceof AppError) {
          if (error.code === CompareErrorCode.TOO_MANY_COMPARE_TASKS) {
            reply.header("Retry-After", "60");
            return reply.status(429).send({
              error: {
                code: error.code,
                message: error.message,
              },
            });
          }
          return reply.status(error.statusCode).send({
            error: {
              code: error.code || "UNKNOWN_ERROR",
              message: error.message,
            },
          });
        }
        throw error;
      }
    },
  );

  // GET /api/compare - 比較タスク一覧取得
  fastify.get<{
    Querystring: { limit?: number; offset?: number };
    Reply: { tasks: CompareTaskDetailResponse[]; total: number; limit: number; offset: number };
  }>(
    "/compare",
    {
      preHandler: checkApiKey,
      schema: {
        querystring: {
          type: "object",
          properties: {
            limit: { type: "number", minimum: 1, maximum: 100, default: 20 },
            offset: { type: "number", minimum: 0, default: 0 },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              tasks: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    compareId: { type: "string" },
                    instruction: { type: "string" },
                    repositoryId: { type: "string" },
                    baseCommit: { type: "string" },
                    status: { type: "string" },
                    claudeTaskId: { type: "string", nullable: true },
                    codexTaskId: { type: "string", nullable: true },
                    geminiTaskId: { type: "string", nullable: true },
                    createdAt: { type: "string" },
                    completedAt: { type: "string", nullable: true },
                  },
                },
              },
              total: { type: "number" },
              limit: { type: "number" },
              offset: { type: "number" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { limit = 20, offset = 0 } = request.query;
      const result = await compareService.listCompareTasks(limit, offset);

      return reply.send({
        tasks: result.tasks,
        total: result.total,
        limit,
        offset,
      });
    },
  );

  // GET /api/compare/:id - 比較タスク詳細取得
  fastify.get<{
    Params: { id: string };
    Reply: CompareTaskDetailResponse | { error: { code: string; message: string } };
  }>(
    "/compare/:id",
    {
      preHandler: checkApiKey,
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              compareId: { type: "string" },
              instruction: { type: "string" },
              repositoryId: { type: "string" },
              baseCommit: { type: "string" },
              status: { type: "string" },
              claudeTaskId: { type: "string", nullable: true },
              codexTaskId: { type: "string", nullable: true },
              geminiTaskId: { type: "string", nullable: true },
              createdAt: { type: "string" },
              completedAt: { type: "string", nullable: true },
            },
          },
          404: {
            type: "object",
            properties: {
              error: {
                type: "object",
                properties: {
                  code: { type: "string" },
                  message: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const task = await compareService.getCompareTask(request.params.id);

      if (!task) {
        return reply.status(404).send({
          error: {
            code: CompareErrorCode.COMPARE_TASK_NOT_FOUND,
            message: "比較タスクが見つかりません",
          },
        });
      }

      return reply.send(task);
    },
  );

  // GET /api/compare/:id/files - 変更ファイル一覧取得
  fastify.get<{
    Params: { id: string };
    Reply: CompareFilesResponse | { error: { code: string; message: string } };
  }>(
    "/compare/:id/files",
    {
      preHandler: checkApiKey,
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              files: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    path: { type: "string" },
                    claude: { type: "string", nullable: true },
                    codex: { type: "string", nullable: true },
                    gemini: { type: "string", nullable: true },
                  },
                },
              },
              truncated: { type: "boolean" },
              totalCount: { type: "number" },
            },
          },
          404: {
            type: "object",
            properties: {
              error: {
                type: "object",
                properties: {
                  code: { type: "string" },
                  message: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const result = await compareService.getCompareFiles(request.params.id);
        return reply.send(result);
      } catch (error) {
        if (error instanceof AppError && error.code === CompareErrorCode.COMPARE_TASK_NOT_FOUND) {
          return reply.status(404).send({
            error: {
              code: error.code,
              message: error.message,
            },
          });
        }
        throw error;
      }
    },
  );

  // DELETE /api/compare/:id - 比較タスクキャンセル
  fastify.delete<{
    Params: { id: string };
    Reply: { compareId: string; status: string } | { error: { code: string; message: string } };
  }>(
    "/compare/:id",
    {
      preHandler: checkApiKey,
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              compareId: { type: "string" },
              status: { type: "string" },
            },
          },
          404: {
            type: "object",
            properties: {
              error: {
                type: "object",
                properties: {
                  code: { type: "string" },
                  message: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const result = await compareService.cancelCompareTask(request.params.id);
        return reply.send(result);
      } catch (error) {
        if (error instanceof AppError && error.code === CompareErrorCode.COMPARE_TASK_NOT_FOUND) {
          return reply.status(404).send({
            error: {
              code: error.code,
              message: error.message,
            },
          });
        }
        throw error;
      }
    },
  );
};

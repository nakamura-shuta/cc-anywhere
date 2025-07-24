import type { FastifyInstance } from "fastify";
import fastifyStatic from "@fastify/static";
import path from "path";
import fs from "fs";

export async function registerStaticPlugin(fastify: FastifyInstance): Promise<void> {
  const webRoot = path.join(process.cwd(), "web");

  // Serve static files from the web directory
  await fastify.register(fastifyStatic, {
    root: webRoot,
    prefix: "/", // Serve at root level
    decorateReply: false, // Don't decorate reply
    // デフォルトでindex.html（高機能版）を使用
    index: ["index.html"],
    // ワイルドカードを無効化（後で手動で処理）
    wildcard: false,
  });

  // examplesディレクトリが存在する場合のみ登録
  const examplesPath = path.join(process.cwd(), "src/examples");
  if (fs.existsSync(examplesPath)) {
    await fastify.register(fastifyStatic, {
      root: examplesPath,
      prefix: "/examples/",
      decorateReply: false,
    });
  }

  // SPAのルーティングサポート
  // setNotFoundHandlerを使用してSPAルーティングを処理
  fastify.setNotFoundHandler(async (request, reply) => {
    // APIルートは除外
    if (
      request.url.startsWith("/api/") ||
      request.url.startsWith("/ws") ||
      request.url.startsWith("/examples/")
    ) {
      return reply.code(404).send({
        error: {
          message: `Route ${request.method}:${request.url} not found`,
          statusCode: 404,
          code: "NOT_FOUND",
        },
      });
    }

    // index.htmlを返す（SPAルーティング）
    const indexPath = path.join(webRoot, "index.html");
    if (fs.existsSync(indexPath)) {
      const stream = fs.createReadStream(indexPath);
      return reply.type("text/html").send(stream);
    }

    return reply.code(404).send({
      error: {
        message: "index.html not found",
        statusCode: 404,
        code: "NOT_FOUND",
      },
    });
  });
}

import type { FastifyPluginAsync } from "fastify";
import { StreamingWebSocketHandler } from "../websocket/streaming-handler";

const streamingRoutes: FastifyPluginAsync = async (fastify) => {
  const handler = new StreamingWebSocketHandler();

  // WebSocketエンドポイント
  fastify.get("/ws/streaming", { websocket: true }, (connection, req) => {
    void handler.handleConnection(connection, req);
  });

  // ストリーミングタスクの情報を取得するREST API
  fastify.get(
    "/api/streaming/info",
    {
      schema: {
        description: "Get streaming task execution information",
        tags: ["streaming"],
        response: {
          200: {
            type: "object",
            properties: {
              enabled: { type: "boolean" },
              wsEndpoint: { type: "string" },
              maxQueueSize: { type: "number" },
              maxTurns: { type: "number" },
              features: {
                type: "array",
                items: { type: "string" },
              },
            },
          },
        },
      },
    },
    async (_request, _reply) => {
      return {
        enabled: true,
        wsEndpoint: "/ws/streaming",
        maxQueueSize: 10,
        maxTurns: 50,
        features: [
          "real-time-interaction",
          "progressive-instructions",
          "abort-support",
          "progress-streaming",
        ],
      };
    },
  );
};

export default streamingRoutes;

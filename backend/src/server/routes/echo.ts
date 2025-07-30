import type { FastifyPluginAsync } from "fastify";

// eslint-disable-next-line @typescript-eslint/require-await
export const echoRoutes: FastifyPluginAsync = async (fastify) => {
  // Echo endpoint for testing
  fastify.post<{
    Body: Record<string, unknown>;
  }>("/echo", (request) => {
    return request.body;
  });

  // Error test endpoint
  fastify.get("/error-test", () => {
    throw new Error("Test error");
  });

  // WebSocket status endpoint
  fastify.get("/websocket-status", () => {
    const wsServer = fastify.wsServer;
    if (!wsServer) {
      return {
        enabled: false,
        message: "WebSocket server not initialized",
      };
    }

    const stats = wsServer.getStats();
    return {
      enabled: true,
      stats,
      url: "ws://localhost:5000/ws",
    };
  });
};

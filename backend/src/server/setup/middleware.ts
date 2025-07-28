import type { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import sensible from "@fastify/sensible";
import { errorHandlerPlugin } from "../plugins/error-handler";
import { registerStaticPlugin } from "../plugins/static";
import { config } from "../../config";

/**
 * Register all middleware plugins for the application
 * @param app Fastify instance
 */
export async function registerMiddleware(app: FastifyInstance): Promise<void> {
  // Register core plugins
  await app.register(helmet, {
    contentSecurityPolicy: false, // We'll configure this later based on needs
  });

  await app.register(cors, {
    origin: config.isDevelopment
      ? ["http://localhost:4444", "http://localhost:5000", "http://localhost:5173"]
      : config.cors.origin,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-API-Key"],
  });

  await app.register(sensible);

  // Register static file serving for Web UI (before auth to bypass authentication)
  await app.register(registerStaticPlugin);

  // Register custom plugins
  await app.register(errorHandlerPlugin);
  // await app.register(authPlugin); // 一時的に無効化
}

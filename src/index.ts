import { createApp } from "./server/app";
import { logger } from "./utils/logger";
import { config } from "./config";

async function start() {
  try {
    const app = await createApp();

    await app.listen({ port: config.server.port, host: config.server.host });

    logger.info(`Server is running at http://${config.server.host}:${config.server.port}`);
    logger.info(
      `Health check available at http://${config.server.host}:${config.server.port}/health`,
    );
  } catch (err) {
    logger.error("Failed to start server:", err);
    process.exit(1);
  }
}

void start();

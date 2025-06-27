import { createApp } from "./server/app";
import { logger } from "./utils/logger";
import { config } from "./config";
import { startNgrok, displayAccessInfo } from "./utils/ngrok";

async function start() {
  try {
    const app = await createApp();

    await app.listen({ port: config.server.port, host: config.server.host });

    logger.info(`Server is running at http://${config.server.host}:${config.server.port}`);
    logger.info(
      `Health check available at http://${config.server.host}:${config.server.port}/health`,
    );

    // ngrokを起動（有効な場合）
    if (config.ngrok.enabled) {
      const ngrokUrl = await startNgrok(config.server.port);
      if (ngrokUrl) {
        displayAccessInfo(ngrokUrl);
      } else {
        logger.warn("ngrok is enabled but failed to start");
      }
    }
  } catch (err) {
    logger.error("Failed to start server:", err);
    process.exit(1);
  }
}

void start();

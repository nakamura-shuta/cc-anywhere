import { createApp } from "./server/app";
import { logger } from "./utils/logger";
import { config } from "./config";
import { tunnelManager } from "./utils/tunnel";

async function start() {
  try {
    const app = await createApp();

    await app.listen({ port: config.server.port, host: config.server.host });

    logger.info(`Server is running at http://${config.server.host}:${config.server.port}`);
    logger.info(
      `Health check available at http://${config.server.host}:${config.server.port}/health`,
    );

    // トンネルを起動（有効な場合）
    if (config.tunnel.enabled) {
      const tunnelInfo = await tunnelManager.start(config.server.port);
      if (tunnelInfo) {
        logger.info(`${tunnelInfo.type} tunnel is ready at ${tunnelInfo.url}`);
      } else {
        logger.warn("Tunnel is enabled but failed to start");
      }
    }
  } catch (err) {
    logger.error("Failed to start server:", err);
    process.exit(1);
  }
}

void start();

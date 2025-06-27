import type { FastifyPluginAsync } from "fastify";
import { readFileSync } from "fs";
import { join } from "path";
import { logger } from "../../utils/logger";
import { checkApiKey } from "../middleware/auth";

interface Repository {
  name: string;
  path: string;
}

interface RepositoriesConfig {
  repositories: Repository[];
}

// eslint-disable-next-line @typescript-eslint/require-await
export const repositoryRoutes: FastifyPluginAsync = async (fastify) => {
  // Get repositories list
  fastify.get<{
    Reply: RepositoriesConfig;
  }>("/repositories", {
    preHandler: checkApiKey,
  }, (_request, reply) => {
    try {
      const configPath = join(process.cwd(), "config", "repositories.json");
      const configContent = readFileSync(configPath, "utf-8");
      const config = JSON.parse(configContent) as RepositoriesConfig;

      logger.info("Loaded repositories config", { count: config.repositories.length });

      void reply.send(config);
    } catch (error) {
      logger.error("Failed to load repositories config", { error });

      // デフォルト値を返す
      void reply.send({
        repositories: [
          {
            name: "cc-anywhere",
            path: process.cwd(),
          },
        ],
      });
    }
  });
};

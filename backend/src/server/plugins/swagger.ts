import fp from "fastify-plugin";
import swagger from "@fastify/swagger";
import swaggerUI from "@fastify/swagger-ui";
import { readFileSync } from "fs";
import { load } from "js-yaml";
import { resolve } from "path";
import type { FastifyInstance } from "fastify";

export default fp(async function swaggerPlugin(fastify: FastifyInstance) {
  // OpenAPI仕様ファイルのパスを解決 (プロジェクトルートから相対パス)
  const openapiPath = resolve(process.cwd(), "openapi/openapi.yaml");

  try {
    // YAMLファイルを読み込んでパース
    const openapiContent = readFileSync(openapiPath, "utf8");
    const openapiDocument = load(openapiContent) as any;

    // Swagger プラグインを登録
    await fastify.register(swagger, {
      mode: "static",
      specification: {
        document: openapiDocument,
      },
    });

    // Swagger UI プラグインを登録
    await fastify.register(swaggerUI, {
      routePrefix: "/api/docs",
      uiConfig: {
        docExpansion: "list",
        deepLinking: true,
        tryItOutEnabled: true,
        displayRequestDuration: true,
        filter: true,
      },
      staticCSP: true,
      transformStaticCSP: (header) => header,
      transformSpecification: (swaggerObject, request) => {
        // 動的にサーバーURLを設定 (新しいオブジェクトを返す)
        if (request.headers.host) {
          const protocol = request.headers["x-forwarded-proto"] || "http";
          return {
            ...swaggerObject,
            servers: [
              {
                url: `${protocol}://${request.headers.host}`,
                description: "Current server",
              },
            ],
          };
        }
        return swaggerObject;
      },
    });

    fastify.log.info("OpenAPI documentation registered at /api/docs");
  } catch (error) {
    fastify.log.error("Failed to load OpenAPI specification:", error);
    throw error;
  }
});

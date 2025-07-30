import type { FastifyRequest, FastifyReply } from "fastify";
import { config } from "../../config";

export async function checkApiKey(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  // Skip API key auth if QR auth is enabled
  if (config.qrAuth?.enabled) {
    return;
  }

  // Skip auth if not enabled
  if (!config.auth.enabled) {
    return;
  }

  // Get API key from header or query parameter
  const headerKey = request.headers["x-api-key"] as string;
  const queryKey = (request.query as Record<string, string>)?.apiKey;
  const providedKey = headerKey || queryKey;

  if (!providedKey) {
    await reply.status(401).send({
      error: {
        message: "API key required",
        code: "MISSING_API_KEY",
      },
    });
    return;
  }

  if (providedKey !== config.auth.apiKey) {
    await reply.status(401).send({
      error: {
        message: "Invalid API key",
        code: "INVALID_API_KEY",
      },
    });
    return;
  }
}

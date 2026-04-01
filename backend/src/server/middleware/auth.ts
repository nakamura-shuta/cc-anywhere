import type { FastifyRequest, FastifyReply } from "fastify";

/**
 * Legacy checkApiKey - now a no-op.
 * Authentication is handled entirely by global-auth middleware
 * which sets request.user on every authenticated request.
 * Kept for backward compatibility with existing preHandler references.
 */
export async function checkApiKey(_request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  // No-op: global-auth middleware handles all authentication
}

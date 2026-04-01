/**
 * Auth routes - user registration and login
 */

import type { FastifyPluginAsync } from "fastify";
import type { UserService } from "../../services/user-service.js";
import { logger } from "../../utils/logger.js";

export const authRoutes: FastifyPluginAsync<{
  userService: UserService;
}> = async (fastify, opts) => {
  const { userService } = opts;

  // Register new user (public - no auth required)
  fastify.post("/auth/register", async (request, reply) => {
    try {
      const { username } = request.body as { username: string };
      if (!username || username.trim().length < 2) {
        return reply.code(400).send({ error: "Username must be at least 2 characters" });
      }

      const existing = userService.getByUsername(username.trim());
      if (existing) {
        return reply.code(409).send({ error: "Username already taken" });
      }

      const { user, apiKey } = userService.register(username.trim());
      logger.info("User registered", { userId: user.id, username: user.username });

      return reply.code(201).send({
        user: {
          id: user.id,
          username: user.username,
          authProvider: user.authProvider,
          createdAt: user.createdAt.toISOString(),
        },
        apiKey,
      });
    } catch (error) {
      logger.error("Registration failed", { error });
      return reply.code(500).send({ error: "Registration failed" });
    }
  });

  // Login with API Key (public - no auth required)
  fastify.post("/auth/login", async (request, reply) => {
    try {
      const { apiKey } = request.body as { apiKey: string };
      if (!apiKey) {
        return reply.code(400).send({ error: "API Key is required" });
      }

      const user = userService.getByApiKey(apiKey);
      if (!user) {
        return reply.code(401).send({ error: "Invalid API Key" });
      }

      userService.updateLastLogin(user.id);
      logger.info("User logged in", { userId: user.id, username: user.username });

      return {
        user: {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          authProvider: user.authProvider,
          createdAt: user.createdAt.toISOString(),
        },
      };
    } catch (error) {
      logger.error("Login failed", { error });
      return reply.code(500).send({ error: "Login failed" });
    }
  });

  // Get current user profile (auth required)
  fastify.get("/auth/me", async (request, reply) => {
    const user = (request as any).user;
    if (!user) {
      return reply.code(401).send({ error: "Not authenticated" });
    }

    return {
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        authProvider: user.authProvider,
        createdAt: user.createdAt.toISOString(),
      },
    };
  });

  // Regenerate API Key (auth required)
  fastify.post("/auth/regenerate-key", async (request, reply) => {
    const user = (request as any).user;
    if (!user) {
      return reply.code(401).send({ error: "Not authenticated" });
    }

    const newKey = userService.regenerateApiKey(user.id);
    logger.info("API Key regenerated", { userId: user.id });

    return { apiKey: newKey };
  });
};

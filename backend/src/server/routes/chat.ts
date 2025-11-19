/**
 * Chat routes for LINE-like chat UI with agent characters
 */

import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { v4 as uuidv4 } from "uuid";
import jwt from "jsonwebtoken";
import { getSharedChatRepository } from "../../db/shared-instance.js";
import { logger } from "../../utils/logger.js";
import { config } from "../../config/index.js";
import type { ChatSession, ChatMessage, CustomCharacter } from "../../repositories/chat-repository.js";
import { createChatExecutor } from "../../chat/index.js";
import type { ChatStreamEvent } from "../../chat/types.js";

// Request schemas
const createSessionSchema = z.object({
  characterId: z.string().min(1),
  workingDirectory: z.string().optional(),
  executor: z.enum(["claude", "codex"]).default("claude"),
});

const sendMessageSchema = z.object({
  content: z.string().min(1),
});

const createCharacterSchema = z.object({
  name: z.string().min(1).max(100),
  avatar: z.string().url().optional(),
  description: z.string().max(500).optional(),
  systemPrompt: z.string().min(1).max(10000),
});

const updateCharacterSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  avatar: z.string().url().optional(),
  description: z.string().max(500).optional(),
  systemPrompt: z.string().min(1).max(10000).optional(),
});

const chatRoutes: FastifyPluginAsync = async (fastify) => {
  const chatRepository = getSharedChatRepository();

  // Helper to get user ID from request (simplified - real implementation would use auth)
  const getUserId = (request: any): string => {
    // TODO: Implement proper authentication
    return request.headers["x-user-id"] || "default-user";
  };

  // ======================
  // Session endpoints
  // ======================

  // Create a new chat session
  fastify.post<{ Body: z.infer<typeof createSessionSchema> }>(
    "/chat/sessions",
    {
      schema: {
        body: zodToJsonSchema(createSessionSchema),
        response: {
          201: {
            type: "object",
            properties: {
              id: { type: "string" },
              userId: { type: "string" },
              characterId: { type: "string" },
              workingDirectory: { type: "string", nullable: true },
              executor: { type: "string" },
              createdAt: { type: "string", format: "date-time" },
              updatedAt: { type: "string", format: "date-time" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const userId = getUserId(request);
      const { characterId, workingDirectory, executor } = createSessionSchema.parse(request.body);

      const session: ChatSession = {
        id: uuidv4(),
        userId,
        characterId,
        workingDirectory,
        executor,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await chatRepository.sessions.create(session);

      logger.info("Chat session created", { sessionId: session.id, userId, characterId });

      return reply.status(201).send({
        id: session.id,
        userId: session.userId,
        characterId: session.characterId,
        workingDirectory: session.workingDirectory || null,
        executor: session.executor,
        createdAt: session.createdAt.toISOString(),
        updatedAt: session.updatedAt.toISOString(),
      });
    },
  );

  // List user's sessions
  fastify.get(
    "/chat/sessions",
    {
      schema: {
        querystring: {
          type: "object",
          properties: {
            limit: { type: "number", minimum: 1, maximum: 100, default: 20 },
            page: { type: "number", minimum: 1, default: 1 },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              items: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    characterId: { type: "string" },
                    workingDirectory: { type: "string", nullable: true },
                    executor: { type: "string" },
                    createdAt: { type: "string", format: "date-time" },
                    updatedAt: { type: "string", format: "date-time" },
                  },
                },
              },
              total: { type: "number" },
              page: { type: "number" },
              limit: { type: "number" },
              totalPages: { type: "number" },
            },
          },
        },
      },
    },
    async (request) => {
      const userId = getUserId(request);
      const { limit, page } = request.query as { limit: number; page: number };

      const result = await chatRepository.sessions.findByUserId(userId, {
        limit,
        page,
        sortBy: "updated_at",
        sortOrder: "desc",
      });

      return {
        items: result.items.map((s) => ({
          id: s.id,
          characterId: s.characterId,
          workingDirectory: s.workingDirectory || null,
          executor: s.executor,
          createdAt: s.createdAt.toISOString(),
          updatedAt: s.updatedAt.toISOString(),
        })),
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      };
    },
  );

  // Get session by ID
  fastify.get<{ Params: { sessionId: string } }>(
    "/chat/sessions/:sessionId",
    {
      schema: {
        params: {
          type: "object",
          properties: {
            sessionId: { type: "string" },
          },
          required: ["sessionId"],
        },
        response: {
          200: {
            type: "object",
            properties: {
              id: { type: "string" },
              userId: { type: "string" },
              characterId: { type: "string" },
              workingDirectory: { type: "string", nullable: true },
              executor: { type: "string" },
              sdkSessionId: { type: "string", nullable: true },
              createdAt: { type: "string", format: "date-time" },
              updatedAt: { type: "string", format: "date-time" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const userId = getUserId(request);
      const { sessionId } = request.params;

      const session = await chatRepository.sessions.findById(sessionId);

      if (!session || session.userId !== userId) {
        return reply.status(404).send({
          error: {
            message: "Session not found",
            statusCode: 404,
            code: "SESSION_NOT_FOUND",
          },
        });
      }

      return {
        id: session.id,
        userId: session.userId,
        characterId: session.characterId,
        workingDirectory: session.workingDirectory || null,
        executor: session.executor,
        sdkSessionId: session.sdkSessionId || null,
        createdAt: session.createdAt.toISOString(),
        updatedAt: session.updatedAt.toISOString(),
      };
    },
  );

  // Delete session
  fastify.delete<{ Params: { sessionId: string } }>(
    "/chat/sessions/:sessionId",
    {
      schema: {
        params: {
          type: "object",
          properties: {
            sessionId: { type: "string" },
          },
          required: ["sessionId"],
        },
        response: {
          200: {
            type: "object",
            properties: {
              message: { type: "string" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const userId = getUserId(request);
      const { sessionId } = request.params;

      const session = await chatRepository.sessions.findById(sessionId);

      if (!session || session.userId !== userId) {
        return reply.status(404).send({
          error: {
            message: "Session not found",
            statusCode: 404,
            code: "SESSION_NOT_FOUND",
          },
        });
      }

      await chatRepository.sessions.delete(sessionId);

      logger.info("Chat session deleted", { sessionId, userId });

      return { message: "Session deleted successfully" };
    },
  );

  // ======================
  // Message endpoints
  // ======================

  // Get messages for a session
  fastify.get<{ Params: { sessionId: string } }>(
    "/chat/sessions/:sessionId/messages",
    {
      schema: {
        params: {
          type: "object",
          properties: {
            sessionId: { type: "string" },
          },
          required: ["sessionId"],
        },
        response: {
          200: {
            type: "object",
            properties: {
              messages: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    role: { type: "string" },
                    content: { type: "string" },
                    createdAt: { type: "string", format: "date-time" },
                  },
                },
              },
              count: { type: "number" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const userId = getUserId(request);
      const { sessionId } = request.params;

      const session = await chatRepository.sessions.findById(sessionId);

      if (!session || session.userId !== userId) {
        return reply.status(404).send({
          error: {
            message: "Session not found",
            statusCode: 404,
            code: "SESSION_NOT_FOUND",
          },
        });
      }

      const messages = await chatRepository.messages.findBySessionId(sessionId);

      return {
        messages: messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          createdAt: m.createdAt.toISOString(),
        })),
        count: messages.length,
      };
    },
  );

  // Send a message (placeholder - actual streaming will be in separate endpoint)
  fastify.post<{ Params: { sessionId: string }; Body: z.infer<typeof sendMessageSchema> }>(
    "/chat/sessions/:sessionId/messages",
    {
      schema: {
        params: {
          type: "object",
          properties: {
            sessionId: { type: "string" },
          },
          required: ["sessionId"],
        },
        body: zodToJsonSchema(sendMessageSchema),
        response: {
          201: {
            type: "object",
            properties: {
              id: { type: "string" },
              role: { type: "string" },
              content: { type: "string" },
              createdAt: { type: "string", format: "date-time" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const userId = getUserId(request);
      const { sessionId } = request.params;
      const { content } = sendMessageSchema.parse(request.body);

      const session = await chatRepository.sessions.findById(sessionId);

      if (!session || session.userId !== userId) {
        return reply.status(404).send({
          error: {
            message: "Session not found",
            statusCode: 404,
            code: "SESSION_NOT_FOUND",
          },
        });
      }

      const message: ChatMessage = {
        id: uuidv4(),
        sessionId,
        role: "user",
        content,
        createdAt: new Date(),
      };

      await chatRepository.messages.create(message);

      logger.info("Chat message created", { messageId: message.id, sessionId });

      return reply.status(201).send({
        id: message.id,
        role: message.role,
        content: message.content,
        createdAt: message.createdAt.toISOString(),
      });
    },
  );

  // ======================
  // Character endpoints
  // ======================

  // List built-in and custom characters
  fastify.get(
    "/chat/characters",
    {
      schema: {
        response: {
          200: {
            type: "object",
            properties: {
              builtIn: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    name: { type: "string" },
                    avatar: { type: "string", nullable: true },
                    description: { type: "string", nullable: true },
                    isBuiltIn: { type: "boolean" },
                  },
                },
              },
              custom: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    name: { type: "string" },
                    avatar: { type: "string", nullable: true },
                    description: { type: "string", nullable: true },
                    isBuiltIn: { type: "boolean" },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request) => {
      const userId = getUserId(request);

      // Built-in characters
      const builtInCharacters = [
        {
          id: "default",
          name: "Claude",
          avatar: null,
          description: "Default Claude assistant",
          isBuiltIn: true,
        },
      ];

      // Custom characters
      const customCharacters = await chatRepository.characters.findByUserId(userId);

      return {
        builtIn: builtInCharacters,
        custom: customCharacters.map((c) => ({
          id: c.id,
          name: c.name,
          avatar: c.avatar || null,
          description: c.description || null,
          isBuiltIn: false,
        })),
      };
    },
  );

  // Create custom character
  fastify.post<{ Body: z.infer<typeof createCharacterSchema> }>(
    "/chat/characters",
    {
      schema: {
        body: zodToJsonSchema(createCharacterSchema),
        response: {
          201: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              avatar: { type: "string", nullable: true },
              description: { type: "string", nullable: true },
              systemPrompt: { type: "string" },
              createdAt: { type: "string", format: "date-time" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const userId = getUserId(request);
      const { name, avatar, description, systemPrompt } = createCharacterSchema.parse(request.body);

      const character: CustomCharacter = {
        id: uuidv4(),
        userId,
        name,
        avatar,
        description,
        systemPrompt,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await chatRepository.characters.create(character);

      logger.info("Custom character created", { characterId: character.id, userId, name });

      return reply.status(201).send({
        id: character.id,
        name: character.name,
        avatar: character.avatar || null,
        description: character.description || null,
        systemPrompt: character.systemPrompt,
        createdAt: character.createdAt.toISOString(),
      });
    },
  );

  // Get character by ID
  fastify.get<{ Params: { characterId: string } }>(
    "/chat/characters/:characterId",
    {
      schema: {
        params: {
          type: "object",
          properties: {
            characterId: { type: "string" },
          },
          required: ["characterId"],
        },
        response: {
          200: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              avatar: { type: "string", nullable: true },
              description: { type: "string", nullable: true },
              systemPrompt: { type: "string" },
              isBuiltIn: { type: "boolean" },
              createdAt: { type: "string", format: "date-time", nullable: true },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const userId = getUserId(request);
      const { characterId } = request.params;

      // Check for built-in character
      if (characterId === "default") {
        return {
          id: "default",
          name: "Claude",
          avatar: null,
          description: "Default Claude assistant",
          systemPrompt: "You are a helpful assistant.",
          isBuiltIn: true,
          createdAt: null,
        };
      }

      const character = await chatRepository.characters.findByIdAndUserId(characterId, userId);

      if (!character) {
        return reply.status(404).send({
          error: {
            message: "Character not found",
            statusCode: 404,
            code: "CHARACTER_NOT_FOUND",
          },
        });
      }

      return {
        id: character.id,
        name: character.name,
        avatar: character.avatar || null,
        description: character.description || null,
        systemPrompt: character.systemPrompt,
        isBuiltIn: false,
        createdAt: character.createdAt.toISOString(),
      };
    },
  );

  // Update character
  fastify.put<{ Params: { characterId: string }; Body: z.infer<typeof updateCharacterSchema> }>(
    "/chat/characters/:characterId",
    {
      schema: {
        params: {
          type: "object",
          properties: {
            characterId: { type: "string" },
          },
          required: ["characterId"],
        },
        body: zodToJsonSchema(updateCharacterSchema),
        response: {
          200: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              avatar: { type: "string", nullable: true },
              description: { type: "string", nullable: true },
              systemPrompt: { type: "string" },
              updatedAt: { type: "string", format: "date-time" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const userId = getUserId(request);
      const { characterId } = request.params;
      const updates = updateCharacterSchema.parse(request.body);

      const character = await chatRepository.characters.findByIdAndUserId(characterId, userId);

      if (!character) {
        return reply.status(404).send({
          error: {
            message: "Character not found",
            statusCode: 404,
            code: "CHARACTER_NOT_FOUND",
          },
        });
      }

      const updateData: Partial<CustomCharacter> = {
        ...updates,
        updatedAt: new Date(),
      };

      const updated = await chatRepository.characters.update(characterId, updateData);

      if (!updated) {
        return reply.status(500).send({
          error: {
            message: "Failed to update character",
            statusCode: 500,
            code: "UPDATE_FAILED",
          },
        });
      }

      logger.info("Custom character updated", { characterId, userId });

      return {
        id: updated.id,
        name: updated.name,
        avatar: updated.avatar || null,
        description: updated.description || null,
        systemPrompt: updated.systemPrompt,
        updatedAt: updated.updatedAt.toISOString(),
      };
    },
  );

  // Delete character
  fastify.delete<{ Params: { characterId: string } }>(
    "/chat/characters/:characterId",
    {
      schema: {
        params: {
          type: "object",
          properties: {
            characterId: { type: "string" },
          },
          required: ["characterId"],
        },
        response: {
          200: {
            type: "object",
            properties: {
              message: { type: "string" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const userId = getUserId(request);
      const { characterId } = request.params;

      const character = await chatRepository.characters.findByIdAndUserId(characterId, userId);

      if (!character) {
        return reply.status(404).send({
          error: {
            message: "Character not found",
            statusCode: 404,
            code: "CHARACTER_NOT_FOUND",
          },
        });
      }

      await chatRepository.characters.delete(characterId);

      logger.info("Custom character deleted", { characterId, userId });

      return { message: "Character deleted successfully" };
    },
  );

  // ======================
  // Stream endpoints
  // ======================

  // Generate stream token for SSE connection
  fastify.post<{ Params: { sessionId: string } }>(
    "/chat/sessions/:sessionId/stream-token",
    {
      schema: {
        params: {
          type: "object",
          properties: {
            sessionId: { type: "string" },
          },
          required: ["sessionId"],
        },
        response: {
          200: {
            type: "object",
            properties: {
              token: { type: "string" },
              expiresAt: { type: "string", format: "date-time" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const userId = getUserId(request);
      const { sessionId } = request.params;

      const session = await chatRepository.sessions.findById(sessionId);

      if (!session || session.userId !== userId) {
        return reply.status(404).send({
          error: {
            message: "Session not found",
            statusCode: 404,
            code: "SESSION_NOT_FOUND",
          },
        });
      }

      // Generate JWT token
      const expiresIn = config.chat.streamTokenExpirySeconds;
      const expiresAt = new Date(Date.now() + expiresIn * 1000);

      const token = jwt.sign(
        { sessionId, userId },
        config.chat.streamTokenSecret,
        { expiresIn }
      );

      logger.info("Stream token generated", { sessionId, userId });

      return {
        token,
        expiresAt: expiresAt.toISOString(),
      };
    },
  );

  // SSE stream endpoint
  fastify.get<{ Params: { sessionId: string }; Querystring: { token?: string } }>(
    "/chat/sessions/:sessionId/stream",
    {
      schema: {
        params: {
          type: "object",
          properties: {
            sessionId: { type: "string" },
          },
          required: ["sessionId"],
        },
        querystring: {
          type: "object",
          properties: {
            token: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      const { sessionId } = request.params;
      const { token } = request.query;

      // Validate token
      if (!token) {
        return reply.status(401).send({
          error: {
            message: "Stream token required",
            statusCode: 401,
            code: "TOKEN_REQUIRED",
          },
        });
      }

      // Verify JWT token
      let decoded: { sessionId: string; userId: string };
      try {
        decoded = jwt.verify(token, config.chat.streamTokenSecret) as {
          sessionId: string;
          userId: string;
        };
      } catch (error) {
        return reply.status(401).send({
          error: {
            message: "Invalid or expired token",
            statusCode: 401,
            code: "INVALID_TOKEN",
          },
        });
      }

      // Validate session ID matches token
      if (decoded.sessionId !== sessionId) {
        return reply.status(401).send({
          error: {
            message: "Token session mismatch",
            statusCode: 401,
            code: "SESSION_MISMATCH",
          },
        });
      }

      // Verify session exists and belongs to user
      const session = await chatRepository.sessions.findById(sessionId);
      if (!session || session.userId !== decoded.userId) {
        return reply.status(404).send({
          error: {
            message: "Session not found",
            statusCode: 404,
            code: "SESSION_NOT_FOUND",
          },
        });
      }

      // Set SSE headers
      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no", // Disable nginx buffering
      });

      // Send initial connection event
      reply.raw.write(`event: connected\ndata: ${JSON.stringify({ sessionId })}\n\n`);

      // Store the connection for later use
      const connectionId = uuidv4();
      logger.info("SSE connection established", { sessionId, connectionId });

      // Handle client disconnect
      request.raw.on("close", () => {
        logger.info("SSE connection closed", { sessionId, connectionId });
      });

      // Keep the connection open - don't call reply.send()
      // Messages will be sent via processMessage endpoint
    },
  );

  // Process message and stream response
  fastify.post<{ Params: { sessionId: string }; Body: z.infer<typeof sendMessageSchema> }>(
    "/chat/sessions/:sessionId/process",
    {
      schema: {
        params: {
          type: "object",
          properties: {
            sessionId: { type: "string" },
          },
          required: ["sessionId"],
        },
        body: zodToJsonSchema(sendMessageSchema),
        response: {
          200: {
            type: "object",
            properties: {
              messageId: { type: "string" },
              content: { type: "string" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const userId = getUserId(request);
      const { sessionId } = request.params;
      const { content } = sendMessageSchema.parse(request.body);

      const session = await chatRepository.sessions.findById(sessionId);

      if (!session || session.userId !== userId) {
        return reply.status(404).send({
          error: {
            message: "Session not found",
            statusCode: 404,
            code: "SESSION_NOT_FOUND",
          },
        });
      }

      // Save user message
      const userMessage: ChatMessage = {
        id: uuidv4(),
        sessionId,
        role: "user",
        content,
        createdAt: new Date(),
      };
      await chatRepository.messages.create(userMessage);

      // Get character's system prompt
      let systemPrompt = "You are a helpful assistant.";
      if (session.characterId !== "default") {
        const character = await chatRepository.characters.findByIdAndUserId(
          session.characterId,
          userId
        );
        if (character) {
          systemPrompt = character.systemPrompt;
        }
      }

      // Create executor
      const executor = createChatExecutor(session.executor);

      // Execute and collect events
      const events: ChatStreamEvent[] = [];
      const result = await executor.execute(
        content,
        {
          sessionId,
          characterId: session.characterId,
          systemPrompt,
          workingDirectory: session.workingDirectory,
          executor: session.executor,
          sdkSessionId: session.sdkSessionId,
        },
        (event) => {
          events.push(event);
        }
      );

      // Save agent message
      const agentMessage: ChatMessage = {
        id: result.messageId,
        sessionId,
        role: "agent",
        content: result.content,
        createdAt: new Date(),
      };
      await chatRepository.messages.create(agentMessage);

      // Update SDK session ID if changed
      if (result.sdkSessionId && result.sdkSessionId !== session.sdkSessionId) {
        await chatRepository.sessions.updateSdkSessionId(sessionId, result.sdkSessionId);
      }

      logger.info("Chat message processed", {
        sessionId,
        userMessageId: userMessage.id,
        agentMessageId: agentMessage.id,
      });

      return {
        messageId: result.messageId,
        content: result.content,
      };
    },
  );
};

export default chatRoutes;

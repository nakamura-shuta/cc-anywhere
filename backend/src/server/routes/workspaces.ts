/**
 * Workspace routes - upload and manage workspaces
 */

import type { FastifyPluginAsync } from "fastify";
import multipart from "@fastify/multipart";
import type { WorkspaceService } from "../../services/workspace-service.js";
import { logger } from "../../utils/logger.js";

export const workspaceRoutes: FastifyPluginAsync<{
  workspaceService: WorkspaceService;
}> = async (fastify, opts) => {
  const { workspaceService } = opts;

  // Register multipart for this scope only
  await fastify.register(multipart, { limits: { fileSize: 50 * 1024 * 1024 } });

  const getUserId = (request: any): string => {
    if (request.apiKey) {
      const crypto = require("crypto");
      const hash = crypto.createHash("sha256").update(request.apiKey).digest("hex");
      return `user-${hash.substring(0, 16)}`;
    }
    return "default-user";
  };

  // Upload workspace (zip file)
  fastify.post("/workspaces", async (request, reply) => {
    const userId = getUserId(request);

    try {
      const data = await request.file();
      if (!data) {
        return reply.code(400).send({ error: "No file uploaded" });
      }

      const chunks: Buffer[] = [];
      for await (const chunk of data.file) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);

      const name = (data.fields as any)?.name?.value
        || data.filename?.replace(/\.zip$/i, "")
        || "workspace";

      const workspace = await workspaceService.create(userId, buffer, name);

      return reply.code(201).send({
        id: workspace.id,
        name: workspace.name,
        fileCount: workspace.fileCount,
        totalSize: workspace.totalSize,
        createdAt: workspace.createdAt.toISOString(),
        expiresAt: workspace.expiresAt.toISOString(),
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Upload failed";
      logger.error("Workspace upload failed", { error: msg, userId });
      return reply.code(400).send({ error: msg });
    }
  });

  // List user's workspaces
  fastify.get("/workspaces", async (request) => {
    const userId = getUserId(request);
    const workspaces = workspaceService.listByUser(userId);
    return {
      workspaces: workspaces.map((ws) => ({
        id: ws.id,
        name: ws.name,
        fileCount: ws.fileCount,
        totalSize: ws.totalSize,
        createdAt: ws.createdAt.toISOString(),
        expiresAt: ws.expiresAt.toISOString(),
      })),
    };
  });

  // Get workspace file tree
  fastify.get<{ Params: { id: string } }>("/workspaces/:id/tree", async (request, reply) => {
    const userId = getUserId(request);
    const ws = workspaceService.getByUserAndId(userId, request.params.id);
    if (!ws) {
      return reply.code(404).send({ error: "Workspace not found" });
    }
    return { tree: workspaceService.getTree(ws.id) };
  });

  // Delete workspace
  fastify.delete<{ Params: { id: string } }>("/workspaces/:id", async (request, reply) => {
    const userId = getUserId(request);
    const ws = workspaceService.getByUserAndId(userId, request.params.id);
    if (!ws) {
      return reply.code(404).send({ error: "Workspace not found" });
    }
    workspaceService.delete(ws.id);
    return reply.code(204).send();
  });
};

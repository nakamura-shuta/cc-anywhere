/**
 * Workspace resolver - resolves workspaceId to workingDirectory
 *
 * Shared between chat and task routes.
 */

import type { WorkspaceService } from "./workspace-service.js";

let sharedWorkspaceService: WorkspaceService | null = null;

export function setSharedWorkspaceService(service: WorkspaceService): void {
  sharedWorkspaceService = service;
}

export function getSharedWorkspaceService(): WorkspaceService | null {
  return sharedWorkspaceService;
}

/**
 * Resolve workspaceId to workingDirectory path with ownership check.
 * Returns null if workspaceId is not provided.
 * Throws if workspace not found or not owned by user.
 */
export function resolveWorkspace(
  workspaceId: string | undefined,
  userId: string,
): string | null {
  if (!workspaceId || !sharedWorkspaceService) return null;

  const ws = sharedWorkspaceService.getByUserAndId(userId, workspaceId);
  if (!ws) {
    throw new Error("Workspace not found or not owned by user");
  }
  return ws.path;
}

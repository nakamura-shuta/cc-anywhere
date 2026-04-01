/**
 * Shared UserService accessor for components that can't receive it via DI
 * (e.g., WebSocket server, middleware)
 */

import type { UserService } from "./user-service.js";

let sharedUserService: UserService | null = null;

export function setSharedUserService(service: UserService): void {
  sharedUserService = service;
}

export function getSharedUserService(): UserService | null {
  return sharedUserService;
}

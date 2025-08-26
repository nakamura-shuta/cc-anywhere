/**
 * Shared WebSocket Server Instance
 * Provides a singleton instance of WebSocketServer for use across the application
 */

import type { WebSocketServer } from "./websocket-server.js";

let sharedWebSocketServer: WebSocketServer | undefined;

/**
 * Get the shared WebSocket server instance
 * @returns The shared WebSocket server instance or undefined if not initialized
 */
export function getSharedWebSocketServer(): WebSocketServer | undefined {
  return sharedWebSocketServer;
}

/**
 * Set the shared WebSocket server instance
 * @param wsServer The WebSocket server instance to share
 */
export function setSharedWebSocketServer(wsServer: WebSocketServer | undefined): void {
  sharedWebSocketServer = wsServer;
}

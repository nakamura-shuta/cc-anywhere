import { ClaudeCodeClient } from "./claude-code-client";

let sharedClaudeClient: ClaudeCodeClient | null = null;

/**
 * Get or create a shared ClaudeCodeClient instance
 * @returns Shared ClaudeCodeClient instance
 */
export function getSharedClaudeClient(): ClaudeCodeClient {
  if (!sharedClaudeClient) {
    sharedClaudeClient = new ClaudeCodeClient();
  }
  return sharedClaudeClient;
}

/**
 * Reset the shared ClaudeCodeClient instance
 * Useful for testing or when configuration changes
 */
export function resetSharedClaudeClient(): void {
  sharedClaudeClient = null;
}

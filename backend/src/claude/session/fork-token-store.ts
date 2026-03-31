/**
 * Fork Token Store
 *
 * Short-lived, one-time tokens that authorize linking a forked SDK session ID
 * to a new chat session. Prevents arbitrary sdkSessionId injection via createSession.
 */

import crypto from "crypto";

interface TokenEntry {
  sdkSessionId: string;
  expiresAt: number;
}

const TOKEN_TTL_MS = 60 * 1000; // 1 minute

class ForkTokenStore {
  private tokens = new Map<string, TokenEntry>();

  /** Issue a one-time token for a forked sdkSessionId */
  issue(sdkSessionId: string): string {
    this.cleanup(); // purge expired tokens on each issue
    const token = crypto.randomUUID();
    this.tokens.set(token, {
      sdkSessionId,
      expiresAt: Date.now() + TOKEN_TTL_MS,
    });
    return token;
  }

  /** Consume and validate a token. Returns sdkSessionId if valid, null otherwise. */
  consume(token: string): string | null {
    const entry = this.tokens.get(token);
    if (!entry) return null;
    this.tokens.delete(token); // one-time use
    if (Date.now() > entry.expiresAt) return null;
    return entry.sdkSessionId;
  }

  /** Cleanup expired tokens (called periodically) */
  cleanup(): void {
    const now = Date.now();
    for (const [token, entry] of this.tokens) {
      if (now > entry.expiresAt) {
        this.tokens.delete(token);
      }
    }
  }
}

export const forkedSessionTokens = new ForkTokenStore();

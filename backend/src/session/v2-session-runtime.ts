/**
 * V2SessionRuntime - Session pool + SDK utilities (query()-based)
 *
 * Wraps the 0.3.x `query()` API via CompatSession so existing call sites keep
 * their SDKSession-like usage. Stand-alone SDK utilities (listSessions, fork, etc.)
 * are still exposed unchanged.
 */

import {
  forkSession,
  getSessionInfo,
  getSessionMessages,
  listSessions,
  renameSession,
  tagSession,
  type SDKMessage,
  type SDKSessionInfo,
  type SessionMessage as SDKSessionMessage,
  type HookEvent,
  type HookCallbackMatcher,
  type PermissionMode,
  type Options,
} from "@anthropic-ai/claude-agent-sdk";
import type { SessionState } from "./types.js";
import type { CompatSession } from "./session-compat.js";
import { createCompatSession, resumeCompatSession } from "./session-compat.js";

const DEFAULT_MODEL = "claude-opus-4-7";

export interface ManagedSession {
  session: CompatSession;
  sdkSessionId: string | null;
  state: SessionState;
  lastActivityAt: Date;
}

export interface V2CreateParams {
  model?: string;
  cwd?: string;
  systemPrompt?: string;
  permissionMode?: PermissionMode;
  allowedTools?: string[];
  disallowedTools?: string[];
  hooks?: Partial<Record<HookEvent, HookCallbackMatcher[]>>;
}

export interface SendOptions {
  onMaterialized?: (sdkSessionId: string) => void | Promise<void>;
  onStateChanged?: (state: SessionState) => void;
}

export class V2SessionRuntime {
  private pool = new Map<string, ManagedSession>();

  // === Session pool ===

  async createSession(params: V2CreateParams): Promise<ManagedSession> {
    const session = createCompatSession(this.buildOptions(params));
    return { session, sdkSessionId: null, state: "idle", lastActivityAt: new Date() };
  }

  async resumeSession(sdkSessionId: string, params: V2CreateParams): Promise<ManagedSession> {
    const session = resumeCompatSession(sdkSessionId, this.buildOptions(params));
    const managed: ManagedSession = {
      session,
      sdkSessionId,
      state: "idle",
      lastActivityAt: new Date(),
    };
    this.pool.set(sdkSessionId, managed);
    return managed;
  }

  async *sendAndStream(
    managed: ManagedSession,
    message: string,
    options?: SendOptions,
  ): AsyncGenerator<SDKMessage, void> {
    managed.state = "running";
    managed.lastActivityAt = new Date();
    options?.onStateChanged?.("running");

    await managed.session.send(message);

    let materialized = managed.sdkSessionId !== null;

    for await (const event of managed.session.stream()) {
      managed.lastActivityAt = new Date();

      if (!materialized) {
        try {
          const id = managed.session.sessionId;
          managed.sdkSessionId = id;
          materialized = true;
          this.pool.set(id, managed);
          await options?.onMaterialized?.(id);
        } catch {
          // not yet available; will retry on next event
        }
      }

      if (event.type === "system" && event.subtype === "session_state_changed") {
        managed.state = event.state as SessionState;
        options?.onStateChanged?.(event.state as SessionState);
      }

      yield event;
    }

    managed.state = "idle";
    managed.lastActivityAt = new Date();
    options?.onStateChanged?.("idle");
  }

  detach(managed: ManagedSession): void {
    if (managed.sdkSessionId) this.pool.delete(managed.sdkSessionId);
  }

  terminate(managed: ManagedSession): void {
    managed.session.close();
    if (managed.sdkSessionId) this.pool.delete(managed.sdkSessionId);
  }

  terminateById(sdkSessionId: string): boolean {
    const managed = this.pool.get(sdkSessionId);
    if (!managed) return false;
    this.terminate(managed);
    return true;
  }

  evictIdle(maxIdleMs = 30 * 60 * 1000): number {
    const now = Date.now();
    let count = 0;
    for (const [id, m] of this.pool) {
      if (m.state === "idle" && now - m.lastActivityAt.getTime() > maxIdleMs) {
        m.session.close();
        this.pool.delete(id);
        count++;
      }
    }
    return count;
  }

  terminateAll(): void {
    for (const [, m] of this.pool) m.session.close();
    this.pool.clear();
  }

  getPoolSize(): number {
    return this.pool.size;
  }

  // === SDK utilities ===

  async getInfo(sdkSessionId: string): Promise<SDKSessionInfo | undefined> {
    return getSessionInfo(sdkSessionId);
  }

  async getMessages(sdkSessionId: string): Promise<SDKSessionMessage[]> {
    return getSessionMessages(sdkSessionId);
  }

  async listSessions(opts?: { dir?: string }): Promise<SDKSessionInfo[]> {
    return listSessions(opts);
  }

  async fork(
    sdkSessionId: string,
    opts?: { upToMessageId?: string; title?: string },
  ): Promise<{ sdkSessionId: string }> {
    const result = await forkSession(sdkSessionId, opts);
    return { sdkSessionId: result.sessionId };
  }

  async rename(sdkSessionId: string, title: string): Promise<void> {
    await renameSession(sdkSessionId, title);
  }

  async tag(sdkSessionId: string, tag: string | null): Promise<void> {
    await tagSession(sdkSessionId, tag);
  }

  // === Internal ===

  private buildOptions(params: V2CreateParams): Options {
    // 0.2.83+ : session_state_changed is opt-in. Preserve current state tracking by enabling it.
    const env: Record<string, string> = {
      ...(Object.fromEntries(
        Object.entries(process.env).filter(([, v]) => v !== undefined),
      ) as Record<string, string>),
      CLAUDE_AGENT_SDK_CLIENT_APP: "cc-anywhere/1.0.0",
      CLAUDE_CODE_EMIT_SESSION_STATE_EVENTS: "1",
    };
    if (params.cwd) {
      env.CLAUDE_CODE_DEFAULT_CWD = params.cwd;
      env.PWD = params.cwd;
    }

    const options: Options = {
      model: params.model || process.env.CLAUDE_MODEL || DEFAULT_MODEL,
      allowedTools: params.allowedTools,
      disallowedTools: params.disallowedTools,
      hooks: this.buildHooksWithSystemPrompt(params.hooks, params.systemPrompt),
      permissionMode: params.permissionMode,
      cwd: params.cwd,
      env,
      // Chat session consumers depend on stream_event (text_delta) for incremental rendering.
      includePartialMessages: true,
      ...(params.permissionMode === "bypassPermissions"
        ? { allowDangerouslySkipPermissions: true }
        : {}),
    };

    return options;
  }

  private buildHooksWithSystemPrompt(
    hooks?: Partial<Record<HookEvent, HookCallbackMatcher[]>>,
    systemPrompt?: string,
  ): Partial<Record<HookEvent, HookCallbackMatcher[]>> | undefined {
    if (!systemPrompt) return hooks;
    return {
      ...hooks,
      SessionStart: [
        ...(hooks?.SessionStart || []),
        { hooks: [async () => ({ decision: "approve", systemPrompt })] },
      ],
    };
  }
}

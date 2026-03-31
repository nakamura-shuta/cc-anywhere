/**
 * V2SessionRuntime - SDKSession pool + SDK utilities
 *
 * ChatSessionService と SessionV2Service を統合。
 */

import {
  unstable_v2_createSession,
  unstable_v2_resumeSession,
  forkSession,
  getSessionInfo,
  getSessionMessages,
  listSessions,
  renameSession,
  tagSession,
  type SDKSession,
  type SDKSessionOptions,
  type SDKMessage,
  type SDKSessionInfo,
  type SessionMessage as SDKSessionMessage,
  type HookEvent,
  type HookCallbackMatcher,
  type PermissionMode,
} from "@anthropic-ai/claude-agent-sdk";
import type { SessionState } from "./types.js";

const DEFAULT_MODEL = "claude-opus-4-20250514";

export interface ManagedSession {
  session: SDKSession;
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

  // === SDKSession pool ===

  createSession(params: V2CreateParams): ManagedSession {
    const session = unstable_v2_createSession(this.buildOptions(params));
    return { session, sdkSessionId: null, state: "idle", lastActivityAt: new Date() };
  }

  resumeSession(sdkSessionId: string, params: V2CreateParams): ManagedSession {
    const session = unstable_v2_resumeSession(sdkSessionId, this.buildOptions(params));
    const managed: ManagedSession = { session, sdkSessionId, state: "idle", lastActivityAt: new Date() };
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
          // not yet available
        }
      }

      if (event.type === "system" && (event as any).subtype === "session_state_changed") {
        managed.state = (event as any).state;
        options?.onStateChanged?.((event as any).state);
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

  async fork(sdkSessionId: string, opts?: { upToMessageId?: string; title?: string }): Promise<{ sdkSessionId: string }> {
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

  private buildOptions(params: V2CreateParams): SDKSessionOptions {
    const options: SDKSessionOptions = {
      model: params.model || process.env.CLAUDE_MODEL || DEFAULT_MODEL,
      allowedTools: params.allowedTools,
      disallowedTools: params.disallowedTools,
      hooks: this.buildHooksWithSystemPrompt(params.hooks, params.systemPrompt),
      permissionMode: params.permissionMode,
    };

    const envOverrides: Record<string, string> = {
      CLAUDE_AGENT_SDK_CLIENT_APP: "cc-anywhere/1.0.0",
    };
    if (params.cwd) {
      envOverrides.CLAUDE_CODE_DEFAULT_CWD = params.cwd;
      envOverrides.PWD = params.cwd;
    }
    options.env = { ...process.env, ...envOverrides };

    // V2 SDKSessionOptions lacks cwd, pass via executableArgs
    if (params.cwd) {
      options.executableArgs = [...(options.executableArgs || []), "--cwd", params.cwd];
    }

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

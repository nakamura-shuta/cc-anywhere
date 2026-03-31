/**
 * ChatSessionService
 *
 * V2 Session API のライフサイクル管理。アプリケーション共有シングルトン。
 * SDKSession の create / resume / detach / terminate / fork を管理し、
 * pool で active セッションを追跡する。
 */

import {
  unstable_v2_createSession,
  unstable_v2_resumeSession,
  forkSession,
  type SDKSession,
  type SDKSessionOptions,
  type SDKMessage,
  type HookEvent,
  type HookCallbackMatcher,
  type PermissionMode,
} from "@anthropic-ai/claude-agent-sdk";
import { logger } from "../../utils/logger.js";

export type SessionState = "idle" | "running" | "requires_action";

export interface ManagedSession {
  session: SDKSession;
  sdkSessionId: string | null; // draft 時は null
  state: SessionState;
  lastActivityAt: Date;
}

export interface CreateSessionParams {
  model?: string;
  cwd?: string;
  systemPrompt?: string;
  permissionMode?: PermissionMode;
  allowedTools?: string[];
  disallowedTools?: string[];
  hooks?: Partial<Record<HookEvent, HookCallbackMatcher[]>>;
}

export interface ResumeSessionParams extends CreateSessionParams {
  // Inherits all from CreateSessionParams
}

export interface SendOptions {
  /** sdkSessionId 確定時。async 可（DB永続化を fire-and-forget にしないため） */
  onMaterialized?: (sdkSessionId: string) => void | Promise<void>;
  /** セッション状態変更時 */
  onStateChanged?: (state: SessionState) => void;
}

const DEFAULT_MODEL = "claude-opus-4-20250514";

export class ChatSessionService {
  private pool = new Map<string, ManagedSession>();

  /**
   * 新規 V2 セッション作成。sdkSessionId は未確定（draft）。
   */
  create(params: CreateSessionParams): ManagedSession {
    const options = this.buildSessionOptions(params);
    const session = unstable_v2_createSession(options);

    const managed: ManagedSession = {
      session,
      sdkSessionId: null,
      state: "idle",
      lastActivityAt: new Date(),
    };

    logger.debug("V2 session created (draft)", { state: "draft" });
    return managed;
  }

  /**
   * 既存セッションを再開。sdkSessionId は即確定。
   */
  resume(sdkSessionId: string, params: ResumeSessionParams): ManagedSession {
    const options = this.buildSessionOptions(params);
    const session = unstable_v2_resumeSession(sdkSessionId, options);

    const managed: ManagedSession = {
      session,
      sdkSessionId,
      state: "idle",
      lastActivityAt: new Date(),
    };

    this.pool.set(sdkSessionId, managed);
    logger.debug("V2 session resumed", { sdkSessionId });
    return managed;
  }

  /**
   * メッセージ送信 + ストリーミング。
   * draft セッションの場合、stream 中に sdkSessionId が確定し onMaterialized が呼ばれる。
   */
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
      // 全イベントで lastActivityAt を更新（TTL eviction の正確性のため）
      managed.lastActivityAt = new Date();

      // draft → materialized 遷移の検知
      if (!materialized) {
        try {
          const id = managed.session.sessionId;
          managed.sdkSessionId = id;
          materialized = true;
          this.pool.set(id, managed);
          // await: DB永続化を fire-and-forget にしない
          await options?.onMaterialized?.(id);
          logger.debug("V2 session materialized", { sdkSessionId: id });
        } catch {
          // まだ未確定、次のイベントで再試行
        }
      }

      // state 変更の検知
      if (
        event.type === "system" &&
        (event as any).subtype === "session_state_changed"
      ) {
        const newState = (event as any).state as SessionState;
        managed.state = newState;
        options?.onStateChanged?.(newState);
      }

      yield event;
    }

    // stream 完了 → idle
    managed.state = "idle";
    managed.lastActivityAt = new Date();
    options?.onStateChanged?.("idle");
  }

  /**
   * pool からの参照解除のみ。SDKSession は close しない。
   * WS 切断時に使用。resume 可能な状態を維持する。
   */
  detach(managed: ManagedSession): void {
    if (managed.sdkSessionId) {
      this.pool.delete(managed.sdkSessionId);
      logger.debug("V2 session detached", { sdkSessionId: managed.sdkSessionId });
    }
  }

  /**
   * SDKSession を完全に終了する。resume 不可になる。
   * ユーザーが明示的にセッション終了 API を呼んだ場合のみ使用。
   */
  terminate(managed: ManagedSession): void {
    managed.session.close();
    if (managed.sdkSessionId) {
      this.pool.delete(managed.sdkSessionId);
      logger.debug("V2 session terminated", { sdkSessionId: managed.sdkSessionId });
    }
  }

  /**
   * セッションフォーク
   */
  async fork(
    sdkSessionId: string,
    opts?: { upToMessageId?: string; title?: string },
  ): Promise<{ sdkSessionId: string }> {
    const result = await forkSession(sdkSessionId, opts);
    logger.debug("V2 session forked", {
      originalId: sdkSessionId,
      forkedId: result.sessionId,
    });
    return { sdkSessionId: result.sessionId };
  }

  /**
   * TTL eviction: 長時間 idle のセッションを terminate
   */
  evictIdle(maxIdleMs = 30 * 60 * 1000): number {
    const now = Date.now();
    let count = 0;
    for (const [id, m] of this.pool) {
      if (m.state === "idle" && now - m.lastActivityAt.getTime() > maxIdleMs) {
        m.session.close();
        this.pool.delete(id);
        count++;
        logger.debug("V2 session evicted (TTL)", { sdkSessionId: id });
      }
    }
    return count;
  }

  /**
   * 全セッション終了（シャットダウン時）
   */
  terminateAll(): void {
    for (const [, m] of this.pool) {
      m.session.close();
    }
    this.pool.clear();
    logger.debug("All V2 sessions terminated");
  }

  /**
   * sdkSessionId で pool 内のセッションを terminate する。
   * pool に存在しない場合は false を返す。
   */
  terminateById(sdkSessionId: string): boolean {
    const managed = this.pool.get(sdkSessionId);
    if (!managed) return false;
    this.terminate(managed);
    return true;
  }

  /**
   * pool サイズ取得（テスト・監視用）
   */
  getPoolSize(): number {
    return this.pool.size;
  }

  /**
   * SDKSessionOptions を構築
   */
  private buildSessionOptions(params: CreateSessionParams): SDKSessionOptions {
    const options: SDKSessionOptions = {
      model: params.model || process.env.CLAUDE_MODEL || DEFAULT_MODEL,
      allowedTools: params.allowedTools,
      disallowedTools: params.disallowedTools,
      hooks: this.buildHooksWithSystemPrompt(params.hooks, params.systemPrompt),
      permissionMode: params.permissionMode,
    };

    // V2 SDKSessionOptions には cwd がないため、env 経由で渡す
    if (params.cwd) {
      options.env = {
        ...process.env,
        CLAUDE_CODE_DEFAULT_CWD: params.cwd,
        PWD: params.cwd,
      };
    }

    return options;
  }

  /**
   * System prompt を SessionStart hook 経由で注入する。
   * V2 の SDKSessionOptions には customSystemPrompt がないため。
   */
  private buildHooksWithSystemPrompt(
    hooks?: Partial<Record<HookEvent, HookCallbackMatcher[]>>,
    systemPrompt?: string,
  ): Partial<Record<HookEvent, HookCallbackMatcher[]>> | undefined {
    if (!systemPrompt) return hooks;
    return {
      ...hooks,
      SessionStart: [
        ...(hooks?.SessionStart || []),
        {
          hooks: [async () => ({ decision: "approve", systemPrompt })],
        },
      ],
    };
  }
}

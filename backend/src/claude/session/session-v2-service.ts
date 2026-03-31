/**
 * Session V2 Service
 *
 * SDK のセッション管理ユーティリティ関数（getSessionInfo, listSessions 等）の
 * 薄いラッパー。REST API エンドポイントから利用する。
 */

import {
  getSessionInfo,
  getSessionMessages,
  listSessions,
  forkSession,
  renameSession,
  tagSession,
  type SDKSessionInfo,
  type SessionMessage,
} from "@anthropic-ai/claude-agent-sdk";
import { logger } from "../../utils/logger.js";

export class SessionV2Service {
  async getInfo(sdkSessionId: string): Promise<SDKSessionInfo | undefined> {
    return getSessionInfo(sdkSessionId);
  }

  async getMessages(sdkSessionId: string): Promise<SessionMessage[]> {
    return getSessionMessages(sdkSessionId);
  }

  async list(options?: { dir?: string }): Promise<SDKSessionInfo[]> {
    return listSessions(options);
  }

  async fork(
    sdkSessionId: string,
    opts?: { upToMessageId?: string; title?: string },
  ): Promise<{ sdkSessionId: string }> {
    const result = await forkSession(sdkSessionId, opts);
    logger.debug("Session forked via API", {
      originalId: sdkSessionId,
      forkedId: result.sessionId,
    });
    return { sdkSessionId: result.sessionId };
  }

  async rename(sdkSessionId: string, title: string): Promise<void> {
    await renameSession(sdkSessionId, title);
  }

  async tag(sdkSessionId: string, tag: string | null): Promise<void> {
    await tagSession(sdkSessionId, tag);
  }
}

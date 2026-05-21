/**
 * Session compatibility layer
 *
 * Provides an SDKSession-like API (send / stream / sessionId / close) on top of
 * the 0.3.x `query()` function. Used to migrate v2-session-runtime away from the
 * removed `unstable_v2_createSession` / `unstable_v2_resumeSession` APIs while
 * preserving the existing multi-turn session pool semantics.
 */

import {
  query,
  type Query,
  type SDKMessage,
  type SDKUserMessage,
  type Options,
} from "@anthropic-ai/claude-agent-sdk";

/**
 * Async iterable queue that feeds user messages to `query()` in streaming-input mode.
 * Stays open until close() is called.
 */
class UserMessageQueue implements AsyncIterable<SDKUserMessage> {
  private queue: SDKUserMessage[] = [];
  private resolvers: Array<(value: IteratorResult<SDKUserMessage>) => void> = [];
  private closed = false;

  push(msg: SDKUserMessage): void {
    if (this.closed) return;
    const next = this.resolvers.shift();
    if (next) {
      next({ value: msg, done: false });
    } else {
      this.queue.push(msg);
    }
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    const pending = this.resolvers.splice(0);
    for (const r of pending) {
      r({ value: undefined as unknown as SDKUserMessage, done: true });
    }
  }

  [Symbol.asyncIterator](): AsyncIterator<SDKUserMessage> {
    return {
      next: () => {
        const queued = this.queue.shift();
        if (queued !== undefined) {
          return Promise.resolve({ value: queued, done: false });
        }
        if (this.closed) {
          return Promise.resolve({ value: undefined as unknown as SDKUserMessage, done: true });
        }
        return new Promise<IteratorResult<SDKUserMessage>>((resolve) => {
          this.resolvers.push(resolve);
        });
      },
      return: () => {
        this.close();
        return Promise.resolve({ value: undefined as unknown as SDKUserMessage, done: true });
      },
    };
  }
}

/**
 * Multi-turn session wrapper.
 *
 * Each `stream()` invocation iterates the underlying Query until a `result`
 * message is emitted (end of turn). The same instance can be reused across turns
 * by calling `send()` again before the next `stream()`.
 */
export class CompatSession {
  private readonly inputQueue: UserMessageQueue;
  private readonly q: Query;
  private _sessionId: string | null;
  private _closed = false;

  constructor(params: { resumeSessionId?: string; queryOptions: Options }) {
    this.inputQueue = new UserMessageQueue();
    this._sessionId = params.resumeSessionId ?? null;
    this.q = query({
      prompt: this.inputQueue,
      options: {
        ...params.queryOptions,
        ...(params.resumeSessionId ? { resume: params.resumeSessionId } : {}),
      },
    });
  }

  /** SDK session ID. Throws until the first `system/init` event has been seen. */
  get sessionId(): string {
    if (!this._sessionId) {
      throw new Error(
        "Session ID not yet available — wait until the first system/init event is yielded",
      );
    }
    return this._sessionId;
  }

  /** Push a user prompt; the next `stream()` call yields the turn's events. */
  async send(text: string): Promise<void> {
    if (this._closed) throw new Error("CompatSession is closed");
    this.inputQueue.push({
      type: "user",
      message: { role: "user", content: text },
      parent_tool_use_id: null,
    });
  }

  /** Stream SDK messages for the current turn. Returns at the first `result` message. */
  async *stream(): AsyncGenerator<SDKMessage, void> {
    while (!this._closed) {
      const { value, done } = await this.q.next();
      if (done) return;

      if (value.type === "system" && value.subtype === "init") {
        this._sessionId = value.session_id;
      }

      yield value;

      if (value.type === "result") return;
    }
  }

  close(): void {
    if (this._closed) return;
    this._closed = true;
    this.inputQueue.close();
    try {
      this.q.close();
    } catch {
      // swallow — close should be idempotent and never throw
    }
  }

  /** Enable `await using` semantics. */
  async [Symbol.asyncDispose](): Promise<void> {
    this.close();
  }
}

/** Create a new session. */
export function createCompatSession(queryOptions: Options): CompatSession {
  return new CompatSession({ queryOptions });
}

/** Resume an existing session by ID. */
export function resumeCompatSession(sessionId: string, queryOptions: Options): CompatSession {
  return new CompatSession({ resumeSessionId: sessionId, queryOptions });
}

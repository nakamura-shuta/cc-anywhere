import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import {
  unstable_v2_createSession,
  unstable_v2_resumeSession,
} from "@anthropic-ai/claude-agent-sdk";
import type {
  ClaudeCodeStrategy,
  ExecutionMode,
  QueryOptions,
} from "./claude-code-strategy.interface";
import { logger } from "../../utils/logger";
import { withCwd } from "../../utils/cwd-mutex.js";

export class ApiKeyStrategy implements ClaudeCodeStrategy {
  constructor(private apiKey: string) {
    if (!apiKey) {
      throw new Error("API key is required for ApiKeyStrategy");
    }
  }

  async *executeQuery(options: QueryOptions): AsyncIterable<SDKMessage> {
    const originalApiKey = process.env.CLAUDE_API_KEY;
    const originalBedrockMode = process.env.CLAUDE_CODE_USE_BEDROCK;

    try {
      process.env.CLAUDE_API_KEY = this.apiKey;
      delete process.env.CLAUDE_CODE_USE_BEDROCK;

      logger.debug("Executing V2 session with API key strategy", {
        hasApiKey: !!this.apiKey,
        hasResume: !!options.options?.resume,
      });

      const sessionOptions = this.buildSessionOptions(options);

      // V2 SDKSessionOptions lacks cwd; use mutex-protected chdir
      const cwd = options.options?.cwd;

      // await using: session is auto-closed when scope exits (normal, error, break, abort)
      await using session = await withCwd(cwd, () =>
        options.options?.resume
          ? unstable_v2_resumeSession(options.options!.resume!, sessionOptions)
          : unstable_v2_createSession(sessionOptions),
      );

      const prompt = typeof options.prompt === "string" ? options.prompt : String(options.prompt);

      // Register abort listener to close session immediately on cancel/timeout
      const signal = options.abortController?.signal;
      const onAbort = () => { try { session.close(); } catch { /* ignore */ } };
      if (signal) {
        signal.addEventListener("abort", onAbort, { once: true });
      }

      try {
        if (signal?.aborted) {
          throw new DOMException("The operation was aborted", "AbortError");
        }

        await session.send(prompt);

        for await (const message of session.stream()) {
          if (signal?.aborted) {
            throw new DOMException("The operation was aborted", "AbortError");
          }
          yield message;
        }
      } finally {
        signal?.removeEventListener("abort", onAbort);
      }
      // session.close() is called automatically by await using when scope exits
    } finally {
      if (originalApiKey !== undefined) {
        process.env.CLAUDE_API_KEY = originalApiKey;
      } else {
        delete process.env.CLAUDE_API_KEY;
      }

      if (originalBedrockMode !== undefined) {
        process.env.CLAUDE_CODE_USE_BEDROCK = originalBedrockMode;
      }
    }
  }

  getModelName(): string {
    return process.env.CLAUDE_MODEL || "claude-opus-4-20250514";
  }

  isAvailable(): boolean {
    return !!this.apiKey;
  }

  getExecutionMode(): ExecutionMode {
    return "api-key";
  }

  private buildSessionOptions(options: QueryOptions) {
    const opts = options.options;
    const sessionOptions: any = {
      model: this.getModelName(),
      allowedTools: opts?.allowedTools,
      disallowedTools: opts?.disallowedTools,
      hooks: opts?.hooks,
      permissionMode: opts?.permissionMode,
      executable: opts?.executable,
      executableArgs: opts?.executableArgs,
    };

    const envOverrides: Record<string, string> = {
      CLAUDE_AGENT_SDK_CLIENT_APP: "cc-anywhere/1.0.0",
    };
    if (opts?.cwd) {
      envOverrides.CLAUDE_CODE_DEFAULT_CWD = opts.cwd;
      envOverrides.PWD = opts.cwd;
    }
    sessionOptions.env = { ...process.env, ...envOverrides };

    if (opts?.customSystemPrompt) {
      const systemPrompt = opts.customSystemPrompt;
      sessionOptions.hooks = {
        ...sessionOptions.hooks,
        SessionStart: [
          ...(sessionOptions.hooks?.SessionStart || []),
          { hooks: [async () => ({ decision: "approve" as const, systemPrompt })] },
        ],
      };
    }

    return sessionOptions;
  }
}

import { query, type SDKMessage, type Options } from "@anthropic-ai/claude-agent-sdk";
import type {
  ClaudeCodeStrategy,
  ExecutionMode,
  QueryOptions,
} from "./claude-code-strategy.interface";
import { logger } from "../../utils/logger";

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

      logger.debug("Executing query with API key strategy", {
        hasApiKey: !!this.apiKey,
        hasResume: !!options.options?.resume,
      });

      const prompt = typeof options.prompt === "string" ? options.prompt : options.prompt;
      const queryOptions = this.buildQueryOptions(options);

      const q = query({ prompt, options: queryOptions });

      const signal = options.abortController?.signal;
      const onAbort = () => {
        try {
          q.close();
        } catch {
          // ignore
        }
      };
      if (signal) {
        signal.addEventListener("abort", onAbort, { once: true });
      }

      const onContextUsage = options.options?.onContextUsage;
      const USAGE_THROTTLE_MS = 3000;
      let lastUsageAt = 0;

      try {
        if (signal?.aborted) {
          throw new DOMException("The operation was aborted", "AbortError");
        }

        for await (const message of q) {
          if (signal?.aborted) {
            throw new DOMException("The operation was aborted", "AbortError");
          }
          yield message;

          // Best-effort context usage poll (control method may not be available
          // in non-streaming mode; errors are swallowed).
          if (
            onContextUsage &&
            (message as { type?: string }).type === "assistant" &&
            Date.now() - lastUsageAt >= USAGE_THROTTLE_MS
          ) {
            lastUsageAt = Date.now();
            try {
              const usage = (await q.getContextUsage()) as unknown as Parameters<
                typeof onContextUsage
              >[0];
              await onContextUsage(usage);
            } catch {
              // control method not supported here; skip
            }
          }
        }
      } finally {
        signal?.removeEventListener("abort", onAbort);
        try {
          q.close();
        } catch {
          // idempotent — ignore
        }
      }
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
    return process.env.CLAUDE_MODEL || "claude-opus-4-7";
  }

  isAvailable(): boolean {
    return !!this.apiKey;
  }

  getExecutionMode(): ExecutionMode {
    return "api-key";
  }

  private buildQueryOptions(options: QueryOptions): Options {
    const opts = options.options;

    const env: Record<string, string> = {
      ...(Object.fromEntries(
        Object.entries(process.env).filter(([, v]) => v !== undefined),
      ) as Record<string, string>),
      CLAUDE_AGENT_SDK_CLIENT_APP: "cc-anywhere/1.0.0",
    };
    if (opts?.cwd) {
      env.CLAUDE_CODE_DEFAULT_CWD = opts.cwd;
      env.PWD = opts.cwd;
    }

    let hooks = opts?.hooks;
    if (opts?.customSystemPrompt) {
      const systemPrompt = opts.customSystemPrompt;
      hooks = {
        ...hooks,
        SessionStart: [
          ...(hooks?.SessionStart || []),
          { hooks: [async () => ({ decision: "approve" as const, systemPrompt })] },
        ],
      };
    }

    const queryOptions: Options = {
      model: this.getModelName(),
      allowedTools: opts?.allowedTools,
      disallowedTools: opts?.disallowedTools,
      hooks,
      permissionMode: opts?.permissionMode,
      executable: opts?.executable,
      executableArgs: opts?.executableArgs,
      cwd: opts?.cwd,
      env,
      abortController: options.abortController,
      ...(opts?.mcpServers ? { mcpServers: opts.mcpServers } : {}),
      ...(opts?.permissionMode === "bypassPermissions"
        ? { allowDangerouslySkipPermissions: true }
        : {}),
      ...(opts?.forwardSubagentText ? { forwardSubagentText: true } : {}),
      ...(opts?.agentProgressSummaries ? { agentProgressSummaries: true } : {}),
      ...(opts?.resume ? { resume: opts.resume } : {}),
    };

    return queryOptions;
  }
}

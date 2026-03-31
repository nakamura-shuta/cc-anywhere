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

      const session = options.options?.resume
        ? unstable_v2_resumeSession(options.options.resume, sessionOptions)
        : unstable_v2_createSession(sessionOptions);

      const prompt = typeof options.prompt === "string" ? options.prompt : String(options.prompt);
      await session.send(prompt);

      const signal = options.abortController?.signal;

      for await (const message of session.stream()) {
        // Respect abortController for timeout/cancel support
        if (signal?.aborted) {
          session.close();
          break;
        }
        yield message;
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
      // V2 SDKSessionOptions supports these
      executable: opts?.executable,
      executableArgs: opts?.executableArgs,
      // V2 SDKSessionOptions does NOT support:
      // - maxTurns (no equivalent; Claude Code manages turns internally)
      // - mcpServers (not in SDKSessionOptions; MCP configured at CLI level)
    };

    // Pass cwd via env (SDKSessionOptions lacks cwd parameter)
    if (opts?.cwd) {
      sessionOptions.env = {
        ...process.env,
        CLAUDE_CODE_DEFAULT_CWD: opts.cwd,
        PWD: opts.cwd,
      };
    }

    // Inject systemPrompt via SessionStart hook
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

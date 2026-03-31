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

      // Build V2 session options from QueryOptions
      const sessionOptions = {
        model: this.getModelName(),
        allowedTools: options.options?.allowedTools,
        disallowedTools: options.options?.disallowedTools,
        hooks: options.options?.hooks,
        permissionMode: options.options?.permissionMode as any,
        ...(options.options?.cwd ? {
          env: { ...process.env, CLAUDE_CODE_DEFAULT_CWD: options.options.cwd, PWD: options.options.cwd },
        } : {}),
      };

      // Inject systemPrompt via SessionStart hook
      if (options.options?.customSystemPrompt) {
        const systemPrompt = options.options.customSystemPrompt;
        sessionOptions.hooks = {
          ...sessionOptions.hooks,
          SessionStart: [
            ...(sessionOptions.hooks?.SessionStart || []),
            { hooks: [async () => ({ decision: "approve" as const, systemPrompt })] },
          ],
        };
      }

      // Create or resume session
      const session = options.options?.resume
        ? unstable_v2_resumeSession(options.options.resume, sessionOptions)
        : unstable_v2_createSession(sessionOptions);

      // Send prompt
      const prompt = typeof options.prompt === "string" ? options.prompt : String(options.prompt);
      await session.send(prompt);

      // Stream messages (same SDKMessage type as query())
      try {
        for await (const message of session.stream()) {
          yield message;
        }
      } finally {
        // Don't close session - allow resume later
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
}

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
import { BedrockRegionError, BedrockAuthError } from "../errors";

export class BedrockStrategy implements ClaudeCodeStrategy {
  constructor(
    private awsAccessKeyId: string,
    private awsSecretAccessKey: string,
    private awsRegion: string,
    private modelId?: string,
  ) {
    if (!awsAccessKeyId || !awsSecretAccessKey || !awsRegion) {
      throw new Error(
        "AWS credentials (access key, secret key, and region) are required for BedrockStrategy",
      );
    }

    if (awsRegion !== "us-east-1") {
      throw new BedrockRegionError(awsRegion);
    }
  }

  async *executeQuery(options: QueryOptions): AsyncIterable<SDKMessage> {
    const originalEnv = {
      CLAUDE_CODE_USE_BEDROCK: process.env.CLAUDE_CODE_USE_BEDROCK,
      AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
      AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
      AWS_REGION: process.env.AWS_REGION,
      CLAUDE_API_KEY: process.env.CLAUDE_API_KEY,
    };

    try {
      process.env.CLAUDE_CODE_USE_BEDROCK = "1";
      process.env.AWS_ACCESS_KEY_ID = this.awsAccessKeyId;
      process.env.AWS_SECRET_ACCESS_KEY = this.awsSecretAccessKey;
      process.env.AWS_REGION = this.awsRegion;
      delete process.env.CLAUDE_API_KEY;

      logger.debug("Executing V2 session with Bedrock strategy", {
        region: this.awsRegion,
        hasResume: !!options.options?.resume,
      });

      const opts = options.options;
      const sessionOptions: any = {
        model: this.getModelName(),
        allowedTools: opts?.allowedTools,
        disallowedTools: opts?.disallowedTools,
        hooks: opts?.hooks,
        permissionMode: opts?.permissionMode,
        executable: opts?.executable,
        executableArgs: opts?.executableArgs,
        env: {
          ...process.env,
          ...(opts?.cwd ? { CLAUDE_CODE_DEFAULT_CWD: opts.cwd, PWD: opts.cwd } : {}),
        },
      };

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

      const session = opts?.resume
        ? unstable_v2_resumeSession(opts.resume, sessionOptions)
        : unstable_v2_createSession(sessionOptions);

      const prompt = typeof options.prompt === "string" ? options.prompt : String(options.prompt);

      const signal = options.abortController?.signal;
      const onAbort = () => { try { session.close(); } catch { /* ignore */ } };
      if (signal) {
        if (signal.aborted) throw new DOMException("The operation was aborted", "AbortError");
        signal.addEventListener("abort", onAbort, { once: true });
      }

      try {
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
    } catch (error) {
      if (error instanceof Error) {
        if (
          error.message.includes("UnrecognizedClientException") ||
          error.message.includes("InvalidSignatureException")
        ) {
          throw new BedrockAuthError(
            "Invalid AWS credentials. Please check your access key and secret key.",
          );
        }
        if (error.message.includes("AccessDeniedException")) {
          throw new BedrockAuthError(
            "AWS credentials do not have permission to access Bedrock. Please check IAM policies.",
          );
        }
      }
      throw error;
    } finally {
      Object.entries(originalEnv).forEach(([key, value]) => {
        if (value !== undefined) {
          process.env[key] = value;
        } else {
          delete process.env[key];
        }
      });
    }
  }

  getModelName(): string {
    return this.modelId || "us.anthropic.claude-opus-4-20250514-v1:0";
  }

  isAvailable(): boolean {
    return !!(this.awsAccessKeyId && this.awsSecretAccessKey && this.awsRegion);
  }

  getExecutionMode(): ExecutionMode {
    return "bedrock";
  }
}

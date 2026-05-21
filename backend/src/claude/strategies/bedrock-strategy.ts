import { query, type SDKMessage, type Options } from "@anthropic-ai/claude-agent-sdk";
import type {
  ClaudeCodeStrategy,
  ExecutionMode,
  QueryOptions,
} from "./claude-code-strategy.interface";
import { logger } from "../../utils/logger";
import { BedrockRegionError, BedrockAuthError } from "../errors";

export class BedrockStrategy implements ClaudeCodeStrategy {
  /**
   * Access keys are optional. When BOTH are omitted, the AWS SDK default
   * credential chain (SSO, instance profile, AWS_PROFILE) is used. Supplying
   * only one of them is rejected — partial static credentials disable the
   * default chain in the AWS SDK and lead to confusing failures at request time.
   * Only AWS_REGION is required.
   */
  constructor(
    private awsAccessKeyId: string | undefined,
    private awsSecretAccessKey: string | undefined,
    private awsRegion: string,
    private modelId?: string,
  ) {
    if (!awsRegion) {
      throw new Error("AWS_REGION is required for BedrockStrategy");
    }
    if (awsRegion !== "us-east-1") {
      throw new BedrockRegionError(awsRegion);
    }
    if (!!awsAccessKeyId !== !!awsSecretAccessKey) {
      throw new Error(
        "Incomplete AWS credentials: supply BOTH access key and secret key, or neither (default credential chain).",
      );
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
      // Region is required; access keys are optional (default credential chain is used otherwise).
      process.env.AWS_REGION = this.awsRegion;
      if (this.awsAccessKeyId) {
        process.env.AWS_ACCESS_KEY_ID = this.awsAccessKeyId;
      }
      if (this.awsSecretAccessKey) {
        process.env.AWS_SECRET_ACCESS_KEY = this.awsSecretAccessKey;
      }
      delete process.env.CLAUDE_API_KEY;

      logger.debug("Executing query with Bedrock strategy", {
        region: this.awsRegion,
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
    return this.modelId || "us.anthropic.claude-opus-4-7";
  }

  isAvailable(): boolean {
    // Bedrock is available whenever a region is configured.
    // Explicit access keys OR the default credential chain (SSO / instance profile / AWS_PROFILE)
    // can supply credentials at runtime — we don't gate that here.
    return !!this.awsRegion;
  }

  getExecutionMode(): ExecutionMode {
    return "bedrock";
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

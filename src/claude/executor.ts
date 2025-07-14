import { ClaudeClient } from "./client";
import { ClaudeCodeClient } from "./claude-code-client";
import type {
  TaskRequest,
  TaskExecutor,
  ClaudeExecutionResult,
  TaskResponse,
  ClaudeCodeSDKOptions,
} from "./types";
import { logger } from "../utils/logger";
import { config } from "../config";
import { existsSync } from "fs";
import { resolve } from "path";
import { RetryHandler, type RetryHandlerOptions } from "../services/retry-handler";
import { TimeoutManager } from "../services/timeout-manager";
import { TimeoutPhase, TimeoutError, type TimeoutOptions } from "../types/timeout";
import { InstructionProcessor } from "../services/slash-commands/instruction-processor";
import { WorktreeManager } from "../services/worktree/worktree-manager";
import type { Worktree, WorktreeConfig } from "../services/worktree/types";
import { NotFoundError, TaskCancelledError, SystemError } from "../utils/errors";
import { mapPermissionMode } from "./permission-mode-mapper";

/**
 * Task execution engine that handles Claude API interactions
 *
 * This class is responsible for:
 * - Processing task requests with optional preprocessing (slash commands)
 * - Managing Git worktrees for isolated task execution
 * - Handling timeouts and cancellations
 * - Integrating with Claude API or Claude Code SDK
 * - Providing progress updates and log streaming
 */
export class TaskExecutorImpl implements TaskExecutor {
  private client: ClaudeClient;
  private codeClient: ClaudeCodeClient;
  private useClaudeCode: boolean;
  private runningTasks: Map<string, AbortController> = new Map();
  private retryHandler: RetryHandler;
  private instructionProcessor?: InstructionProcessor;
  private worktreeManager?: WorktreeManager;

  constructor(useClaudeCode = true) {
    this.client = new ClaudeClient();
    this.codeClient = new ClaudeCodeClient();
    this.useClaudeCode = useClaudeCode;
    this.retryHandler = new RetryHandler();

    // Initialize instruction processor
    this.instructionProcessor = new InstructionProcessor();

    // Initialize worktree manager if enabled
    if (config.worktree?.enabled) {
      const worktreeConfig: WorktreeConfig = {
        maxWorktrees: config.worktree.maxWorktrees,
        baseDirectory: config.worktree.basePath,
        autoCleanup: config.worktree.autoCleanup,
        cleanupDelay: config.worktree.cleanupDelay,
        worktreePrefix: config.worktree.prefix,
      };
      this.worktreeManager = new WorktreeManager(worktreeConfig);
    }
  }

  async execute(
    task: TaskRequest,
    taskId?: string,
    retryMetadata?: TaskResponse["retryMetadata"],
  ): Promise<ClaudeExecutionResult> {
    // If retry is configured, use retry handler
    if (task.options?.retry && (!retryMetadata || retryMetadata.currentAttempt === 0)) {
      const retryOptions: RetryHandlerOptions = {
        onRetryAttempt: async (attempt, error, delay) => {
          // Update retry metadata in database or queue
          logger.info(`Scheduling retry attempt ${attempt} after ${delay}ms`, {
            taskId,
            error: error.message,
          });
        },
      };

      return this.retryHandler.executeWithRetry(
        task,
        () => this.executeCore(task, taskId, retryMetadata),
        retryOptions,
      );
    }

    // Otherwise, execute directly
    return this.executeCore(task, taskId, retryMetadata);
  }

  /**
   * Core task execution logic
   *
   * Execution flow:
   * 1. Setup phase: Initialize timeout manager, abort controller, and logging
   * 2. Preprocessing: Apply slash commands if instruction processor is available
   * 3. Worktree setup: Create isolated Git worktree if requested
   * 4. Task execution: Run task via Claude API or Claude Code SDK
   * 5. Cleanup phase: Clean up worktree and resources
   *
   * @param task - The task request to execute
   * @param taskId - Optional task ID for tracking and cancellation
   * @param retryMetadata - Metadata from previous retry attempts
   * @returns Execution result with success status, output, logs, and duration
   * @throws TimeoutError when task exceeds configured timeout
   * @throws TaskCancelledError when task is cancelled via abort signal
   * @throws Error for other execution failures
   */
  private async executeCore(
    task: TaskRequest,
    taskId?: string,
    retryMetadata?: TaskResponse["retryMetadata"],
  ): Promise<ClaudeExecutionResult> {
    const startTime = Date.now();
    const logs: string[] = [];

    logs.push(`Task started: ${task.instruction}`);

    // Log retry information if this is a retry attempt
    if (retryMetadata && retryMetadata.currentAttempt > 0) {
      logs.push(`Retry attempt ${retryMetadata.currentAttempt} of ${retryMetadata.maxRetries}`);
    }
    logger.info("Executing task", { instruction: task.instruction, taskId });

    // Create AbortController for this task
    const abortController = new AbortController();

    // Register the task if taskId is provided
    if (taskId) {
      this.runningTasks.set(taskId, abortController);
    }

    // Set up timeout configuration
    let timeoutConfig: TimeoutOptions;
    if (typeof task.options?.timeout === "number") {
      // Legacy number timeout - use as total timeout
      timeoutConfig = { total: task.options.timeout };
    } else if (task.options?.timeout && typeof task.options.timeout === "object") {
      timeoutConfig = task.options.timeout;
    } else {
      timeoutConfig = { total: config.tasks.defaultTimeout };
    }

    // Create timeout manager
    const timeoutManager = new TimeoutManager(
      timeoutConfig,
      (warning) => {
        const message = `Task timeout warning: ${warning.remaining}ms remaining in ${warning.phase} phase`;
        logs.push(message);
        logger.warn(message, { taskId, warning });
      },
      (error) => {
        logs.push(`Task timed out: ${error.message}`);
        logger.error("Task timeout", { taskId, error: error.message });
        abortController.abort();
      },
    );

    // Track worktree for cleanup
    let createdWorktree: Worktree | null = null;

    try {
      // Process slash commands if enabled
      let processedTask = task;
      logger.info("Task processing started", {
        hasInstructionProcessor: !!this.instructionProcessor,
        originalOptions: task.options,
      });
      if (this.instructionProcessor) {
        const processed = await this.instructionProcessor.process(task.instruction, task.context);
        processedTask = {
          ...task,
          instruction: processed.instruction,
          context: { ...task.context, ...processed.context },
          options: task.options, // Preserve options including worktree settings
        };

        // Log if a command was processed
        if (processed.metadata?.originalCommand) {
          const commandInfo =
            processed.metadata.commandName || processed.metadata.ignoredCommand || "unknown";
          logs.push(`Processed slash command: ${commandInfo}`);
          logger.info("Slash command processed", {
            command: commandInfo,
            original: processed.metadata.originalCommand,
            reason: processed.metadata.reason,
          });
        }
      }

      // Handle worktree creation if enabled
      let workingDirectory = processedTask.context?.workingDirectory;
      const shouldUseWorktree = this.shouldUseWorktree(processedTask);

      logger.info("Worktree evaluation", {
        shouldUseWorktree,
        processedTaskOptions: processedTask.options,
        worktreeOptions: processedTask.options?.worktree,
        useWorktree: processedTask.options?.useWorktree,
      });

      if (shouldUseWorktree && taskId && workingDirectory) {
        logger.info("Worktree creation requested", { taskId, workingDirectory });

        // Create worktree
        const worktreeOptions = this.getWorktreeOptions(processedTask);
        logger.info("Creating worktree with options", {
          taskId,
          worktreeOptions,
          processedTaskOptions: processedTask.options,
        });
        createdWorktree = await this.createWorktree(
          taskId,
          workingDirectory,
          worktreeOptions,
          processedTask.options?.onProgress,
        );

        // Update working directory to worktree path
        workingDirectory = createdWorktree.path;
        logs.push(`Created worktree: ${createdWorktree.id} at ${createdWorktree.path}`);

        // Update processedTask context with new working directory
        processedTask = {
          ...processedTask,
          context: {
            ...processedTask.context,
            workingDirectory,
          },
        };
      }

      // Build the prompt
      const prompt = this.buildPrompt(processedTask);

      let output: unknown;

      if (this.useClaudeCode) {
        // Use Claude Code SDK
        try {
          // Transition to setup phase
          timeoutManager.transitionToPhase(TimeoutPhase.SETUP);

          // Notify progress: Starting task
          if (processedTask.options?.onProgress) {
            await processedTask.options.onProgress({
              type: "log",
              message: "タスク実行を開始します...",
            });
          }

          // Validate and set working directory if specified
          // Note: If worktree was created, processedTask.context.workingDirectory is already updated
          const resolvedWorkingDirectory = processedTask.context?.workingDirectory
            ? resolve(processedTask.context.workingDirectory)
            : undefined;

          if (resolvedWorkingDirectory) {
            // Check if directory exists
            if (!existsSync(resolvedWorkingDirectory)) {
              throw new NotFoundError(
                `Working directory does not exist: ${resolvedWorkingDirectory}`,
              );
            }

            logs.push(`Working directory: ${resolvedWorkingDirectory}`);
            logger.info("Using working directory", { cwd: resolvedWorkingDirectory });

            if (processedTask.options?.onProgress) {
              await processedTask.options.onProgress({
                type: "log",
                message: `作業ディレクトリ: ${resolvedWorkingDirectory}`,
              });
            }
          }

          // Transition to execution phase
          timeoutManager.transitionToPhase(TimeoutPhase.EXECUTION);

          // Notify progress: Execution phase
          if (processedTask.options?.onProgress) {
            await processedTask.options.onProgress({
              type: "log",
              message: "Claude Codeを実行中...",
            });
          }

          // SDKオプションの取得とマージ
          const sdkOptions = this.mergeSDKOptions(
            processedTask.options?.sdk,
            processedTask.options,
          );

          // SDKオプションの検証
          this.validateSDKOptions(sdkOptions);

          // 進捗コールバックを拡張して構造化されたログを処理
          const enhancedOnProgress = async (progress: {
            type: string;
            message: string;
            data?: any;
          }) => {
            // 元のコールバックに通常のログを送信
            if (processedTask.options?.onProgress) {
              await processedTask.options.onProgress({
                type: "log",
                message: progress.message,
              });
            }

            // 構造化されたデータがある場合は別途処理
            if (progress.data) {
              switch (progress.type) {
                case "tool_usage":
                  // TODO: WebSocket経由でツール使用情報を送信
                  break;
                case "progress":
                  // TODO: WebSocket経由で進捗情報を送信
                  break;
              }
            }
          };

          // Claude Code SDKの実行
          const result = await this.codeClient.executeTask(prompt, {
            maxTurns: sdkOptions.maxTurns,
            cwd: resolvedWorkingDirectory,
            abortController,
            allowedTools: sdkOptions.allowedTools,
            disallowedTools: sdkOptions.disallowedTools,
            systemPrompt: sdkOptions.systemPrompt,
            permissionMode: mapPermissionMode(sdkOptions.permissionMode),
            executable: sdkOptions.executable,
            executableArgs: sdkOptions.executableArgs,
            mcpConfig: sdkOptions.mcpConfig,
            continueSession: sdkOptions.continueSession,
            resumeSession: sdkOptions.resumeSession,
            outputFormat: sdkOptions.outputFormat,
            verbose: sdkOptions.verbose,
            onProgress: enhancedOnProgress,
          });

          if (!result.success) {
            throw result.error || new Error("Task execution failed");
          }

          // Generate task summary if tracker is available
          if (result.tracker) {
            const summary = result.tracker.generateSummary(result.success, output);

            // Send summary via progress callback
            if (processedTask.options?.onProgress) {
              await processedTask.options.onProgress({
                type: "summary",
                message: `タスク完了: ${summary.highlights.join(" / ")}`,
              });
            }

            // Add summary to logs
            logs.push(...summary.highlights);
          }

          // Process result based on output format
          const processedResult = this.processClaudeCodeResult(result, sdkOptions.outputFormat);

          output =
            sdkOptions.outputFormat === "json"
              ? processedResult.output
              : this.codeClient.formatMessagesAsString(result.messages);

          logs.push(`Received ${result.messages.length} messages from Claude Code`);
        } catch (error) {
          if (error instanceof Error && error.name === "AbortError") {
            // Check if this was a cancellation or timeout
            const wasCancelled = taskId && !this.runningTasks.has(taskId);
            if (wasCancelled) {
              throw new TaskCancelledError();
            }
            // TimeoutManager already logged the timeout details
            throw error instanceof TimeoutError ? error : new Error("Task execution timed out");
          }
          throw error;
        }
      } else {
        // Use regular Claude API
        const systemPrompt = this.getSystemPrompt();

        try {
          // Transition to execution phase (no setup needed for regular API)
          timeoutManager.transitionToPhase(TimeoutPhase.EXECUTION);

          // Execute with abort signal
          output = await this.executeWithAbortSignal(
            () => this.client.sendMessage(prompt, systemPrompt),
            abortController.signal,
          );
        } catch (error) {
          if (error instanceof Error && error.name === "AbortError") {
            // Check if this was a cancellation or timeout
            const wasCancelled = taskId && !this.runningTasks.has(taskId);
            if (wasCancelled) {
              throw new TaskCancelledError();
            }
            // TimeoutManager already logged the timeout details
            throw error instanceof TimeoutError ? error : new Error("Task execution timed out");
          }
          throw error;
        }
      }

      // Transition to cleanup phase
      timeoutManager.transitionToPhase(TimeoutPhase.CLEANUP);

      // Notify progress: Completion
      if (task.options?.onProgress) {
        await task.options.onProgress({
          type: "log",
          message: "タスクが正常に完了しました",
        });
      }

      logs.push("Task completed successfully");
      logger.info("Task completed", {
        instruction: task.instruction,
        duration: Date.now() - startTime,
        usedClaudeCode: this.useClaudeCode,
      });

      // Clean up
      timeoutManager.dispose();
      if (taskId) {
        this.runningTasks.delete(taskId);
      }

      // Clean up worktree if needed
      if (createdWorktree) {
        const shouldCleanup = this.shouldCleanupWorktree(processedTask);
        logger.info("Worktree cleanup decision", {
          worktreeId: createdWorktree.id,
          shouldCleanup,
          keepAfterCompletion: processedTask.options?.worktree?.keepAfterCompletion,
        });

        if (shouldCleanup) {
          await this.cleanupWorktree(createdWorktree, processedTask.options?.onProgress);
        }
      }

      return {
        success: true,
        output,
        logs,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logs.push(`Task failed: ${errorMessage}`);

      logger.error("Task execution failed", {
        instruction: task.instruction,
        error,
        duration: Date.now() - startTime,
      });

      // Clean up
      timeoutManager.dispose();
      if (taskId) {
        this.runningTasks.delete(taskId);
      }

      // Clean up worktree even on error
      if (createdWorktree && this.shouldCleanupWorktree(task)) {
        try {
          await this.cleanupWorktree(createdWorktree, task.options?.onProgress);
        } catch (cleanupError) {
          logger.error("Failed to cleanup worktree after error", { cleanupError });
        }
      }

      return {
        success: false,
        error: error instanceof Error ? error : new Error(errorMessage),
        logs,
        duration: Date.now() - startTime,
      };
    }
  }

  async cancel(taskId: string): Promise<void> {
    logger.info("Task cancellation requested", { taskId });

    const abortController = this.runningTasks.get(taskId);
    if (abortController) {
      // Abort the task execution
      abortController.abort();

      // Remove from running tasks map
      this.runningTasks.delete(taskId);

      logger.info("Task cancelled successfully", { taskId });
    } else {
      logger.warn("Task not found in running tasks", { taskId });
    }
  }

  private async executeWithAbortSignal<T>(fn: () => Promise<T>, signal: AbortSignal): Promise<T> {
    // Handle abort signal
    const abortError = new Error("Task execution aborted");
    abortError.name = "AbortError";

    const abortHandler = () => {
      throw abortError;
    };

    if (signal.aborted) {
      abortHandler();
    }

    signal.addEventListener("abort", abortHandler);

    try {
      const result = await fn();
      signal.removeEventListener("abort", abortHandler);
      return result;
    } catch (error) {
      signal.removeEventListener("abort", abortHandler);
      throw error;
    }
  }

  private buildPrompt(task: TaskRequest): string {
    let prompt = task.instruction;

    // Claude Code SDKはcwdオプションで作業ディレクトリを自動的に設定するため、
    // 通常のClaude APIの場合のみコンテキストに追加
    if (!this.useClaudeCode && task.context) {
      prompt += "\n\nContext:";

      if (task.context.workingDirectory) {
        prompt += `\nWorking directory: ${task.context.workingDirectory}`;
      }

      if (task.context.files && task.context.files.length > 0) {
        prompt += `\nFiles: ${task.context.files.join(", ")}`;
      }
    }

    return prompt;
  }

  private getSystemPrompt(): string {
    return `You are a helpful AI assistant integrated into a development environment. 
You help users with various programming and development tasks. 
Provide clear, concise, and accurate responses. 
When providing code, ensure it follows best practices and is well-documented.`;
  }

  /**
   * Check if worktree should be used for this task
   */
  private shouldUseWorktree(task: TaskRequest): boolean {
    // Check if worktree is globally enabled
    if (!config.worktree?.enabled || !this.worktreeManager) {
      return false;
    }

    // Check if task explicitly enables worktree
    if (task.options?.useWorktree) {
      return true;
    }

    // Check if task has detailed worktree configuration
    if (task.options?.worktree?.enabled) {
      return true;
    }

    return false;
  }

  /**
   * Get worktree options from task
   */
  private getWorktreeOptions(task: TaskRequest) {
    // If detailed worktree options are provided, use them
    if (task.options?.worktree) {
      logger.info("Using provided worktree options", {
        options: task.options.worktree,
        keepAfterCompletion: task.options.worktree.keepAfterCompletion,
      });
      return task.options.worktree;
    }

    // Otherwise return default options
    const defaultOptions = {
      enabled: true,
      keepAfterCompletion: false,
      autoCommit: false,
      autoMerge: false,
    };
    logger.info("Using default worktree options", { options: defaultOptions });
    return defaultOptions;
  }

  /**
   * Create worktree for task execution
   */
  private async createWorktree(
    taskId: string,
    workingDirectory: string,
    options: {
      enabled: boolean;
      baseBranch?: string;
      branchName?: string;
      keepAfterCompletion?: boolean;
      autoCommit?: boolean;
      commitMessage?: string;
      autoMerge?: boolean;
      mergeStrategy?: "merge" | "rebase" | "squash";
      targetBranch?: string;
    },
    onProgress?: (progress: { type: string; message: string }) => void | Promise<void>,
  ): Promise<Worktree> {
    if (!this.worktreeManager) {
      throw new SystemError("Worktree manager not initialized", {
        worktreeEnabled: config.worktree?.enabled,
      });
    }

    // Notify progress
    if (onProgress) {
      await onProgress({
        type: "log",
        message: "Worktreeを作成中...",
      });
    }

    try {
      const worktree = await this.worktreeManager.createWorktree({
        taskId,
        repositoryPath: workingDirectory,
        baseBranch: options.baseBranch || config.worktree?.defaultBaseBranch,
        branchName: options.branchName,
      });

      // Check worktree health
      const isHealthy = await this.worktreeManager.isWorktreeHealthy(worktree);
      if (!isHealthy) {
        throw new SystemError("Worktree is not healthy", {
          worktreeId: worktree.id,
          worktreePath: worktree.path,
        });
      }

      if (onProgress) {
        await onProgress({
          type: "log",
          message: `Worktree作成完了: ${worktree.branch} (${worktree.path})`,
        });
      }

      return worktree;
    } catch (error) {
      logger.error("Failed to create worktree", { error, taskId });
      throw error;
    }
  }

  /**
   * Check if worktree should be cleaned up
   */
  private shouldCleanupWorktree(task: TaskRequest): boolean {
    // If task explicitly wants to keep worktree, don't cleanup
    if (task.options?.worktree?.keepAfterCompletion) {
      logger.info("Worktree will be kept due to keepAfterCompletion flag", {
        keepAfterCompletion: task.options.worktree.keepAfterCompletion,
      });
      return false;
    }

    // If global auto cleanup is disabled, don't cleanup
    if (config.worktree?.autoCleanup === false) {
      logger.info("Worktree will be kept due to global autoCleanup setting", {
        autoCleanup: config.worktree.autoCleanup,
      });
      return false;
    }

    logger.info("Worktree will be cleaned up", {
      keepAfterCompletion: task.options?.worktree?.keepAfterCompletion,
      autoCleanup: config.worktree?.autoCleanup,
    });
    return true;
  }

  /**
   * Clean up worktree after task completion
   */
  private async cleanupWorktree(
    worktree: Worktree,
    onProgress?: (progress: { type: string; message: string }) => void | Promise<void>,
  ): Promise<void> {
    if (!this.worktreeManager) {
      return;
    }

    // Schedule cleanup with delay
    const cleanupDelay = config.worktree?.cleanupDelay || 0;

    if (cleanupDelay > 0) {
      // Schedule for later
      setTimeout(() => {
        void (async () => {
          try {
            await this.worktreeManager!.removeWorktree(worktree.id, {
              force: false,
              saveUncommitted: true,
            });
            logger.info("Worktree cleaned up", { worktreeId: worktree.id });
          } catch (error) {
            logger.error("Failed to cleanup worktree", { error, worktreeId: worktree.id });
          }
        })();
      }, cleanupDelay);

      if (onProgress) {
        await onProgress({
          type: "log",
          message: `Worktreeのクリーンアップを${cleanupDelay / 1000}秒後に予定しました`,
        });
      }
    } else {
      // Clean up immediately
      if (onProgress) {
        await onProgress({
          type: "log",
          message: "Worktreeをクリーンアップ中...",
        });
      }

      await this.worktreeManager.removeWorktree(worktree.id, {
        force: false,
        saveUncommitted: true,
      });

      if (onProgress) {
        await onProgress({
          type: "log",
          message: "Worktreeのクリーンアップが完了しました",
        });
      }
    }
  }

  /**
   * Merge SDK options with defaults and legacy options
   */
  private mergeSDKOptions(
    sdkOptions?: ClaudeCodeSDKOptions,
    legacyOptions?: TaskRequest["options"],
  ): Required<ClaudeCodeSDKOptions> {
    const defaultConfig = config.claudeCodeSDK || {};

    return {
      // Priority: High
      maxTurns: sdkOptions?.maxTurns ?? defaultConfig.defaultMaxTurns ?? 3,
      allowedTools: sdkOptions?.allowedTools ?? legacyOptions?.allowedTools ?? [],
      disallowedTools: sdkOptions?.disallowedTools ?? [],
      systemPrompt: sdkOptions?.systemPrompt ?? "",
      permissionMode: sdkOptions?.permissionMode ?? "ask",

      // Priority: Medium
      executable: sdkOptions?.executable ?? "node",
      executableArgs: sdkOptions?.executableArgs ?? [],
      mcpConfig: sdkOptions?.mcpConfig ?? {},
      continueSession: sdkOptions?.continueSession ?? false,
      resumeSession: sdkOptions?.resumeSession ?? "",
      outputFormat: sdkOptions?.outputFormat ?? "text",

      // Priority: Low
      verbose: sdkOptions?.verbose ?? false,
      permissionPromptTool: sdkOptions?.permissionPromptTool ?? "",
      pathToClaudeCodeExecutable: sdkOptions?.pathToClaudeCodeExecutable ?? "",
    };
  }

  /**
   * Validate SDK options
   */
  private validateSDKOptions(options: ClaudeCodeSDKOptions): void {
    // Validate maxTurns
    if (options.maxTurns !== undefined) {
      if (options.maxTurns < 1 || options.maxTurns > 50) {
        throw new Error("maxTurns must be between 1 and 50");
      }
    }

    // Validate systemPrompt length
    if (options.systemPrompt !== undefined) {
      if (options.systemPrompt.length > 10000) {
        throw new Error("systemPrompt must be 10000 characters or less");
      }
    }

    // Warn about conflicting tool restrictions
    if (options.allowedTools?.length && options.disallowedTools?.length) {
      logger.warn("Both allowedTools and disallowedTools specified");
    }

    // Validate MCP config
    if (options.mcpConfig) {
      this.validateMCPConfig(options.mcpConfig);
    }
  }

  /**
   * Validate MCP configuration
   */
  private validateMCPConfig(mcpConfig: Record<string, any>): void {
    for (const [name, config] of Object.entries(mcpConfig)) {
      if (!config.command) {
        throw new Error(`MCP server '${name}' is missing required 'command' field`);
      }
      if (typeof config.command !== "string") {
        throw new Error(`MCP server '${name}' command must be a string`);
      }
    }
  }

  /**
   * Process Claude Code result based on output format
   */
  private processClaudeCodeResult(result: any, outputFormat?: string): any {
    if (outputFormat === "json" && typeof result.output === "string") {
      try {
        return {
          ...result,
          output: JSON.parse(result.output),
        };
      } catch {
        // If JSON parsing fails, return as-is
        return result;
      }
    }
    return result;
  }
}

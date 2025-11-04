import PQueue from "p-queue";
import { v4 as uuidv4 } from "uuid";
import type { TaskRequest } from "../claude/types";
import { TaskStatus } from "../claude/types";
import type { QueuedTask, QueueOptions, QueueStats, TaskQueue } from "./types";
import { TaskExecutorImpl } from "../claude/executor";
import type { CodexTaskExecutorAdapter } from "../agents/codex-task-executor-adapter.js";
import { logger } from "../utils/logger";
import { config } from "../config";
import { getSharedRepository } from "../db/shared-instance";
import type { TaskRepositoryAdapter } from "../repositories/task-repository-adapter";
import { RetryService } from "../services/retry-service";
import type { WebSocketServer } from "../websocket/websocket-server.js";
import { WebSocketBroadcaster } from "../websocket/websocket-broadcaster.js";
import { getTypedEventBus, type TypedEventBus } from "../events";
import { fileWatcherService } from "../services/file-watcher.service.js";
import { PathValidator, PathValidationError } from "../utils/path-validator.js";

export { TaskQueue };

export class TaskQueueImpl implements TaskQueue {
  private queue: PQueue;
  private tasks: Map<string, QueuedTask> = new Map();
  private executor: TaskExecutorImpl;
  private codexExecutor: CodexTaskExecutorAdapter | null = null;
  private completedCount = 0;
  private failedCount = 0;
  private repository: TaskRepositoryAdapter;
  private wsServer?: WebSocketServer;
  private broadcaster?: WebSocketBroadcaster;
  private eventBus: TypedEventBus;

  // Legacy event handlers (deprecated - will be removed)
  private onCompleteHandlers: Array<(task: QueuedTask) => void> = [];
  private onErrorHandlers: Array<(task: QueuedTask, error: Error) => void> = [];

  // Memory management
  private taskRetentionTime: number;
  private cleanupEnabled: boolean;
  private cleanupTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(options: QueueOptions = {}) {
    // Build queue options dynamically to avoid read-only property issues
    const queueOptions: ConstructorParameters<typeof PQueue>[0] = {
      concurrency: options.concurrency || 1,
      autoStart: options.autoStart !== false,
    };

    // Only add optional properties if they are defined
    if (options.timeout !== undefined) {
      Object.assign(queueOptions, { timeout: options.timeout });
    }
    if (options.interval !== undefined) {
      Object.assign(queueOptions, { interval: options.interval });
    }
    if (options.intervalCap !== undefined) {
      Object.assign(queueOptions, { intervalCap: options.intervalCap });
    }

    this.queue = new PQueue(queueOptions);

    this.executor = new TaskExecutorImpl();
    // codexExecutor will be lazy-loaded when needed
    // Use shared repository instance
    this.repository = getSharedRepository();
    this.eventBus = getTypedEventBus(); // Initialize event bus

    // Initialize memory management settings
    this.taskRetentionTime = options.taskRetentionTime ?? config.queue.taskRetentionTime;
    this.cleanupEnabled = options.cleanupEnabled ?? config.queue.cleanupEnabled;

    // Restore pending tasks from database
    this.restorePendingTasks();

    logger.info("Task queue initialized", {
      concurrency: this.queue.concurrency,
      autoStart: options.autoStart !== false,
      taskRetentionTime: this.taskRetentionTime,
      cleanupEnabled: this.cleanupEnabled,
    });
  }

  /**
   * Lazy-load Codex executor only when needed
   */
  private async getCodexExecutor(): Promise<CodexTaskExecutorAdapter> {
    if (!this.codexExecutor) {
      logger.debug("Lazy-loading Codex executor");
      const { CodexTaskExecutorAdapter } = await import("../agents/codex-task-executor-adapter.js");
      this.codexExecutor = new CodexTaskExecutorAdapter();
    }
    return this.codexExecutor;
  }

  /**
   * Schedule task cleanup after retention time
   * @param taskId Task ID to schedule for cleanup
   */
  private scheduleTaskCleanup(taskId: string): void {
    if (!this.cleanupEnabled) {
      return;
    }

    // Clear existing timer if any
    const existingTimer = this.cleanupTimers.get(taskId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Schedule new cleanup
    const timer = setTimeout(() => {
      const task = this.tasks.get(taskId);
      if (
        task &&
        (task.status === TaskStatus.COMPLETED ||
          task.status === TaskStatus.FAILED ||
          task.status === TaskStatus.CANCELLED)
      ) {
        this.tasks.delete(taskId);
        this.cleanupTimers.delete(taskId);
        logger.debug("Task removed from memory after retention period", {
          taskId,
          status: task.status,
          retentionTime: this.taskRetentionTime,
        });
      }
    }, this.taskRetentionTime);

    this.cleanupTimers.set(taskId, timer);
  }

  add(
    request: TaskRequest,
    priority = 0,
    metadata?: { groupId?: string; repositoryName?: string },
  ): string {
    const taskId = uuidv4();

    // Initialize retry metadata if retry is configured
    const retryConfig = RetryService.getRetryOptions(request.options);
    const retryMetadata = retryConfig.maxRetries
      ? RetryService.createInitialRetryMetadata(retryConfig)
      : undefined;
    const queuedTask: QueuedTask = {
      id: taskId,
      request,
      priority,
      addedAt: new Date(),
      status: TaskStatus.PENDING,
      retryMetadata,
    };

    this.tasks.set(taskId, queuedTask);

    // Persist task to database
    try {
      // Extract continuedFrom from SDK options if present
      const continuedFrom = request.options?.sdk?.continueFromTaskId;

      this.repository.create({
        id: taskId,
        instruction: request.instruction,
        context: request.context,
        options: request.options,
        priority,
        status: TaskStatus.PENDING,
        retryMetadata,
        groupId: metadata?.groupId,
        repositoryName: metadata?.repositoryName,
        continuedFrom: continuedFrom || undefined,
      });
    } catch (error) {
      logger.error("Failed to persist task", { taskId, error });
    }

    // Emit task created event
    void this.eventBus.emit("task.created", {
      taskId,
      request,
      priority,
      createdAt: queuedTask.addedAt,
    });

    // Add task to queue with priority
    void this.queue.add(
      async () => {
        await this.executeTask(queuedTask);
      },
      { priority },
    );

    logger.info("Task added to queue", {
      taskId,
      instruction: request.instruction,
      priority,
      queueSize: this.queue.size,
    });

    return taskId;
  }

  private async executeTask(task: QueuedTask): Promise<void> {
    try {
      // Update task status
      task.status = TaskStatus.RUNNING;
      task.startedAt = new Date();

      // Update status in database
      try {
        this.repository.updateStatus(task.id, TaskStatus.RUNNING);
      } catch (error) {
        logger.error("Failed to update task status in database", { error });
      }

      logger.info("Task execution started", {
        instruction: task.request.instruction,
        currentAttempt: task.retryMetadata?.currentAttempt ?? 0,
      });

      // Emit task started event
      void this.eventBus.emit("task.started", {
        taskId: task.id,
        startedAt: task.startedAt,
      });

      // Start watching working directory if specified
      const workingDirectory = task.request.context?.workingDirectory;
      if (workingDirectory) {
        try {
          // 🆕 パス検証を追加
          const validatedPath = await PathValidator.validateWorkingDirectory(workingDirectory);

          logger.debug("Starting file watcher for task working directory", {
            taskId: task.id,
            originalPath: workingDirectory,
            validatedPath,
          });

          await fileWatcherService.watchRepository(validatedPath);
        } catch (error) {
          // 🆕 PathValidationError を特別に処理
          if (error instanceof PathValidationError) {
            logger.error("Path validation failed for working directory", {
              taskId: task.id,
              workingDirectory,
              code: error.code,
              error: error.message,
            });

            // タスクを失敗させる（セキュリティ理由）
            task.status = TaskStatus.FAILED;
            task.error = error;
            task.completedAt = new Date();
            this.failedCount++;

            // Update status in database
            try {
              this.repository.updateStatus(task.id, TaskStatus.FAILED, error);
            } catch (dbError) {
              logger.error("Failed to update task status in database", {
                error: dbError,
              });
            }

            // Emit task failed event
            void this.eventBus.emit("task.failed", {
              taskId: task.id,
              error: {
                message: error.message,
                code: error.code,
              },
              failedAt: task.completedAt,
              willRetry: false,
              retryCount: 0,
            });

            // Notify error handlers
            this.onErrorHandlers.forEach((handler) => {
              try {
                handler(task, error);
              } catch (handlerError) {
                logger.error("Error in error handler", { error: handlerError });
              }
            });

            // Schedule task cleanup from memory
            this.scheduleTaskCleanup(task.id);

            return;
          }

          logger.error("Failed to start file watcher for working directory", {
            taskId: task.id,
            workingDirectory,
            error,
          });
        }
      }

      // Initialize progress data for this task
      const progressData = {
        currentTurn: 0,
        maxTurns: undefined as number | undefined,
        toolUsageCount: {} as Record<string, number>,
        statistics: {
          totalToolCalls: 0,
          processedFiles: 0,
          createdFiles: 0,
          modifiedFiles: 0,
          totalExecutions: 0,
          tokenUsage: undefined as { input: number; output: number; cached?: number } | undefined,
        },
        todos: [] as any[],
        // 詳細な実行履歴
        toolExecutions: [] as any[],
        claudeResponses: [] as any[],
        logs: [] as string[],
      };

      // Set up progress handler for WebSocket log streaming
      const requestWithProgress = {
        ...task.request,
        options: {
          ...task.request.options,
          onProgress: this.wsServer
            ? async (progress: { type: string; message: string; data?: any }) => {
                const timestamp = new Date().toISOString();

                // すべてのメッセージをログとして保存（WebSocketと同じ形式）
                let logMessage = "";

                switch (progress.type) {
                  case "log":
                    logger.debug("Sending progress log via WebSocket", {
                      message: progress.message,
                    });
                    logMessage = progress.message;
                    this.broadcaster?.task(task.id, "task:log", {
                      log: progress.message,
                      timestamp,
                      level: "info",
                    });
                    break;

                  case "tool_usage":
                    if (progress.data) {
                      // ログメッセージをフォーマット（レガシー形式）
                      const toolStatus =
                        progress.data.status === "success"
                          ? "✓"
                          : progress.data.status === "failure"
                            ? "✗"
                            : "⚡";
                      logMessage = `[${progress.data.tool}] ${toolStatus} ${progress.data.status === "start" ? "開始" : progress.data.status === "success" ? "成功" : "失敗"}`;
                      if (progress.data.filePath) logMessage += `: ${progress.data.filePath}`;
                      else if (progress.data.command) logMessage += `: ${progress.data.command}`;
                      else if (progress.data.pattern) logMessage += `: ${progress.data.pattern}`;

                      this.broadcaster?.task(task.id, "task:tool_usage", {
                        tool: {
                          ...progress.data,
                          timestamp: progress.data.timestamp?.toISOString() || timestamp,
                        },
                      });
                    }
                    break;

                  case "progress":
                    if (progress.data) {
                      // プログレスメッセージはログに含めない（進捗バー表示用）
                      this.broadcaster?.task(task.id, "task:progress", {
                        progress: {
                          ...progress.data,
                          timestamp: progress.data.timestamp?.toISOString() || timestamp,
                        },
                      });
                    }
                    break;

                  case "summary":
                    if (progress.data) {
                      // サマリーメッセージもログに含めない（別UI表示用）
                      this.broadcaster?.task(task.id, "task:summary", {
                        summary: progress.data,
                      });
                    }
                    break;
                  case "todo_update":
                    if (progress.data && progress.data.todos) {
                      // 実行中のタスクのTODOを一時的に保存
                      task.todos = progress.data.todos;
                      progressData.todos = progress.data.todos;

                      // ログメッセージをフォーマット（タイムスタンプ付き）
                      const todoList = progress.data.todos
                        .map((t: any) => `  • ${t.content} [${t.status}]`)
                        .join("\n");
                      logMessage = `📝 TODO更新\n${todoList}\n${new Date(timestamp).toLocaleString("ja-JP")}`;

                      // Save progress data to database
                      try {
                        this.repository.updateProgressData(task.id, progressData);
                      } catch (error) {
                        logger.error("Failed to update progress data", { error });
                      }

                      // Broadcast todo update via WebSocket
                      if (this.wsServer) {
                        this.broadcaster?.task(task.id, "task:todo_update", {
                          todos: progress.data.todos,
                        });
                      } else {
                        logger.warn("WebSocket server not available for todo update");
                      }
                    } else {
                      logger.warn("todo_update progress missing todos data", {
                        data: progress.data,
                      });
                    }
                    break;

                  case "tool:start":
                    if (progress.data) {
                      // Update tool usage count
                      const toolName = progress.data.tool;
                      if (toolName) {
                        progressData.toolUsageCount[toolName] =
                          (progressData.toolUsageCount[toolName] || 0) + 1;
                      }

                      // ツール実行履歴を保存
                      progressData.toolExecutions.push({
                        type: "start",
                        tool: progress.data.tool,
                        timestamp,
                        args: progress.data.input,
                      });

                      // ログメッセージをフォーマット（タイムスタンプ付き）
                      // Use formatted input if available, otherwise fall back to raw input
                      let displayInput = "";
                      if (progress.data.formattedInput) {
                        // For TodoWrite with multiple lines, add proper indentation
                        if (
                          progress.data.tool === "TodoWrite" &&
                          progress.data.formattedInput.includes("\n")
                        ) {
                          displayInput = "\n" + progress.data.formattedInput;
                        } else {
                          displayInput = progress.data.formattedInput
                            ? `: ${progress.data.formattedInput}`
                            : "";
                        }
                      } else if (progress.data.input) {
                        // Fallback to raw input with truncation
                        displayInput = `: ${JSON.stringify(progress.data.input).slice(0, 100)}...`;
                      }

                      logMessage = `${progress.data.tool}\n${new Date(timestamp).toLocaleString("ja-JP")}${displayInput}`;

                      // Save progress data to database
                      try {
                        this.repository.updateProgressData(task.id, progressData);
                      } catch (error) {
                        logger.error("Failed to update progress data", {
                          error,
                        });
                      }

                      this.broadcaster?.task(task.id, "task:tool:start", {
                        toolId: progress.data.toolId || `${progress.data.tool}-${Date.now()}`,
                        tool: progress.data.tool,
                        input: progress.data.input,
                        formattedInput: progress.data.formattedInput, // Add formatted input
                        timestamp,
                      });
                    }
                    break;

                  case "tool:end":
                    if (progress.data) {
                      // ツール実行履歴を保存
                      progressData.toolExecutions.push({
                        type: "end",
                        tool: progress.data.tool,
                        timestamp,
                        output: progress.data.output,
                        error: progress.data.error,
                        duration: progress.data.duration,
                        success: progress.data.success,
                      });

                      // ログメッセージをフォーマット（タイムスタンプ付き）
                      const status = progress.data.success ? "✅ 完了" : "❌ 失敗";
                      const duration = progress.data.duration
                        ? `\n実行時間: ${progress.data.duration}ms`
                        : "";
                      logMessage = `${status}\n${progress.data.tool}${duration}\n${new Date(timestamp).toLocaleString("ja-JP")}`;

                      // Save progress data to database
                      try {
                        this.repository.updateProgressData(task.id, progressData);
                      } catch (error) {
                        logger.error("Failed to update progress data", {
                          error,
                        });
                      }

                      this.broadcaster?.task(task.id, "task:tool:end", {
                        toolId: progress.data.toolId,
                        tool: progress.data.tool,
                        output: progress.data.output,
                        error: progress.data.error,
                        duration: progress.data.duration,
                        success: progress.data.success,
                        timestamp,
                      });
                    }
                    break;

                  case "claude:response":
                    if (progress.data) {
                      // Update progress data
                      progressData.currentTurn = progress.data.turnNumber || 1;
                      progressData.maxTurns = progress.data.maxTurns || progressData.maxTurns;

                      // Claude応答履歴を保存
                      progressData.claudeResponses.push({
                        text: progress.message,
                        turnNumber: progress.data.turnNumber || 1,
                        maxTurns: progress.data.maxTurns,
                        timestamp,
                      });

                      // ログメッセージをフォーマット（ターン情報とタイムスタンプ付き）
                      const turnInfo =
                        progress.data?.turnNumber && progress.data?.maxTurns
                          ? ` (ターン ${progress.data.turnNumber}/${progress.data.maxTurns})`
                          : "";
                      const responseText = progress.message || "";
                      logMessage = `${new Date(timestamp).toLocaleString("ja-JP")}${turnInfo}\n${responseText}`;

                      // Save progress data to database
                      try {
                        this.repository.updateProgressData(task.id, progressData);
                      } catch (error) {
                        logger.error("Failed to update progress data", { error });
                      }

                      this.broadcaster?.task(task.id, "task:claude_response", {
                        text: progress.message,
                        turnNumber: progress.data.turnNumber || 1,
                        maxTurns: progress.data.maxTurns,
                        timestamp,
                      });
                    }
                    break;

                  case "statistics":
                    if (progress.data) {
                      // Claude Code SDKから送信される統計情報をprogressDataに保存
                      // 統計情報はログに含めない（別UI表示用）
                      progressData.statistics.totalToolCalls = progress.data.totalToolCalls || 0;
                      progressData.currentTurn =
                        progress.data.totalTurns || progressData.currentTurn;

                      // ツール統計から詳細情報を抽出
                      if (progress.data.toolStats) {
                        let modifiedFiles = 0;
                        let createdFiles = 0;
                        let totalExecutions = 0;

                        Object.entries(progress.data.toolStats).forEach(
                          ([tool, stats]: [string, any]) => {
                            if (tool === "Edit" || tool === "MultiEdit") {
                              modifiedFiles += stats.count || 0;
                            } else if (tool === "Write") {
                              createdFiles += stats.count || 0;
                            } else if (tool === "Bash") {
                              totalExecutions += stats.count || 0;
                            }
                          },
                        );

                        progressData.statistics.modifiedFiles = modifiedFiles;
                        progressData.statistics.createdFiles = createdFiles;
                        progressData.statistics.totalExecutions = totalExecutions;
                        progressData.statistics.processedFiles = modifiedFiles + createdFiles;
                      }

                      // ✅ Codex SDK v0.52.0: トークン使用量を保存（Codex executor限定）
                      if (progress.data.tokenUsage) {
                        progressData.statistics.tokenUsage = {
                          input: progress.data.tokenUsage.input || 0,
                          output: progress.data.tokenUsage.output || 0,
                          cached: progress.data.tokenUsage.cached || 0,
                        };
                      }

                      // Save progress data to database
                      try {
                        this.repository.updateProgressData(task.id, progressData);
                      } catch (error) {
                        logger.error("Failed to update progress data", { error });
                      }

                      this.broadcaster?.task(task.id, "task:statistics", {
                        statistics: progress.data,
                      });
                    }
                    break;

                  default:
                    // Log any other type as a regular log message
                    if (progress.message) {
                      logger.info("Task progress", {
                        type: progress.type,
                        message: progress.message,
                      });
                      logMessage = progress.message;
                      // Also broadcast as a log message
                      this.broadcaster?.task(task.id, "task:log", {
                        log: progress.message,
                        timestamp,
                      });
                    }
                }

                // すべてのログメッセージをprogressData.logsに保存
                if (logMessage) {
                  progressData.logs.push(logMessage);

                  // 定期的にDBに保存（100ログごと）
                  if (progressData.logs.length % 100 === 0) {
                    try {
                      this.repository.updateProgressData(task.id, progressData);
                    } catch (error) {
                      logger.error("Failed to update progress data", { error });
                    }
                  }
                }
              }
            : undefined,
        },
      };

      // Select executor based on options (lazy-load codex if needed)
      const executor =
        task.request.options?.executor === "codex" ? await this.getCodexExecutor() : this.executor;

      logger.info("Executing task with selected executor", {
        taskId: task.id,
        executorType: task.request.options?.executor || "claude",
      });

      // Execute the task with taskId for cancellation support
      const result = await executor.execute(requestWithProgress, task.id, task.retryMetadata);

      // 最終的なprogressDataをログに記録（デバッグ用）
      logger.info("Final progressData before saving", {
        logsCount: progressData.logs.length,
        toolExecutionsCount: progressData.toolExecutions.length,
        claudeResponsesCount: progressData.claudeResponses.length,
        todosCount: progressData.todos.length,
      });

      // Update task with result
      task.completedAt = new Date();

      if (result.success) {
        task.status = TaskStatus.COMPLETED;

        logger.info("Task completed successfully", {
          instruction: task.request.instruction.substring(0, 100),
          duration: result.duration,
          todosCount: result.todos?.length || 0,
          outputLength: typeof result.output === "string" ? result.output.length : 0,
          logsCount: result.logs?.length || 0,
          hasTodos: !!result.todos && result.todos.length > 0,
        });

        // デバッグ: resultの内容を確認
        logger.info("Task result details", {
          resultType: typeof result.output,
          resultIsString: typeof result.output === "string",
          resultSample:
            typeof result.output === "string"
              ? result.output.substring(0, 200)
              : JSON.stringify(result.output).substring(0, 200),
          fullResult: result.output,
        });

        task.result = result.output as any; // TODO: 型の整合性を改善

        this.completedCount++;

        // Update result and status in database
        try {
          this.repository.updateResult(task.id, task.result);
          this.repository.updateStatus(task.id, TaskStatus.COMPLETED);

          // Save final progress data
          this.repository.updateProgressData(task.id, progressData);
          logger.info("Final progress data saved", {
            logsCount: progressData.logs.length,
            toolExecutionsCount: progressData.toolExecutions.length,
            claudeResponsesCount: progressData.claudeResponses.length,
          });

          // Save conversation history if available
          if (result.conversationHistory) {
            this.repository.updateConversationHistory(task.id, result.conversationHistory);
            logger.info("Conversation history saved", {
              messageCount: result.conversationHistory.length,
            });
          }

          // Save SDK session ID if available
          if (result.sdkSessionId) {
            this.repository.updateSdkSessionId(task.id, result.sdkSessionId);
            logger.info("SDK session ID saved", {
              sdkSessionId: result.sdkSessionId,
            });
          }

          logger.info("Task result updated in database", { status: task.status });
        } catch (error) {
          logger.error("Failed to update task result in database", { error });
        }

        // Emit task completed event
        void this.eventBus.emit("task.completed", {
          taskId: task.id,
          result: task.result!,
          duration: result.duration || 0,
          completedAt: task.completedAt,
        });

        // Notify complete handlers (backward compatibility)
        this.onCompleteHandlers.forEach((handler) => {
          try {
            handler(task);
          } catch (error) {
            logger.error("Error in complete handler", { error });
          }
        });

        logger.info("Task completed successfully", {
          duration: result.duration,
        });

        // Schedule task cleanup from memory
        this.scheduleTaskCleanup(task.id);
      } else {
        const error = result.error || new Error("Unknown error");
        const errorInfo = {
          message: error instanceof Error ? error.message : String(error),
          code: "EXECUTION_ERROR",
        };

        // Check if task should be retried
        const retryConfig = RetryService.getRetryOptions(task.request.options);
        const shouldRetry = RetryService.shouldRetry(
          task.retryMetadata?.currentAttempt ?? 0,
          error,
          retryConfig,
        );

        if (shouldRetry) {
          // Update retry metadata
          const updatedRetryMetadata = RetryService.updateRetryMetadata(
            task.retryMetadata,
            errorInfo,
            task.startedAt,
            task.completedAt,
            retryConfig,
          );

          task.retryMetadata = updatedRetryMetadata;

          // Calculate retry delay
          const delay = RetryService.calculateRetryDelay(
            updatedRetryMetadata.currentAttempt,
            retryConfig,
          );

          // Update retry metadata in database
          try {
            this.repository.updateRetryMetadata(task.id, updatedRetryMetadata);
            this.repository.resetTaskForRetry(task.id);
          } catch (dbError) {
            logger.error("Failed to update retry metadata in database", {
              error: dbError,
            });
          }

          // Log retry attempt
          RetryService.logRetryAttempt(
            task.id,
            updatedRetryMetadata.currentAttempt,
            updatedRetryMetadata.maxRetries,
            delay,
            errorInfo,
          );

          // Emit retry scheduled event
          void this.eventBus.emit("task.retry.scheduled", {
            taskId: task.id,
            attemptNumber: updatedRetryMetadata.currentAttempt,
            scheduledFor: new Date(Date.now() + delay),
            previousError: errorInfo.message,
          });

          // Schedule retry
          setTimeout(() => {
            // Re-add task to queue for retry
            void this.queue.add(
              async () => {
                // Reset task state for retry
                task.status = TaskStatus.PENDING;
                task.startedAt = undefined;
                task.completedAt = undefined;
                task.error = undefined;
                task.result = undefined;
                await this.executeTask(task);
              },
              { priority: task.priority },
            );
          }, delay);

          // Don't mark as failed yet - it's being retried
          return;
        }

        // Max retries reached or error not retryable
        task.status = TaskStatus.FAILED;
        task.error = error;
        task.result = undefined; // 失敗時はresultをundefinedに設定

        this.failedCount++;

        // Update status in database
        try {
          this.repository.updateStatus(task.id, TaskStatus.FAILED, error);

          // Save conversation history even for failed tasks
          if (result.conversationHistory) {
            this.repository.updateConversationHistory(task.id, result.conversationHistory);
            logger.info("Conversation history saved for failed task", {
              messageCount: result.conversationHistory.length,
            });
          }
        } catch (dbError) {
          logger.error("Failed to update task status in database", {
            error: dbError,
          });
        }

        // Emit task failed event
        void this.eventBus.emit("task.failed", {
          taskId: task.id,
          error: errorInfo,
          failedAt: task.completedAt,
          willRetry: false,
          retryCount: task.retryMetadata?.currentAttempt,
        });

        // Notify error handlers (backward compatibility)
        this.onErrorHandlers.forEach((handler) => {
          try {
            handler(task, error);
          } catch (handlerError) {
            logger.error("Error in error handler", { error: handlerError });
          }
        });

        logger.error("Task failed", {
          error,
          retryAttempts: task.retryMetadata?.currentAttempt ?? 0,
          maxRetries: task.retryMetadata?.maxRetries ?? 0,
        });

        // Schedule task cleanup from memory
        this.scheduleTaskCleanup(task.id);
      }
    } catch (error) {
      // Handle unexpected errors
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Check if task was cancelled
      if (errorMessage === "Task was cancelled") {
        task.status = TaskStatus.CANCELLED;
        task.completedAt = new Date();

        // Update status in database
        try {
          this.repository.updateStatus(task.id, TaskStatus.CANCELLED);
        } catch (dbError) {
          logger.error("Failed to update task status in database", {
            error: dbError,
          });
        }

        // Emit task cancelled event
        void this.eventBus.emit("task.cancelled", {
          taskId: task.id,
          reason: "User requested cancellation",
          cancelledAt: task.completedAt,
        });

        logger.info("Task cancelled during execution", { taskId: task.id });

        // Schedule task cleanup from memory
        this.scheduleTaskCleanup(task.id);

        // Don't count cancellations as failures
        return;
      }

      task.status = TaskStatus.FAILED;
      task.error = error instanceof Error ? error : new Error(String(error));
      task.completedAt = new Date();

      this.failedCount++;

      // Update status in database
      try {
        this.repository.updateStatus(task.id, TaskStatus.FAILED, task.error);
      } catch (dbError) {
        logger.error("Failed to update task status in database", {
          error: dbError,
        });
      }

      logger.error("Unexpected error during task execution", {
        error,
      });

      // Emit task failed event
      void this.eventBus.emit("task.failed", {
        taskId: task.id,
        error: {
          message: task.error.message,
          code: "UNEXPECTED_ERROR",
          stack: task.error.stack,
        },
        failedAt: task.completedAt,
        willRetry: false,
      });

      // Notify error handlers (backward compatibility)
      this.onErrorHandlers.forEach((handler) => {
        try {
          handler(task, task.error!);
        } catch (err) {
          logger.error("Error in error handler", { error: err });
        }
      });

      // Schedule task cleanup from memory
      this.scheduleTaskCleanup(task.id);

      // Stop watching working directory
      const workingDirectory = task.request.context?.workingDirectory;
      if (workingDirectory) {
        try {
          logger.debug("Stopping file watcher for task working directory", {
            taskId: task.id,
            workingDirectory,
          });
          await fileWatcherService.unwatchRepository(workingDirectory);
        } catch (error) {
          logger.error("Failed to stop file watcher for working directory", {
            taskId: task.id,
            workingDirectory,
            error,
          });
        }
      }
    }
  }

  get(taskId: string): QueuedTask | undefined {
    return this.tasks.get(taskId);
  }

  getAll(): QueuedTask[] {
    return Array.from(this.tasks.values()).sort((a, b) => {
      // Sort by status (running first, then pending, then completed/failed)
      const statusOrder: Record<TaskStatus, number> = {
        [TaskStatus.RUNNING]: 0,
        [TaskStatus.PENDING]: 1,
        [TaskStatus.COMPLETED]: 2,
        [TaskStatus.FAILED]: 3,
        [TaskStatus.CANCELLED]: 4,
        [TaskStatus.SCHEDULED]: 5,
        [TaskStatus.DELAYED]: 6,
      };

      const statusDiff = statusOrder[a.status] - statusOrder[b.status];
      if (statusDiff !== 0) return statusDiff;

      // Then by priority (higher first)
      const priorityDiff = b.priority - a.priority;
      if (priorityDiff !== 0) return priorityDiff;

      // Finally by added time (older first)
      return a.addedAt.getTime() - b.addedAt.getTime();
    });
  }

  getStats(): QueueStats {
    const tasks = Array.from(this.tasks.values());
    const pending = tasks.filter((t) => t.status === TaskStatus.PENDING).length;
    const running = tasks.filter((t) => t.status === TaskStatus.RUNNING).length;

    return {
      size: this.queue.size,
      pending,
      running,
      completed: this.completedCount,
      failed: this.failedCount,
      isPaused: this.queue.isPaused,
    };
  }

  start(): void {
    this.queue.start();
    logger.info("Task queue started");
  }

  pause(): void {
    this.queue.pause();
    logger.info("Task queue paused");
  }

  clear(): void {
    this.queue.clear();

    // Cancel all pending tasks and clear the map
    this.tasks.forEach((task) => {
      if (task.status === TaskStatus.PENDING) {
        task.status = TaskStatus.CANCELLED;
        task.completedAt = new Date();
      }
    });

    // Clear all tasks from memory
    this.tasks.clear();

    // Clear all cleanup timers
    this.cleanupTimers.forEach((timer) => clearTimeout(timer));
    this.cleanupTimers.clear();

    // Reset counters
    this.completedCount = 0;
    this.failedCount = 0;

    logger.info("Task queue cleared");
  }

  async cancelTask(taskId: string): Promise<boolean> {
    const task = this.tasks.get(taskId);

    if (!task) {
      logger.warn("Task not found for cancellation", { taskId });
      return false;
    }

    // Can only cancel pending or running tasks
    if (task.status !== TaskStatus.PENDING && task.status !== TaskStatus.RUNNING) {
      logger.warn("Task cannot be cancelled in current state", {
        taskId,
        status: task.status,
      });
      return false;
    }

    // If task is running, cancel it through the appropriate executor
    if (task.status === TaskStatus.RUNNING) {
      const executor =
        task.request.options?.executor === "codex" ? await this.getCodexExecutor() : this.executor;
      await executor.cancel(taskId);
    }

    // Update task status
    task.status = TaskStatus.CANCELLED;
    task.completedAt = new Date();

    // Update status in database
    try {
      this.repository.updateStatus(task.id, TaskStatus.CANCELLED);
    } catch (error) {
      logger.error("Failed to update task status in database", { taskId, error });
    }

    // Emit task cancelled event
    void this.eventBus.emit("task.cancelled", {
      taskId: task.id,
      reason: "Cancelled via API",
      cancelledAt: task.completedAt,
    });

    // Schedule task cleanup from memory
    this.scheduleTaskCleanup(taskId);

    logger.info("Task cancelled", { taskId });
    return true;
  }

  onTaskComplete(callback: (task: QueuedTask) => void): void {
    this.onCompleteHandlers.push(callback);
  }

  onTaskError(callback: (task: QueuedTask, error: Error) => void): void {
    this.onErrorHandlers.push(callback);
  }

  setWebSocketServer(wsServer: WebSocketServer): void {
    this.wsServer = wsServer;
    this.broadcaster = new WebSocketBroadcaster(wsServer);

    // Register FileWatcherService listener for WebSocket broadcasting
    // This ensures file changes from TaskQueue-initiated watching are broadcast
    fileWatcherService.on("repositoryFileChange", (event) => {
      if (this.broadcaster) {
        this.broadcaster.global("repository-file-change", event);
        logger.debug("Broadcasted repository file change event from TaskQueue", event);
      }
    });
  }

  // Additional utility methods

  async waitForIdle(): Promise<void> {
    await this.queue.onIdle();
  }

  get concurrency(): number {
    return this.queue.concurrency;
  }

  set concurrency(value: number) {
    this.queue.concurrency = value;
    logger.info("Queue concurrency updated", { concurrency: value });
  }

  private restorePendingTasks(): void {
    try {
      const pendingTasks = this.repository.getPendingTasks();

      if (pendingTasks.length > 0) {
        logger.info("Restoring pending tasks from database", { count: pendingTasks.length });

        pendingTasks.forEach((task: QueuedTask) => {
          // Reset running tasks to pending
          if (task.status === TaskStatus.RUNNING) {
            task.status = TaskStatus.PENDING;
            task.startedAt = undefined;
          }

          this.tasks.set(task.id, task);

          // Re-add to queue
          void this.queue.add(
            async () => {
              await this.executeTask(task);
            },
            { priority: task.priority },
          );
        });
      }
    } catch (error) {
      logger.error("Failed to restore pending tasks", { error });
    }
  }
}

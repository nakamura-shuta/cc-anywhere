import type { SDKUserMessage } from "@anthropic-ai/claude-code";
import { logger } from "../utils/logger";

export class StreamingTaskExecutor {
  private taskId: string;
  private sessionId: string;
  private messageQueue: string[] = [];
  private completed = false;
  private initialPrompt = "";
  private maxQueueSize = 10;
  private maxWaitTime = 30000; // 30秒
  private abortController?: AbortController;
  private messageCount = 0;
  private startTime: Date;

  constructor(taskId: string, sessionId: string) {
    this.taskId = taskId;
    this.sessionId = sessionId;
    this.startTime = new Date();
  }

  getTaskId(): string {
    return this.taskId;
  }

  getSessionId(): string {
    return this.sessionId;
  }

  getQueueSize(): number {
    return this.messageQueue.length;
  }

  isCompleted(): boolean {
    return this.completed;
  }

  setInitialPrompt(prompt: string): void {
    this.initialPrompt = prompt;
  }

  addUserInstruction(instruction: string): void {
    if (this.messageQueue.length < this.maxQueueSize) {
      this.messageQueue.push(instruction);
      logger.debug("Added instruction to queue", {
        taskId: this.taskId,
        queueSize: this.messageQueue.length,
        instruction: instruction.substring(0, 50) + "...",
      });
    } else {
      logger.warn("Message queue is full", {
        taskId: this.taskId,
        maxSize: this.maxQueueSize,
      });
    }
  }

  clearQueue(): void {
    this.messageQueue = [];
  }

  markCompleted(): void {
    this.completed = true;
  }

  setMaxWaitTime(ms: number): void {
    this.maxWaitTime = ms;
  }

  setAbortController(controller: AbortController): void {
    this.abortController = controller;
  }

  getAbortController(): AbortController | undefined {
    return this.abortController;
  }

  getMessageCount(): number {
    return this.messageCount;
  }

  getStartTime(): Date {
    return this.startTime;
  }

  createUserMessage(content: string): SDKUserMessage {
    return {
      type: "user",
      message: {
        role: "user",
        content,
      },
      parent_tool_use_id: null,
      session_id: this.sessionId,
    };
  }

  async *generateUserMessages(): AsyncGenerator<SDKUserMessage> {
    const startTime = Date.now();

    // 初期プロンプトを送信
    if (this.initialPrompt) {
      yield this.createUserMessage(this.initialPrompt);
      this.messageCount++;
    }

    // 追加指示を待機
    while (!this.completed && Date.now() - startTime < this.maxWaitTime) {
      // アボートチェック
      if (this.abortController?.signal.aborted) {
        logger.info("Task aborted", { taskId: this.taskId });
        break;
      }

      // キューからメッセージを取得
      if (this.messageQueue.length > 0) {
        const instruction = this.messageQueue.shift()!;
        yield this.createUserMessage(instruction);
        this.messageCount++;
        logger.debug("Yielded queued instruction", {
          taskId: this.taskId,
          messageCount: this.messageCount,
        });
      }

      // 短い待機
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    logger.info("Streaming input completed", {
      taskId: this.taskId,
      messageCount: this.messageCount,
      duration: Date.now() - startTime,
    });
  }
}

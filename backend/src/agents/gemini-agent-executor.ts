/**
 * Gemini Agent Executor
 *
 * Google Gemini SDK implementation of IAgentExecutor interface
 * Uses Gemini 3 Pro model for task execution
 */

import type { GoogleGenAI } from "@google/genai";
import type {
  AgentTaskRequest,
  AgentExecutionOptions,
  AgentExecutionEvent,
  ExecutorType,
  GeminiAgentOptions,
} from "./types.js";
import { EXECUTOR_TYPES } from "./types.js";
import { logger } from "../utils/logger.js";
import { config } from "../config/index.js";
import { BaseTaskExecutor } from "./base-task-executor.js";

/**
 * Default model for Gemini executor
 */
const DEFAULT_MODEL = "gemini-3-pro-preview";

/**
 * Lazy-load Gemini SDK module
 */
interface GeminiModule {
  GoogleGenAI: typeof GoogleGenAI;
}

let geminiModulePromise: Promise<GeminiModule> | null = null;

async function loadGeminiModule(): Promise<GeminiModule> {
  if (!geminiModulePromise) {
    geminiModulePromise = import("@google/genai") as Promise<GeminiModule>;
  }
  return geminiModulePromise;
}

/**
 * Gemini SDK executor implementation
 * Supports Gemini 3 Pro with thinking, code execution, and Google Search
 */
export class GeminiAgentExecutor extends BaseTaskExecutor {
  private ai: GoogleGenAI | null = null;
  private runningTasks: Map<string, AbortController> = new Map();

  constructor() {
    super("gemini-task");
  }

  private async getGeminiInstance(): Promise<GoogleGenAI> {
    if (!this.ai) {
      const apiKey = config.gemini.apiKey;
      if (!apiKey) {
        throw new Error("GEMINI_API_KEY is not configured");
      }

      const { GoogleGenAI: GoogleGenAICtor } = await loadGeminiModule();
      this.ai = new GoogleGenAICtor({ apiKey });
      logger.debug("GeminiAgentExecutor initialized");
    }
    return this.ai;
  }

  async *executeTask(
    request: AgentTaskRequest,
    options: AgentExecutionOptions,
  ): AsyncIterator<AgentExecutionEvent> {
    const taskId = options.taskId || this.generateTaskId();
    const startTime = Date.now();

    this.logTaskStart(EXECUTOR_TYPES.GEMINI, taskId, request.instruction);

    // Create abort controller for this task
    const abortController = options.abortController || new AbortController();
    this.runningTasks.set(taskId, abortController);

    // Emit start event
    yield {
      type: "agent:start",
      executor: EXECUTOR_TYPES.GEMINI,
      timestamp: new Date(),
    };

    try {
      const ai = await this.getGeminiInstance();

      // Extract options
      const geminiOptions = request.options?.gemini || ({} as GeminiAgentOptions);
      const model = geminiOptions.model || DEFAULT_MODEL;
      const streaming = geminiOptions.streaming !== false; // Default: true

      // Build tools array
      const tools: Array<{ codeExecution?: object; googleSearch?: object }> = [];
      if (geminiOptions.enableCodeExecution) {
        tools.push({ codeExecution: {} });
      }
      if (geminiOptions.enableGoogleSearch) {
        tools.push({ googleSearch: {} });
      }

      // Build config
      const generateConfig: {
        tools?: Array<{ codeExecution?: object; googleSearch?: object }>;
        thinkingConfig?: { thinkingBudget: number };
        systemInstruction?: string;
      } = {};

      if (tools.length > 0) {
        generateConfig.tools = tools;
      }

      if (geminiOptions.thinkingBudget) {
        generateConfig.thinkingConfig = {
          thinkingBudget: geminiOptions.thinkingBudget,
        };
      }

      if (geminiOptions.systemPrompt) {
        generateConfig.systemInstruction = geminiOptions.systemPrompt;
      }

      logger.debug("Gemini request options", {
        taskId,
        model,
        streaming,
        tools: tools.map((t) => Object.keys(t)[0]),
        hasThinkingConfig: !!geminiOptions.thinkingBudget,
        hasSystemPrompt: !!geminiOptions.systemPrompt,
      });

      // Emit progress event
      yield {
        type: "agent:progress",
        message: "Starting Gemini generation",
        data: { model, streaming },
        timestamp: new Date(),
      };

      let output: string;
      let tokenUsage: { input: number; output: number; thought?: number } | undefined;

      if (streaming) {
        // Streaming mode
        output = await this.executeStreaming(
          ai,
          model,
          request.instruction,
          generateConfig,
          abortController,
          taskId,
        );
      } else {
        // Non-streaming mode
        const response = await ai.models.generateContent({
          model,
          contents: request.instruction,
          config: generateConfig,
        });

        output = response.text || "";

        // Extract token usage
        if (response.usageMetadata) {
          tokenUsage = {
            input: response.usageMetadata.promptTokenCount || 0,
            output: response.usageMetadata.candidatesTokenCount || 0,
            thought: response.usageMetadata.thoughtsTokenCount,
          };
        }

        // Emit response event
        yield {
          type: "agent:response",
          text: output,
          timestamp: new Date(),
        };
      }

      // Check for cancellation
      if (abortController.signal.aborted) {
        throw new Error("Task cancelled");
      }

      // Emit completion event
      const duration = Date.now() - startTime;
      this.logTaskComplete(taskId, duration);

      yield {
        type: "agent:completed",
        output,
        duration,
        timestamp: new Date(),
      };

      // Emit statistics if available
      if (tokenUsage) {
        yield {
          type: "agent:statistics",
          totalTurns: 1,
          totalToolCalls: 0,
          toolStats: {},
          elapsedTime: duration,
          tokenUsage: {
            input: tokenUsage.input,
            output: tokenUsage.output,
          },
          timestamp: new Date(),
        };
      }
    } catch (error) {
      this.logTaskFailure(taskId, error);

      yield {
        type: "agent:failed",
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date(),
      };
    } finally {
      this.runningTasks.delete(taskId);
    }
  }

  /**
   * Execute with streaming and collect output
   */
  private async executeStreaming(
    ai: GoogleGenAI,
    model: string,
    instruction: string,
    generateConfig: object,
    abortController: AbortController,
    taskId: string,
  ): Promise<string> {
    const response = await ai.models.generateContentStream({
      model,
      contents: instruction,
      config: generateConfig,
    });

    const chunks: string[] = [];

    for await (const chunk of response) {
      // Check for cancellation
      if (abortController.signal.aborted) {
        throw new Error("Task cancelled");
      }

      const text = chunk.text || "";
      if (text) {
        chunks.push(text);
        logger.debug("Gemini streaming chunk", { taskId, chunkLength: text.length });
      }
    }

    return chunks.join("");
  }

  async cancelTask(taskId: string): Promise<void> {
    logger.debug("Cancelling Gemini task", { taskId });

    const abortController = this.runningTasks.get(taskId);
    if (abortController) {
      abortController.abort();
      this.runningTasks.delete(taskId);
      logger.debug("Gemini task cancelled successfully", { taskId });
    } else {
      logger.debug("Task not found for cancellation", { taskId });
    }
  }

  getExecutorType(): ExecutorType {
    return EXECUTOR_TYPES.GEMINI;
  }

  isAvailable(): boolean {
    // Check if Gemini API key is configured
    return !!config.gemini?.apiKey;
  }
}

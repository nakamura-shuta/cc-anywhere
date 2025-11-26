/**
 * Gemini Agent Executor
 *
 * Google Gemini SDK implementation of IAgentExecutor interface
 * Uses Gemini 3 Pro model for task execution
 * Supports Function Calling for file operations
 */

import type { GoogleGenAI } from "@google/genai";
import type {
  AgentTaskRequest,
  AgentExecutionOptions,
  AgentExecutionEvent,
  ExecutorType,
  GeminiAgentOptions,
  ToolStatistics,
} from "./types.js";
import { EXECUTOR_TYPES } from "./types.js";
import { logger } from "../utils/logger.js";
import { config } from "../config/index.js";
import { BaseTaskExecutor } from "./base-task-executor.js";
import {
  FILE_TOOL_DECLARATIONS,
  isFileTool,
  executeFileFunction,
} from "./gemini-file-tools.js";

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
      const enableFileOps = geminiOptions.enableFileOperations === true;
      const workingDirectory = request.context?.workingDirectory;

      // Build tools array
      const tools: Array<{
        codeExecution?: object;
        googleSearch?: object;
        functionDeclarations?: typeof FILE_TOOL_DECLARATIONS;
      }> = [];

      if (geminiOptions.enableCodeExecution) {
        tools.push({ codeExecution: {} });
      }
      if (geminiOptions.enableGoogleSearch) {
        tools.push({ googleSearch: {} });
      }
      if (enableFileOps) {
        tools.push({ functionDeclarations: FILE_TOOL_DECLARATIONS });
      }

      // Build contents in proper Gemini API format
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const contents: any[] = [
        {
          role: "user" as const,
          parts: [{ text: request.instruction }],
        },
      ];

      // Build generation config (thinkingConfig goes in generationConfig)
      const generationConfig: {
        thinkingConfig?: { thinkingBudget: number };
      } = {};

      if (geminiOptions.thinkingBudget) {
        generationConfig.thinkingConfig = {
          thinkingBudget: geminiOptions.thinkingBudget,
        };
      }

      // Build generate parameters
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const generateParams: any = {
        model,
        contents,
      };

      // Add config if there are any options
      if (tools.length > 0 || geminiOptions.systemPrompt || geminiOptions.thinkingBudget) {
        generateParams.config = {};

        if (tools.length > 0) {
          generateParams.config.tools = tools;
        }

        if (geminiOptions.systemPrompt) {
          generateParams.config.systemInstruction = geminiOptions.systemPrompt;
        }

        if (Object.keys(generationConfig).length > 0) {
          generateParams.config.generationConfig = generationConfig;
        }
      }

      logger.debug("Gemini request options", {
        taskId,
        model,
        enableFileOps,
        tools: tools.map((t) => Object.keys(t)[0]),
        hasThinkingConfig: !!geminiOptions.thinkingBudget,
        hasSystemPrompt: !!geminiOptions.systemPrompt,
      });

      // Emit progress event
      yield {
        type: "agent:progress",
        message: "Starting Gemini generation",
        data: { model, enableFileOps },
        timestamp: new Date(),
      };

      // Track statistics
      let totalTurns = 0;
      let totalToolCalls = 0;
      const toolStats: Record<string, ToolStatistics> = {};
      let totalTokenUsage: { input: number; output: number; thought?: number } = {
        input: 0,
        output: 0,
      };

      // Function Calling loop
      const maxIterations = 20;
      let output = "";

      for (let iteration = 0; iteration < maxIterations; iteration++) {
        totalTurns++;

        // Check for cancellation
        if (abortController.signal.aborted) {
          throw new Error("Task cancelled");
        }

        // Generate content
        const response = await ai.models.generateContent(generateParams);

        // Extract token usage
        if (response.usageMetadata) {
          totalTokenUsage.input += response.usageMetadata.promptTokenCount || 0;
          totalTokenUsage.output += response.usageMetadata.candidatesTokenCount || 0;
          if (response.usageMetadata.thoughtsTokenCount) {
            totalTokenUsage.thought =
              (totalTokenUsage.thought || 0) + response.usageMetadata.thoughtsTokenCount;
          }
        }

        const candidate = response.candidates?.[0];
        const parts = candidate?.content?.parts || [];

        // Check for function calls
        const functionCalls = parts.filter(
          (p: { functionCall?: unknown }) => p.functionCall,
        );

        if (functionCalls.length === 0) {
          // No function calls - extract final text response
          const textParts = parts.filter((p: { text?: string }) => p.text);
          output = textParts.map((p: { text?: string }) => p.text || "").join("\n");

          // Emit response event
          yield {
            type: "agent:response",
            text: output,
            turnNumber: totalTurns,
            timestamp: new Date(),
          };

          break;
        }

        // Execute function calls
        const functionResponses: Array<{
          functionResponse: { name: string; response: unknown };
        }> = [];

        for (const part of functionCalls) {
          const fc = (part as { functionCall: { name: string; args?: Record<string, unknown> } })
            .functionCall;
          const toolName = fc.name;
          const toolArgs = fc.args || {};

          totalToolCalls++;

          // Initialize tool stats
          if (!toolStats[toolName]) {
            toolStats[toolName] = {
              count: 0,
              successes: 0,
              failures: 0,
              totalDuration: 0,
              avgDuration: 0,
            };
          }
          toolStats[toolName].count++;

          // Emit tool start event
          yield {
            type: "agent:tool:start",
            tool: toolName,
            input: toolArgs,
            timestamp: new Date(),
          };

          const toolStartTime = Date.now();
          let result: unknown;
          let success = true;
          let errorMessage: string | undefined;

          // Execute file tool
          if (isFileTool(toolName)) {
            const fileResult = executeFileFunction(toolName, toolArgs, workingDirectory);
            result = fileResult;
            success = fileResult.success;
            if (!success) {
              errorMessage = fileResult.error;
            }
          } else {
            result = { error: `Unknown function: ${toolName}` };
            success = false;
            errorMessage = `Unknown function: ${toolName}`;
          }

          const toolDuration = Date.now() - toolStartTime;

          // Update tool stats
          if (success) {
            toolStats[toolName].successes++;
          } else {
            toolStats[toolName].failures++;
          }
          toolStats[toolName].totalDuration += toolDuration;
          toolStats[toolName].avgDuration =
            toolStats[toolName].totalDuration / toolStats[toolName].count;

          // Emit tool end event
          yield {
            type: "agent:tool:end",
            tool: toolName,
            output: result,
            error: errorMessage,
            duration: toolDuration,
            success,
            timestamp: new Date(),
          };

          functionResponses.push({
            functionResponse: {
              name: toolName,
              response: result,
            },
          });
        }

        // Update conversation history
        contents.push({
          role: "model",
          parts: parts,
        });
        contents.push({
          role: "user",
          parts: functionResponses,
        });

        // Update generateParams with new contents
        generateParams.contents = contents;

        // Emit progress event
        yield {
          type: "agent:progress",
          message: `Turn ${totalTurns}: Executed ${functionCalls.length} function calls`,
          data: {
            currentTurn: totalTurns,
            toolCalls: functionCalls.length,
          },
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

      // Emit statistics
      yield {
        type: "agent:statistics",
        totalTurns,
        totalToolCalls,
        toolStats,
        elapsedTime: duration,
        tokenUsage: {
          input: totalTokenUsage.input,
          output: totalTokenUsage.output,
        },
        timestamp: new Date(),
      };
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

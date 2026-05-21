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
import { FILE_TOOL_DECLARATIONS, isFileTool, executeFileFunction } from "./gemini-file-tools.js";

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
    // F8: opt-in dispatch to the new Interactions API (SDK 2.4+).
    // The legacy `models.generateContent` + manual function-calling loop remains
    // the default for backward compatibility until the new path is validated
    // against a live API key.
    if (process.env.GEMINI_USE_INTERACTIONS_API === "1") {
      yield* this.executeTaskWithInteractionsApi(request, options);
      return;
    }

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
      const totalTokenUsage: { input: number; output: number; thought?: number } = {
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
        const functionCalls = parts.filter((p: { functionCall?: unknown }) => p.functionCall);

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

  /**
   * F8: Experimental implementation using Gemini SDK 2.4+ Interactions API.
   * Replaces the self-rolled function-calling loop with `client.interactions.create()`
   * + `previous_interaction_id` chaining for FunctionCallStep round-trips.
   *
   * Opt-in via `GEMINI_USE_INTERACTIONS_API=1` env var. Default executor uses
   * `models.generateContent` until this path is verified against live API.
   *
   * Mapping (Step type → AgentExecutionEvent):
   *   - ModelOutputStep        → agent:response (text)
   *   - FunctionCallStep       → agent:tool:start (then locally executed)
   *   - FunctionResultStep     → agent:tool:end (we synthesize when sending back)
   *   - GoogleSearchCallStep / URLContextCallStep / CodeExecutionCallStep
   *                            → agent:tool:start / :end (generic)
   *   - ThoughtStep            → agent:progress (reasoning visualization)
   */
  private async *executeTaskWithInteractionsApi(
    request: AgentTaskRequest,
    options: AgentExecutionOptions,
  ): AsyncGenerator<AgentExecutionEvent, void, undefined> {
    const taskId = options.taskId || this.generateTaskId();
    const startTime = Date.now();

    this.logTaskStart(EXECUTOR_TYPES.GEMINI, taskId, request.instruction);

    const abortController = options.abortController || new AbortController();
    this.runningTasks.set(taskId, abortController);

    yield {
      type: "agent:start",
      executor: EXECUTOR_TYPES.GEMINI,
      timestamp: new Date(),
    };

    try {
      const ai = await this.getGeminiInstance();
      const geminiOptions = request.options?.gemini || ({} as GeminiAgentOptions);
      const model = geminiOptions.model || DEFAULT_MODEL;
      const enableFileOps = geminiOptions.enableFileOperations === true;
      const workingDirectory = request.context?.workingDirectory;

      // Top-level `tools` (Tool_2[]) — server-side tools + Function_2 for local file ops.
      const tools: Array<Record<string, unknown>> = [];
      if (geminiOptions.enableCodeExecution) tools.push({ type: "code_execution" });
      if (geminiOptions.enableGoogleSearch) tools.push({ type: "google_search" });
      if (enableFileOps) {
        for (const decl of FILE_TOOL_DECLARATIONS) {
          // FILE_TOOL_DECLARATIONS use the legacy uppercase Schema vocabulary
          // ("OBJECT", "STRING", ...). The Interactions API expects JSON Schema
          // lowercase types ("object", "string", ...). Convert before sending.
          tools.push({
            type: "function",
            name: decl.name,
            description: decl.description,
            parameters: toInteractionsJsonSchema(decl.parameters as unknown),
          });
        }
      }

      // Statistics tracking (mirrors the legacy path)
      let totalTurns = 0;
      let totalToolCalls = 0;
      const toolStats: Record<string, ToolStatistics> = {};
      const totalTokenUsage = { input: 0, output: 0 };
      let output = "";
      let previousInteractionId: string | undefined;

      logger.debug("Gemini Interactions API request", {
        taskId,
        model,
        enableFileOps,
        tools: tools.map((t) => t.type),
      });

      yield {
        type: "agent:progress",
        message: "Starting Gemini Interactions API",
        data: { model, apiPath: "interactions" },
        timestamp: new Date(),
      };

      // Round-trip loop: each iteration sends new input (initial prompt or
      // function results) and processes returned Steps.
      let pendingInput: { type: "text"; text: string } | Array<Record<string, unknown>> = {
        type: "text",
        text: request.instruction,
      };
      const maxIterations = 20;

      for (let iteration = 0; iteration < maxIterations; iteration++) {
        if (abortController.signal.aborted) throw new Error("Task cancelled");
        totalTurns++;

        // Per SDK BaseCreateModelInteractionParams: tools and system_instruction are
        // top-level fields. `environment` is reserved for remote-environment configs
        // (network policy / sources), not for tools.
        const createParams: Record<string, unknown> = {
          api_version: "v1",
          model,
          input: pendingInput,
          ...(tools.length > 0 ? { tools } : {}),
          ...(previousInteractionId ? { previous_interaction_id: previousInteractionId } : {}),
          ...(geminiOptions.systemPrompt ? { system_instruction: geminiOptions.systemPrompt } : {}),
        };

        const interaction = (await (
          ai as unknown as {
            interactions: { create: (p: unknown) => Promise<unknown> };
          }
        ).interactions.create(createParams)) as {
          id?: string;
          steps?: Array<Record<string, unknown>>;
          usage?: { total_input_tokens?: number; total_output_tokens?: number };
        };

        previousInteractionId = interaction.id;
        if (interaction.usage) {
          totalTokenUsage.input += interaction.usage.total_input_tokens ?? 0;
          totalTokenUsage.output += interaction.usage.total_output_tokens ?? 0;
        }

        const steps = interaction.steps || [];
        const pendingFunctionResults: Array<Record<string, unknown>> = [];

        for (const step of steps) {
          const stepType = step.type as string | undefined;
          if (stepType === "model_output") {
            // ModelOutputStep.content is Array<Content_2> (TextContent | ImageContent | ...).
            // Extract text by filtering type === 'text' and concatenating .text fields.
            const contentArr =
              (step.content as Array<{ type?: string; text?: string }> | undefined) || [];
            const text = contentArr
              .filter((c) => c.type === "text" && typeof c.text === "string")
              .map((c) => c.text as string)
              .join("");
            if (text) {
              output += text;
              yield {
                type: "agent:response",
                text,
                turnNumber: totalTurns,
                timestamp: new Date(),
              };
            }
          } else if (stepType === "thought") {
            // ThoughtStep.summary is Array<TextContent | ImageContent>, not `content`.
            const summaryArr =
              (step.summary as Array<{ type?: string; text?: string }> | undefined) || [];
            const text = summaryArr
              .filter((c) => c.type === "text" && typeof c.text === "string")
              .map((c) => c.text as string)
              .join("");
            yield {
              type: "agent:progress",
              message: `[thinking] ${text.slice(0, 200)}`,
              data: { kind: "thought" },
              timestamp: new Date(),
            };
          } else if (stepType === "function_call") {
            const callId = step.id as string;
            const name = step.name as string;
            const args = (step.arguments || {}) as Record<string, unknown>;
            totalToolCalls++;
            if (!toolStats[name]) {
              toolStats[name] = {
                count: 0,
                successes: 0,
                failures: 0,
                totalDuration: 0,
                avgDuration: 0,
              };
            }
            toolStats[name].count++;

            yield {
              type: "agent:tool:start",
              tool: name,
              input: args,
              timestamp: new Date(),
            };

            // Execute locally
            const toolStartTime = Date.now();
            let result: unknown = { error: `Unknown function: ${name}` };
            let success = false;
            let errorMessage: string | undefined = `Unknown function: ${name}`;
            if (enableFileOps && isFileTool(name)) {
              const fileResult = executeFileFunction(name, args, workingDirectory);
              result = fileResult;
              success = fileResult.success;
              errorMessage = success ? undefined : fileResult.error;
            }
            const toolDuration = Date.now() - toolStartTime;
            if (success) toolStats[name].successes++;
            else toolStats[name].failures++;
            toolStats[name].totalDuration += toolDuration;
            toolStats[name].avgDuration = toolStats[name].totalDuration / toolStats[name].count;

            yield {
              type: "agent:tool:end",
              tool: name,
              output: result,
              error: errorMessage,
              duration: toolDuration,
              success,
              timestamp: new Date(),
            };

            pendingFunctionResults.push({
              type: "function_result",
              call_id: callId,
              name,
              is_error: !success,
              result,
            });
          } else {
            // Pass-through for other Step types (tool calls handled server-side)
            logger.debug("Gemini Interactions step", { taskId, stepType, step });
          }
        }

        if (pendingFunctionResults.length === 0) break;
        pendingInput = pendingFunctionResults;
      }

      if (abortController.signal.aborted) throw new Error("Task cancelled");

      const duration = Date.now() - startTime;
      this.logTaskComplete(taskId, duration);

      yield {
        type: "agent:completed",
        output,
        duration,
        timestamp: new Date(),
      };

      yield {
        type: "agent:statistics",
        totalTurns,
        totalToolCalls,
        toolStats,
        elapsedTime: duration,
        tokenUsage: { input: totalTokenUsage.input, output: totalTokenUsage.output },
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
}

/**
 * Convert the legacy `GeminiType` schema vocabulary (UPPERCASE) used by
 * FILE_TOOL_DECLARATIONS to JSON Schema lowercase expected by the new
 * Interactions API. Walks `type`, `items`, `properties`, `anyOf`, `oneOf`,
 * `allOf` recursively. Other fields are passed through unchanged.
 */
function toInteractionsJsonSchema(schema: unknown): unknown {
  if (schema === null || typeof schema !== "object") return schema;
  if (Array.isArray(schema)) return schema.map((s) => toInteractionsJsonSchema(s));
  const obj = schema as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k === "type" && typeof v === "string") {
      // OBJECT -> object, STRING -> string, ... ; pass-through if already lowercase
      out[k] = v === v.toUpperCase() ? v.toLowerCase() : v;
    } else if (k === "properties" && v && typeof v === "object") {
      out[k] = Object.fromEntries(
        Object.entries(v as Record<string, unknown>).map(([pk, pv]) => [
          pk,
          toInteractionsJsonSchema(pv),
        ]),
      );
    } else if (k === "items" || k === "anyOf" || k === "oneOf" || k === "allOf") {
      out[k] = toInteractionsJsonSchema(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

// Exposed for unit testing.
export const __test_toInteractionsJsonSchema = toInteractionsJsonSchema;

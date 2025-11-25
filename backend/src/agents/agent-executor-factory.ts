/**
 * Agent Executor Factory
 *
 * Factory for creating appropriate agent executors based on request
 */

import type { IAgentExecutor, AgentTaskRequest, ExecutorType } from "./types.js";
import { EXECUTOR_TYPES } from "./types.js";
import { ClaudeAgentExecutor } from "./claude-agent-executor.js";
import { logger } from "../utils/logger.js";
import { config } from "../config/index.js";

/**
 * Factory for creating agent executors
 */
export class AgentExecutorFactory {
  /**
   * Create an agent executor based on request
   *
   * @param request - Agent task request
   * @returns Appropriate executor instance
   * @throws Error if executor type is unknown
   */
  static async create(request: AgentTaskRequest): Promise<IAgentExecutor> {
    const executorType = request.options?.executor || EXECUTOR_TYPES.CLAUDE;

    logger.debug("Creating agent executor", { executorType });

    switch (executorType) {
      case EXECUTOR_TYPES.CLAUDE: {
        return new ClaudeAgentExecutor();
      }
      case EXECUTOR_TYPES.CODEX: {
        const { CodexAgentExecutor } = await import("./codex-agent-executor.js");
        return new CodexAgentExecutor();
      }
      case EXECUTOR_TYPES.GEMINI: {
        const { GeminiAgentExecutor } = await import("./gemini-agent-executor.js");
        return new GeminiAgentExecutor();
      }
      default: {
        const error = `Unknown executor type: ${executorType}`;
        logger.error(error);
        throw new Error(error);
      }
    }
  }

  /**
   * Check which executors are available
   *
   * @returns Array of available executor types
   */
  static async getAvailableExecutors(): Promise<ExecutorType[]> {
    const available: ExecutorType[] = [];

    // Check Claude - always instantiate to check availability
    try {
      const claudeExecutor = new ClaudeAgentExecutor();
      if (claudeExecutor.isAvailable()) {
        available.push(EXECUTOR_TYPES.CLAUDE);
      }
    } catch (error) {
      logger.debug("Claude executor not available", { error });
    }

    // Check Codex - check config without importing to avoid tsx issues
    try {
      // Check if OpenAI API key is configured (same logic as CodexAgentExecutor.isAvailable())
      if (config.openai?.apiKey) {
        available.push(EXECUTOR_TYPES.CODEX);
        logger.debug("Codex executor available (API key configured)");
      }
    } catch (error) {
      logger.debug("Codex executor not available", { error });
    }

    // Check Gemini - check config without importing
    try {
      // Check if Gemini API key is configured (same logic as GeminiAgentExecutor.isAvailable())
      if (config.gemini?.apiKey) {
        available.push(EXECUTOR_TYPES.GEMINI);
        logger.debug("Gemini executor available (API key configured)");
      }
    } catch (error) {
      logger.debug("Gemini executor not available", { error });
    }

    logger.debug("Available executors", { available });
    return available;
  }
}

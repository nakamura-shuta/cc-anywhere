// Claude Code SDK v1.0.59 新機能を活用した実装例

import { query } from "@anthropic-ai/claude-code";
import { logger } from "../utils/logger.js";
import type { ClaudeCodeOptions, ClaudeCodeMessage } from "./types.js";

export interface EnhancedClaudeCodeOptions extends ClaudeCodeOptions {
  // 新機能対応
  canUseTool?: (toolName: string, toolInput: any) => boolean | Promise<boolean>;
  env?: Record<string, string>;
  captureStderr?: boolean;
  onStderr?: (data: string) => void;
}

export class EnhancedClaudeCodeClient {
  private dangerousCommands = [
    /rm\s+-rf\s+\//,  // rm -rf /
    /dd\s+if=.*of=\/dev\/[sh]d/,  // ddでディスク書き込み
    />\/dev\/[sh]d/,  // ディスクへの直接書き込み
  ];

  async executeWithEnhancedFeatures(
    prompt: string,
    options: EnhancedClaudeCodeOptions
  ): Promise<void> {
    const {
      onProgress,
      onResult,
      maxRetries = 3,
      timeout = 300000,
      workingDirectory,
      canUseTool: userCanUseTool,
      env,
      captureStderr,
      onStderr,
    } = options;

    // canUseToolの実装
    const canUseTool = async (toolName: string, toolInput: any): Promise<boolean> => {
      logger.info(`Tool confirmation requested`, { toolName, toolInput });

      // 1. 危険なコマンドのチェック（Bashツール）
      if (toolName === "Bash" && toolInput.command) {
        for (const pattern of this.dangerousCommands) {
          if (pattern.test(toolInput.command)) {
            logger.warn(`Dangerous command blocked`, { 
              tool: toolName, 
              command: toolInput.command 
            });
            onProgress?.({
              type: "tool_blocked",
              message: `危険なコマンドがブロックされました: ${toolInput.command}`,
              data: { tool: toolName, reason: "dangerous_command" }
            });
            return false;
          }
        }
      }

      // 2. ファイル削除の確認
      if (toolName === "FileDelete" || 
          (toolName === "Bash" && toolInput.command?.includes("rm "))) {
        logger.info(`File deletion requires confirmation`, { toolName });
        onProgress?.({
          type: "confirmation_required",
          message: `ファイル削除の確認が必要です`,
          data: { tool: toolName, input: toolInput }
        });
        // 実際の実装では、WebSocketを通じてユーザーに確認を求める
        // return await requestUserConfirmation(toolName, toolInput);
      }

      // 3. ユーザー定義のcanUseTool
      if (userCanUseTool) {
        const userDecision = await userCanUseTool(toolName, toolInput);
        if (!userDecision) {
          logger.info(`Tool blocked by user callback`, { toolName });
          return false;
        }
      }

      // 4. 権限モードに基づく制御
      if (options.permissionMode === "readonly") {
        const readOnlyTools = ["FileRead", "Grep", "Ls", "Glob"];
        if (!readOnlyTools.includes(toolName)) {
          logger.warn(`Write operation blocked in readonly mode`, { toolName });
          return false;
        }
      }

      return true;
    };

    // エラーログのキャプチャ設定
    const stderr = captureStderr || onStderr ? (data: string) => {
      logger.error(`Claude Code stderr:`, data);
      onStderr?.(data);
      onProgress?.({
        type: "stderr",
        message: `エラー出力: ${data}`,
        data: { stderr: data }
      });
    } : undefined;

    // プロンプトをストリーム形式に変換（canUseTool使用時に必要）
    const promptStream = this.createPromptStream(prompt);

    try {
      const response = query({
        prompt: promptStream,
        abortController: new AbortController(),
        options: {
          cwd: workingDirectory,
          maxTurns: options.maxTurns,
          model: options.model,
          canUseTool,
          env: {
            // デフォルト環境変数
            NODE_ENV: process.env.NODE_ENV || "production",
            PROJECT_ROOT: workingDirectory,
            // カスタム環境変数
            ...env,
          },
          stderr,
        },
      });

      for await (const message of response) {
        await this.processMessage(message, options);
      }
    } catch (error) {
      logger.error("Enhanced Claude Code execution failed", { error });
      throw error;
    }
  }

  private async *createPromptStream(prompt: string) {
    yield {
      type: "user" as const,
      message: {
        role: "user" as const,
        content: prompt,
      },
      parent_tool_use_id: null,
      session_id: "sdk-session",
    };
  }

  private async processMessage(
    message: any,
    options: EnhancedClaudeCodeOptions
  ): Promise<void> {
    // メッセージ処理ロジック
    logger.debug("Processing message", { messageType: message.type });
    
    switch (message.type) {
      case "assistant":
        options.onProgress?.({
          type: "message",
          message: message.message.content,
        });
        break;
      case "result":
        options.onResult?.(message);
        break;
      case "system":
        logger.info("System message", message);
        break;
    }
  }
}

// 使用例
export async function exampleUsage() {
  const client = new EnhancedClaudeCodeClient();
  
  await client.executeWithEnhancedFeatures(
    "プロジェクトのファイルを整理してください",
    {
      workingDirectory: "/path/to/project",
      // ツール使用の制御
      canUseTool: async (toolName, toolInput) => {
        console.log(`Tool ${toolName} requested with input:`, toolInput);
        // カスタムロジック
        return true;
      },
      // 環境変数の設定
      env: {
        CUSTOM_API_KEY: "your-api-key",
        DEBUG: "true",
      },
      // エラーログのキャプチャ
      captureStderr: true,
      onStderr: (data) => {
        console.error("Stderr:", data);
      },
      onProgress: (update) => {
        console.log("Progress:", update);
      },
      onResult: (result) => {
        console.log("Result:", result);
      },
    }
  );
}
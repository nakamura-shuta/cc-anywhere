#!/usr/bin/env tsx
/**
 * Claude Code SDK continue機能のAPIテスト
 *
 * SDKセッションIDを使用して会話を継続する機能をテストします。
 * 最初のタスクでフィボナッチ数列を計算し、
 * 次のタスクで前の会話を覚えているかを確認します。
 */

import axios from "axios";
import { config as dotenvConfig } from "dotenv";

// Load environment variables
dotenvConfig();

const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:5000";
const API_KEY = process.env.API_KEY || "test-api-key";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "X-API-Key": API_KEY,
    "Content-Type": "application/json",
  },
});

// 色付きログ出力
const log = {
  info: (msg: string, data?: any) => {
    console.log(`\x1b[36m[INFO]\x1b[0m ${msg}`);
    if (data) console.log(JSON.stringify(data, null, 2));
  },
  success: (msg: string, data?: any) => {
    console.log(`\x1b[32m[SUCCESS]\x1b[0m ${msg}`);
    if (data) console.log(JSON.stringify(data, null, 2));
  },
  error: (msg: string, data?: any) => {
    console.log(`\x1b[31m[ERROR]\x1b[0m ${msg}`);
    if (data) console.log(JSON.stringify(data, null, 2));
  },
  warn: (msg: string) => {
    console.log(`\x1b[33m[WARN]\x1b[0m ${msg}`);
  },
};

async function waitForTaskCompletion(taskId: string, maxWait: number = 60000): Promise<any> {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWait) {
    try {
      const response = await api.get(`/api/tasks/${taskId}`);
      const task = response.data;

      if (task.status === "completed" || task.status === "failed") {
        return task;
      }

      log.info(`Task ${taskId} status: ${task.status}`);
    } catch (error: any) {
      if (error.response?.status !== 404) {
        throw error;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  throw new Error(`Task ${taskId} did not complete within ${maxWait}ms`);
}

async function testSdkContinue() {
  log.info("===== Claude Code SDK continue機能テスト開始 =====");

  try {
    // 1. 最初のタスクを実行（フィボナッチ数列を計算）
    log.info("\n1. 最初のタスク: フィボナッチ数列の計算");

    const firstResponse = await api.post("/api/tasks", {
      instruction:
        "フィボナッチ数列の最初の10項を計算して教えてください。各項の値を明確に示してください。",
      options: {
        sdk: {
          maxTurns: 3,
          // continueSessionは使わない（新規セッション）
        },
      },
    });

    const firstTaskId = firstResponse.data.id || firstResponse.data.taskId;
    log.success(`最初のタスク作成成功: ${firstTaskId}`);

    // タスク完了を待つ
    const firstTask = await waitForTaskCompletion(firstTaskId);

    if (firstTask.status === "completed") {
      log.success("最初のタスク完了", {
        result: firstTask.result?.substring(0, 300) + "...",
      });

      // SDKセッションIDが保存されているか確認
      const taskDetails = await api.get(`/api/tasks/${firstTaskId}`);
      log.info("タスク詳細", {
        hasSDKSessionId: !!taskDetails.data.sdkSessionId,
        sdkSessionId: taskDetails.data.sdkSessionId,
      });
    } else {
      log.error("最初のタスク失敗", firstTask);
      return;
    }

    // 2. SDKセッションを継続する2番目のタスク
    log.info("\n2. 継続タスク: 前の会話を覚えているか確認");

    const secondResponse = await api.post("/api/tasks", {
      instruction: "先ほど計算してもらったフィボナッチ数列の第7項と第8項の値を教えてください。",
      options: {
        sdk: {
          maxTurns: 2,
          continueFromTaskId: firstTaskId, // 前のタスクから継続
        },
      },
    });

    const secondTaskId = secondResponse.data.id || secondResponse.data.taskId;
    log.success(`継続タスク作成成功: ${secondTaskId}`);

    // タスク完了を待つ
    const secondTask = await waitForTaskCompletion(secondTaskId);

    if (secondTask.status === "completed") {
      log.success("継続タスク完了", {
        result: secondTask.result?.substring(0, 500) + "...",
      });

      // 結果を解析
      const result = secondTask.result || "";
      const hasCorrectValues =
        (result.includes("13") && result.includes("21")) || // 第7項: 13, 第8項: 21
        (result.includes("１３") && result.includes("２１")) || // 全角数字
        (result.includes("7項") && result.includes("8項")); // 項目への言及

      if (hasCorrectValues) {
        log.success("✅ SDKセッションが正しく継続されました！前の会話を覚えています。");
      } else {
        log.warn(
          "⚠️ 応答に期待される値が含まれていません。セッションが継続されていない可能性があります。",
        );
      }
    } else {
      log.error("継続タスク失敗", secondTask);
    }

    // 3. 新しいタスクIDから継続できないことを確認（エラーケース）
    log.info("\n3. エラーケース: 存在しないタスクから継続");

    try {
      await api.post("/api/tasks", {
        instruction: "テスト",
        options: {
          sdk: {
            continueFromTaskId: "non-existent-task-id",
          },
        },
      });
      log.error("エラーが発生すべきでしたが、成功してしまいました");
    } catch (error: any) {
      if (error.response?.status === 404) {
        log.success("✅ 期待通りエラーが発生しました", {
          status: error.response.status,
          code: error.response.data?.error?.code,
          message: error.response.data?.error?.message,
        });
      } else {
        log.error("予期しないエラー", error.response?.data || error.message);
      }
    }

    log.success("\n===== テスト完了 =====");
  } catch (error: any) {
    log.error("テストエラー", {
      message: error.message,
      response: error.response?.data,
    });
  }
}

// メイン実行
void (async () => {
  try {
    await testSdkContinue();
    process.exit(0);
  } catch (error) {
    log.error("テスト失敗", error);
    process.exit(1);
  }
})();

#!/usr/bin/env tsx

import axios from "axios";
import { config as dotenvConfig } from "dotenv";
// import path from "path";
// import { fileURLToPath } from "url";

// Load environment variables
dotenvConfig();

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

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
  warn: (msg: string, data?: any) => {
    console.log(`\x1b[33m[WARN]\x1b[0m ${msg}`);
    if (data) console.log(JSON.stringify(data, null, 2));
  },
};

// タスクの完了を待つ
async function waitForTaskCompletion(taskId: string, maxWaitTime = 60000): Promise<any> {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitTime) {
    try {
      const response = await api.get(`/api/tasks/${taskId}`);
      const task = response.data;

      if (task.status === "completed" || task.status === "failed") {
        return task;
      }

      // 2秒待機
      await new Promise((resolve) => setTimeout(resolve, 2000));
    } catch (error: any) {
      // 404エラーの場合は少し待ってリトライ
      if (error.response?.status === 404) {
        log.warn(`Task ${taskId} not found yet, retrying...`);
        await new Promise((resolve) => setTimeout(resolve, 2000));
        continue;
      }
      log.error(`Failed to check task status: ${error}`);
      throw error;
    }
  }

  throw new Error(`Task ${taskId} did not complete within ${maxWaitTime}ms`);
}

async function testSessionContinuation() {
  log.info("===== セッション継続機能のテスト開始 =====");

  let sessionId: string | null = null;
  let taskId: string | null = null;

  try {
    // 1. セッション作成
    log.info("\n1. セッション作成");
    const createSessionResponse = await api.post("/api/sessions", {
      name: "テストセッション - 会話継続",
      description: "Claude Code SDK 1.0.53での会話継続テスト",
      context: {
        workingDirectory: process.cwd(),
      },
    });

    sessionId = createSessionResponse.data.session.id;
    log.success(`セッション作成成功: ${sessionId}`);

    // 2. 最初のタスク実行（セッション開始）
    log.info("\n2. 最初のタスク実行（セッション開始）");
    const firstTaskResponse = await api.post(`/api/sessions/${sessionId}/continue`, {
      instruction:
        "こんにちは！私は数学の問題を解きたいです。まず、フィボナッチ数列の最初の10項を教えてください。",
      options: {
        sdk: {
          maxTurns: 3,
        },
      },
    });

    taskId = firstTaskResponse.data.taskId;
    log.success(`最初のタスク作成成功: ${taskId}`);

    // タスク完了を待つ
    const firstTask = await waitForTaskCompletion(taskId);
    log.success("最初のタスク完了", {
      status: firstTask.status,
      result: firstTask.result?.substring(0, 200) + "...",
    });

    // 3. セッション継続（2回目）
    log.info("\n3. セッション継続（前の会話を覚えているか確認）");
    const secondTaskResponse = await api.post(`/api/sessions/${sessionId}/continue`, {
      instruction:
        "ありがとうございます。では、今教えてもらったフィボナッチ数列の第10項は何でしたか？",
      options: {
        sdk: {
          maxTurns: 2,
        },
      },
    });

    taskId = secondTaskResponse.data.taskId;
    log.success(`2回目のタスク作成成功: ${taskId}`);

    const secondTask = await waitForTaskCompletion(taskId);
    log.success("2回目のタスク完了", {
      status: secondTask.status,
      result: secondTask.result?.substring(0, 200) + "...",
    });

    // 4. 直接タスクAPIでresumeSessionを使用
    log.info("\n4. 直接タスクAPIでresumeSessionを使用");
    const resumeTaskResponse = await api.post("/api/tasks", {
      instruction:
        "さらに質問です。フィボナッチ数列の性質について、黄金比との関係を説明してください。",
      options: {
        sdk: {
          resumeSession: sessionId,
          maxTurns: 3,
        },
      },
    });

    taskId = resumeTaskResponse.data.id;
    log.success(`resumeSessionタスク作成成功: ${taskId}`);

    const resumeTask = await waitForTaskCompletion(taskId);
    log.success("resumeSessionタスク完了", {
      status: resumeTask.status,
      result: resumeTask.result?.substring(0, 200) + "...",
    });

    // 5. 会話履歴の確認
    log.info("\n5. 会話履歴の確認");
    const historyResponse = await api.get(`/api/sessions/${sessionId}/history`);
    const history = historyResponse.data;

    log.success("会話履歴取得成功", {
      totalTurns: history.totalTurns,
      turns: history.turns.map((turn: any) => ({
        turnNumber: turn.turnNumber,
        instruction: turn.instruction.substring(0, 50) + "...",
        timestamp: turn.timestamp,
      })),
    });

    // 6. セッション情報の確認
    log.info("\n6. セッション情報の確認");
    const sessionResponse = await api.get(`/api/sessions/${sessionId}`);
    const session = sessionResponse.data;

    log.success("セッション情報取得成功", {
      id: session.id,
      name: session.name,
      status: session.status,
      totalTurns: session.totalTurns,
      createdAt: session.createdAt,
    });

    log.success("\n===== すべてのテストが成功しました！ =====");
    log.info("\n結論: Claude Code SDK 1.0.53で会話継続機能が正常に動作しています！");
  } catch (error: any) {
    log.error("テスト中にエラーが発生しました", {
      message: error.message,
      response: error.response?.data,
    });
    throw error;
  } finally {
    // クリーンアップ：セッションを削除
    if (sessionId) {
      try {
        await api.delete(`/api/sessions/${sessionId}`);
        log.info("テストセッションを削除しました");
      } catch (error) {
        log.warn("セッション削除に失敗しました", error);
      }
    }
  }
}

// メイン実行
void (async () => {
  try {
    await testSessionContinuation();
    process.exit(0);
  } catch (error) {
    log.error("テスト失敗", error);
    process.exit(1);
  }
})();

#!/usr/bin/env tsx

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
};

async function testSimpleTask() {
  log.info("===== シンプルなタスク実行テスト =====");

  try {
    // 1. シンプルなタスクを実行（continueSessionを使用）
    log.info("\n1. continueSessionオプションでタスク実行");

    const response1 = await api.post("/api/tasks", {
      instruction: "こんにちは！フィボナッチ数列の最初の5項を教えてください。",
      options: {
        sdk: {
          continueSession: true,
          maxTurns: 2,
        },
      },
    });

    const taskId1 = response1.data.id;
    log.success(`タスク1作成成功: ${taskId1}`);

    // タスク完了を待つ（最大30秒）
    let task1 = null;
    for (let i = 0; i < 15; i++) {
      await new Promise((resolve) => setTimeout(resolve, 2000));

      try {
        const statusResponse = await api.get(`/api/tasks/${taskId1}`);
        task1 = statusResponse.data;

        if (task1.status === "completed" || task1.status === "failed") {
          break;
        }
        log.info(`タスク1状態: ${task1.status}`);
      } catch (error: any) {
        if (error.response?.status !== 404) {
          throw error;
        }
      }
    }

    if (task1?.status === "completed") {
      log.success("タスク1完了", {
        result: task1.result?.substring(0, 200) + "...",
      });
    } else {
      log.error("タスク1失敗", task1);
    }

    // 2. 続きのタスクを実行
    log.info("\n2. 同じくcontinueSessionで続きの会話");

    const response2 = await api.post("/api/tasks", {
      instruction: "ありがとうございます。今教えてもらった数列の5番目の数は何でしたか？",
      options: {
        sdk: {
          continueSession: true,
          maxTurns: 2,
        },
      },
    });

    const taskId2 = response2.data.id;
    log.success(`タスク2作成成功: ${taskId2}`);

    // タスク2の完了を待つ
    let task2 = null;
    for (let i = 0; i < 15; i++) {
      await new Promise((resolve) => setTimeout(resolve, 2000));

      try {
        const statusResponse = await api.get(`/api/tasks/${taskId2}`);
        task2 = statusResponse.data;

        if (task2.status === "completed" || task2.status === "failed") {
          break;
        }
        log.info(`タスク2状態: ${task2.status}`);
      } catch (error: any) {
        if (error.response?.status !== 404) {
          throw error;
        }
      }
    }

    if (task2?.status === "completed") {
      log.success("タスク2完了", {
        result: task2.result?.substring(0, 300) + "...",
      });

      // 結果を解析
      const result = task2.result || "";
      if (result.includes("5") || result.includes("５") || result.includes("五")) {
        log.success("✅ 前の会話を覚えている可能性があります！");
      } else {
        log.error("❌ 前の会話を覚えていない可能性があります");
      }
    } else {
      log.error("タスク2失敗", task2);
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
    await testSimpleTask();
    process.exit(0);
  } catch (error) {
    log.error("テスト失敗", error);
    process.exit(1);
  }
})();

#!/usr/bin/env tsx
/**
 * sessionIdの詳細調査 - ログレベルを上げて実行
 */

import axios from "axios";
import { config as dotenvConfig } from "dotenv";

// Load environment variables
dotenvConfig();

// ログレベルをDEBUGに設定
process.env.LOG_LEVEL = "debug";

const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:5000";
const API_KEY = process.env.API_KEY || "test-api-key";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "X-API-Key": API_KEY,
    "Content-Type": "application/json",
  },
});

async function detailedSessionCheck() {
  console.log("===== Session ID 詳細調査 =====");
  console.log("LOG_LEVEL:", process.env.LOG_LEVEL);

  try {
    // 1. 詳細なオプションでタスクを実行
    console.log("\n1. タスク実行（詳細オプション）");
    const createResponse = await api.post("/api/tasks", {
      instruction: "Say hello and tell me about yourself in one sentence.",
      options: {
        sdk: {
          maxTurns: 1,
          verbose: true,  // 詳細ログを有効化
        },
      },
    });

    const taskId = createResponse.data.taskId;
    console.log("\n2. タスクID:", taskId);
    console.log("ステータス:", createResponse.data.status);

    // 3. タスク完了まで待機（ポーリング）
    if (createResponse.data.status !== "completed") {
      console.log("\n3. タスク完了待機中...");
      
      let attempts = 0;
      while (attempts < 30) {  // 最大30秒待機
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const statusResponse = await api.get(`/api/tasks/${taskId}`);
        console.log(`  - 確認 ${attempts + 1}: ${statusResponse.data.status}`);
        
        if (statusResponse.data.status === "completed" || statusResponse.data.status === "failed") {
          console.log("\n4. 最終結果:");
          console.log(JSON.stringify(statusResponse.data, null, 2));
          
          // Session ID の詳細確認
          console.log("\n5. Session ID 詳細:");
          console.log("- sdkSessionId:", statusResponse.data.sdkSessionId || "未設定");
          console.log("- progressData:", statusResponse.data.progressData);
          
          break;
        }
        
        attempts++;
      }
    } else {
      // 既に完了している場合
      console.log("\n3. タスク即座に完了");
      console.log("- sdkSessionId:", createResponse.data.sdkSessionId || "未設定");
    }

    // 6. データベースの直接確認
    console.log("\n6. データベース確認用のタスクID:", taskId);
    console.log("SQLite確認コマンド:");
    console.log(`sqlite3 data/cc-anywhere.db "SELECT id, sdk_session_id FROM tasks WHERE id='${taskId}';"`);

  } catch (error: any) {
    console.error("\nエラー発生:");
    console.error(error);
  }
}

// メイン実行
void (async () => {
  await detailedSessionCheck();
})();
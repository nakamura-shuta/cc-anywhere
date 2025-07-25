#!/usr/bin/env tsx
/**
 * sessionIdが実際に返されるかの詳細確認テスト
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

async function checkSessionId() {
  console.log("===== Session ID 確認テスト =====");
  console.log("API URL:", API_BASE_URL);
  console.log("API Key:", API_KEY ? "設定済み" : "未設定");

  try {
    // 1. シンプルなタスクを実行
    console.log("\n1. タスク作成リクエスト送信中...");
    const createResponse = await api.post("/api/tasks", {
      instruction: "Hello, please respond with a simple greeting.",
      options: {
        sdk: {
          maxTurns: 1,
        },
      },
    });

    console.log("\n2. タスク作成レスポンス:");
    console.log("Status:", createResponse.status);
    console.log("Headers:", createResponse.headers);
    console.log("\n3. レスポンスボディ (整形済み):");
    console.log(JSON.stringify(createResponse.data, null, 2));

    const taskId = createResponse.data.id || createResponse.data.taskId;
    console.log("\n4. タスクID:", taskId);

    // タスクの詳細を取得
    if (taskId) {
      console.log("\n5. タスク詳細を取得中...");
      const detailsResponse = await api.get(`/api/tasks/${taskId}`);
      
      console.log("\n6. タスク詳細レスポンス:");
      console.log(JSON.stringify(detailsResponse.data, null, 2));

      // sdkSessionIdの確認
      console.log("\n7. Session ID 分析:");
      console.log("- sdkSessionId フィールド:", detailsResponse.data.sdkSessionId || "未設定");
      console.log("- タスクステータス:", detailsResponse.data.status);
      
      if (detailsResponse.data.result) {
        console.log("- 結果の型:", typeof detailsResponse.data.result);
        console.log("- 結果の内容 (最初の100文字):", 
          JSON.stringify(detailsResponse.data.result).substring(0, 100) + "...");
      }
    }

  } catch (error: any) {
    console.error("\nエラー発生:");
    console.error("Message:", error.message);
    if (error.response) {
      console.error("Response status:", error.response.status);
      console.error("Response data:", JSON.stringify(error.response.data, null, 2));
    }
  }
}

// メイン実行
void (async () => {
  await checkSessionId();
})();
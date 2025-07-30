#!/usr/bin/env tsx
/**
 * SDK Continue機能のデバッグテスト
 * 会話履歴が正しく引き継がれるかを詳細に確認
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

interface TaskResponse {
  taskId: string;
  status: string;
  result?: any;
  sdkSessionId?: string;
  conversationHistory?: any[];
}

async function testSdkContinueDebug() {
  console.log("=== SDK Continue Debug Test ===\n");

  try {
    // 1. 最初のタスクを作成
    console.log("1. Creating initial task...");
    const { data: firstTask } = await api.post<TaskResponse>("/api/tasks", {
      instruction: "Please tell me what's 2 + 2",
      context: {
        workingDirectory: process.cwd(),
      },
      options: {
        timeout: 60000,
        async: false,
        sdk: {
          maxTurns: 5,
          permissionMode: "allow",
        },
      },
    });

    console.log(`✓ First task created: ${firstTask.taskId}`);
    console.log(`  Status: ${firstTask.status}`);
    console.log(
      `  Result: ${typeof firstTask.result === "string" ? firstTask.result : JSON.stringify(firstTask.result)}`,
    );
    console.log(`  SDK Session ID: ${firstTask.sdkSessionId}`);

    if (!firstTask.sdkSessionId) {
      console.error("❌ No SDK session ID returned!");
      process.exit(1);
    }

    // 2. 詳細を取得して会話履歴を確認
    console.log("\n2. Getting task details to check conversation history...");
    const { data: taskDetails } = await api.get<any>(`/api/tasks/${firstTask.taskId}`);
    console.log(`  Conversation history saved: ${taskDetails.conversationHistory ? "Yes" : "No"}`);
    if (taskDetails.conversationHistory) {
      console.log(`  Message count: ${taskDetails.conversationHistory.length}`);
    }

    // 3. SDK Continueでタスクを作成
    console.log("\n3. Creating SDK Continue task...");
    const { data: continueTask } = await api.post<TaskResponse>("/api/tasks", {
      instruction: "What was my previous question and what was your answer?",
      context: {
        workingDirectory: process.cwd(),
      },
      options: {
        timeout: 60000,
        async: false,
        sdk: {
          maxTurns: 5,
          permissionMode: "allow",
          continueFromTaskId: firstTask.taskId,
        },
      },
    });

    console.log(`✓ Continue task created: ${continueTask.taskId}`);
    console.log(`  Status: ${continueTask.status}`);
    console.log(
      `  Result: ${typeof continueTask.result === "string" ? continueTask.result : JSON.stringify(continueTask.result)}`,
    );
    console.log(`  SDK Session ID: ${continueTask.sdkSessionId}`);

    // 結果の確認
    console.log("\n4. Analyzing results...");
    // resultがオブジェクトの場合、文字列に変換
    let resultStr: string;
    if (typeof continueTask.result === "string") {
      resultStr = continueTask.result;
    } else if (typeof continueTask.result === "object" && continueTask.result !== null) {
      // オブジェクトの場合、値を結合
      const values = Object.values(continueTask.result);
      resultStr = values.join("");
    } else {
      resultStr = String(continueTask.result);
    }

    // 前の会話を覚えているかチェック
    const remembersQuestion =
      resultStr.toLowerCase().includes("2 + 2") ||
      resultStr.toLowerCase().includes("2+2") ||
      resultStr.toLowerCase().includes("two plus two");
    const remembersAnswer = resultStr.includes("4");

    if (remembersQuestion && remembersAnswer) {
      console.log("✅ Success! Claude remembers the previous conversation.");
      console.log("   - Remembered the question about 2 + 2");
      console.log("   - Remembered the answer was 4");
    } else {
      console.log("❌ Failed! Claude doesn't remember the previous conversation.");
      console.log(`   - Remembers question: ${remembersQuestion}`);
      console.log(`   - Remembers answer: ${remembersAnswer}`);
      console.log(
        `   - Actual response: "${resultStr.substring(0, 200)}${resultStr.length > 200 ? "..." : ""}"`,
      );

      // デバッグ情報
      console.log("\nDEBUG: Full response analysis:");
      console.log(`   - Response type: ${typeof continueTask.result}`);
      console.log(`   - Response length: ${resultStr.length}`);
      console.log(`   - First 100 chars: "${resultStr.substring(0, 100)}"`);
    }

    // セッションIDの比較
    console.log("\n5. Session ID comparison:");
    console.log(`  First task session: ${firstTask.sdkSessionId}`);
    console.log(`  Continue task session: ${continueTask.sdkSessionId}`);
    console.log(`  Same session: ${firstTask.sdkSessionId === continueTask.sdkSessionId}`);
  } catch (error) {
    console.error("\n❌ Test failed:");
    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error(error);
    }
    process.exit(1);
  }
}

// メイン実行
if (require.main === module) {
  testSdkContinueDebug()
    .then(() => {
      console.log("\n✨ Test completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Test execution error:", error);
      process.exit(1);
    });
}

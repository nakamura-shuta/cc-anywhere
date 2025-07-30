#!/usr/bin/env tsx
/**
 * continueSessionオプションのテスト
 * 最新のセッションを継続できるか確認
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

async function testContinueSession() {
  console.log("=== continueSession Option Test ===\n");

  try {
    // 1. 最初のタスクを作成
    console.log("1. Creating initial task...");
    const { data: firstTask } = await api.post<TaskResponse>("/api/tasks", {
      instruction: "Remember the number 42",
      context: {
        workingDirectory: process.cwd(),
      },
      options: {
        timeout: 60000,
        async: false,
        sdk: {
          maxTurns: 1,
          permissionMode: "allow",
        },
      },
    });

    console.log(`✓ First task created: ${firstTask.taskId}`);
    console.log(
      `  Result: ${typeof firstTask.result === "string" ? firstTask.result : JSON.stringify(firstTask.result)}`,
    );
    console.log(`  SDK Session ID: ${firstTask.sdkSessionId}`);

    // 2. continueSession: true で継続
    console.log("\n2. Continuing with continueSession: true...");
    const { data: continueTask } = await api.post<TaskResponse>("/api/tasks", {
      instruction: "What number did I ask you to remember?",
      context: {
        workingDirectory: process.cwd(),
      },
      options: {
        timeout: 60000,
        async: false,
        sdk: {
          maxTurns: 1,
          permissionMode: "allow",
          continueSession: true, // 最新セッションを継続
        },
      },
    });

    console.log(`✓ Continue task created: ${continueTask.taskId}`);
    console.log(
      `  Result: ${typeof continueTask.result === "string" ? continueTask.result : JSON.stringify(continueTask.result)}`,
    );
    console.log(`  SDK Session ID: ${continueTask.sdkSessionId}`);

    // 結果の確認
    console.log("\n3. Analyzing results...");
    let resultStr: string;
    if (typeof continueTask.result === "string") {
      resultStr = continueTask.result;
    } else if (typeof continueTask.result === "object" && continueTask.result !== null) {
      const values = Object.values(continueTask.result);
      resultStr = values.join("");
    } else {
      resultStr = String(continueTask.result);
    }

    const remembers42 = resultStr.includes("42");

    if (remembers42) {
      console.log("✅ Success! Claude remembers the number 42 from the previous conversation.");
    } else {
      console.log("❌ Failed! Claude doesn't remember the number 42.");
      console.log(
        `   - Actual response: "${resultStr.substring(0, 200)}${resultStr.length > 200 ? "..." : ""}"`,
      );
    }

    // セッションIDの比較
    console.log("\n4. Session ID comparison:");
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
  testContinueSession()
    .then(() => {
      console.log("\n✨ Test completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Test execution error:", error);
      process.exit(1);
    });
}

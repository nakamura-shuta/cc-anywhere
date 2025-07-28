#!/usr/bin/env tsx
/**
 * セッションチェーンのテスト
 * 最新のセッションIDを追跡して継続できるか確認
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

async function testSessionChain() {
  console.log("=== Session Chain Test ===\n");
  console.log("Testing if we can maintain conversation by tracking latest session IDs\n");

  try {
    let latestSessionId: string | undefined;
    const conversation: string[] = [];

    // 1. 最初のタスク
    console.log("1. First task - Remember a list...");
    const { data: task1 } = await api.post<TaskResponse>("/api/tasks", {
      instruction: "Remember these items: apple, banana, cherry",
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

    console.log(`✓ Task 1 completed`);
    console.log(`  Session ID: ${task1.sdkSessionId}`);
    latestSessionId = task1.sdkSessionId;
    conversation.push(`Task 1 Session: ${latestSessionId}`);

    // 2. 2番目のタスク - 最新のセッションIDで継続
    console.log("\n2. Second task - Add an item...");
    const { data: task2 } = await api.post<TaskResponse>("/api/tasks", {
      instruction: "Add 'date' to the list",
      context: {
        workingDirectory: process.cwd(),
      },
      options: {
        timeout: 60000,
        async: false,
        sdk: {
          maxTurns: 1,
          permissionMode: "allow",
          resumeSession: latestSessionId, // 最新のセッションIDを使用
        },
      },
    });

    console.log(`✓ Task 2 completed`);
    console.log(`  Previous Session: ${latestSessionId}`);
    console.log(`  New Session ID: ${task2.sdkSessionId}`);
    console.log(`  Session changed: ${latestSessionId !== task2.sdkSessionId}`);
    latestSessionId = task2.sdkSessionId; // 最新のセッションIDを更新
    conversation.push(`Task 2 Session: ${latestSessionId}`);

    // 3. 3番目のタスク - さらに最新のセッションIDで継続
    console.log("\n3. Third task - Recall the list...");
    const { data: task3 } = await api.post<TaskResponse>("/api/tasks", {
      instruction: "What items are in the list now?",
      context: {
        workingDirectory: process.cwd(),
      },
      options: {
        timeout: 60000,
        async: false,
        sdk: {
          maxTurns: 1,
          permissionMode: "allow",
          resumeSession: latestSessionId, // 最新のセッションIDを使用
        },
      },
    });

    console.log(`✓ Task 3 completed`);
    console.log(`  Previous Session: ${latestSessionId}`);
    console.log(`  New Session ID: ${task3.sdkSessionId}`);
    console.log(`  Session changed: ${latestSessionId !== task3.sdkSessionId}`);

    // 結果の分析
    console.log("\n4. Analyzing results...");
    let resultStr: string;
    if (typeof task3.result === "string") {
      resultStr = task3.result;
    } else if (typeof task3.result === "object" && task3.result !== null) {
      const values = Object.values(task3.result);
      resultStr = values.join("");
    } else {
      resultStr = String(task3.result);
    }

    console.log(`\nFinal response: "${resultStr}"`);

    const hasOriginalItems =
      resultStr.includes("apple") && resultStr.includes("banana") && resultStr.includes("cherry");
    const hasAddedItem = resultStr.includes("date");

    if (hasOriginalItems && hasAddedItem) {
      console.log("\n✅ Success! Claude maintained the conversation across multiple tasks.");
      console.log("   - Remembered original items: apple, banana, cherry");
      console.log("   - Remembered added item: date");
    } else {
      console.log("\n❌ Failed! Claude lost some context.");
      console.log(`   - Has original items: ${hasOriginalItems}`);
      console.log(`   - Has added item: ${hasAddedItem}`);
    }

    // セッションチェーンの表示
    console.log("\n5. Session Chain:");
    conversation.push(`Task 3 Session: ${task3.sdkSessionId}`);
    conversation.forEach((c) => console.log(`  ${c}`));
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
  testSessionChain()
    .then(() => {
      console.log("\n✨ Test completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Test execution error:", error);
      process.exit(1);
    });
}

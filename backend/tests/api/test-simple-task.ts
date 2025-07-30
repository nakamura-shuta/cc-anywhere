#!/usr/bin/env tsx
/**
 * シンプルなタスク実行テスト
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

async function testSimpleTask() {
  console.log("=== Simple Task Test ===\n");

  try {
    console.log("Creating a simple task...");
    const { data } = await api.post("/api/tasks", {
      instruction: "Please say hello",
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

    console.log("\nTask Response:");
    console.log("- Task ID:", data.taskId);
    console.log("- Status:", data.status);
    console.log("- Result:", data.result);
    console.log("- SDK Session ID:", data.sdkSessionId);
    console.log("- Error:", data.error);

    if (data.error) {
      console.error("\n❌ Task failed with error:", data.error);
    }
  } catch (error: any) {
    console.error("\n❌ Request failed:");
    if (error.response) {
      console.error("Status:", error.response.status);
      console.error("Data:", error.response.data);
    } else {
      console.error(error.message);
    }
  }
}

// メイン実行
testSimpleTask()
  .then(() => {
    console.log("\n✨ Test completed");
  })
  .catch((error) => {
    console.error("Test execution error:", error);
    process.exit(1);
  });

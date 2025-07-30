#!/usr/bin/env node

/**
 * 認証テストを別プロセスで実行するスクリプト
 * 環境変数の完全な分離を保証
 */

import { spawn } from "child_process";
import path from "path";

const testFiles = ["tests/auth/qr-auth.test.ts"];

async function runAuthTests() {
  console.log("🔐 認証テストを実行中...\n");

  for (const testFile of testFiles) {
    console.log(`📝 実行中: ${testFile}`);

    try {
      await runTest(testFile);
      console.log(`✅ ${testFile} 成功\n`);
    } catch (error) {
      console.error(`❌ ${testFile} 失敗\n`);
      process.exit(1);
    }
  }

  console.log("🎉 すべての認証テストが成功しました！");
}

function runTest(testFile: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // QR認証テスト用の環境変数を設定
    const env = {
      ...process.env,
      NODE_ENV: "test",
      QR_AUTH_ENABLED: "true",
      QR_AUTH_TOKEN: "test-auth-token-12345",
      API_KEY: "",
      PORT: "5002", // 別のポートを使用
    };

    const child = spawn("npx", ["vitest", "run", testFile], {
      env,
      stdio: "inherit",
      cwd: path.resolve(__dirname, "../.."),
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Test exited with code ${code}`));
      }
    });
  });
}

// スクリプトを実行
runAuthTests().catch((error) => {
  console.error("エラー:", error);
  process.exit(1);
});

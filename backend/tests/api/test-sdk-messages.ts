#!/usr/bin/env tsx
/**
 * Claude Code SDK のメッセージを詳細に確認
 */

import { query } from "@anthropic-ai/claude-code";
import { config as dotenvConfig } from "dotenv";

// Load environment variables
dotenvConfig();

async function checkSDKMessages() {
  console.log("===== Claude Code SDK メッセージ調査 =====");
  
  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) {
    console.error("CLAUDE_API_KEY が設定されていません");
    return;
  }

  console.log("API Key: 設定済み");

  try {
    console.log("\n1. Claude Code SDK 直接呼び出し");
    
    let messageCount = 0;
    const messages = [];
    
    for await (const message of query({
      prompt: "Say hello briefly.",
      options: {
        maxTurns: 1,
      },
    })) {
      messageCount++;
      console.log(`\n--- メッセージ ${messageCount} ---`);
      console.log("Type:", message.type);
      console.log("Full message:", JSON.stringify(message, null, 2));
      
      // sessionId の有無を確認
      if ('sessionId' in message) {
        console.log(">>> SESSION ID FOUND:", (message as any).sessionId);
      }
      
      messages.push(message);
    }
    
    console.log(`\n2. 受信したメッセージ総数: ${messageCount}`);
    
    // 全メッセージのキーを確認
    console.log("\n3. 各メッセージのキー一覧:");
    messages.forEach((msg, index) => {
      console.log(`メッセージ ${index + 1} のキー:`, Object.keys(msg));
    });

  } catch (error) {
    console.error("\nエラー発生:", error);
  }
}

// メイン実行
void (async () => {
  await checkSDKMessages();
})();
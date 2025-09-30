#!/usr/bin/env tsx

import { query } from "@anthropic-ai/claude-agent-sdk";

// 色付きログ出力
const log = {
  info: (msg: string) => console.log(`\x1b[36m[INFO]\x1b[0m ${msg}`),
  success: (msg: string) => console.log(`\x1b[32m[SUCCESS]\x1b[0m ${msg}`),
  error: (msg: string) => console.log(`\x1b[31m[ERROR]\x1b[0m ${msg}`),
  warn: (msg: string) => console.log(`\x1b[33m[WARN]\x1b[0m ${msg}`),
  result: (msg: string) => console.log(`\x1b[35m[RESULT]\x1b[0m ${msg}`),
};

async function testWithoutContinue() {
  log.info("===== continue: false（または指定なし）のテスト =====");

  try {
    // 1. 最初の会話
    log.info("\n1. 最初の質問: フィボナッチ数列について");
    // let firstResponse = "";

    for await (const message of query({
      prompt: "フィボナッチ数列の最初の10項を教えてください",
      options: {
        maxTurns: 2,
        cwd: process.cwd(),
      },
    })) {
      if (message.type === "assistant") {
        const textContent = extractTextContent(message);
        if (textContent) {
          // firstResponse = textContent;
          log.success("回答を受信");
          log.result(textContent.substring(0, 150) + "...");
        }
      }
    }

    // 2. 続きの会話（continue なし）
    log.info("\n2. 続きの質問: 第10項について（continue: false）");
    // let secondResponse = "";

    for await (const message of query({
      prompt: "今教えてもらった数列の第10項は何でしたか？",
      options: {
        continue: false, // 明示的にfalse（または省略）
        maxTurns: 2,
      },
    })) {
      if (message.type === "assistant") {
        const textContent = extractTextContent(message);
        if (textContent) {
          // secondResponse = textContent;
          log.success("回答を受信");
          log.result(textContent.substring(0, 200) + "...");

          // 結果の分析
          if (textContent.includes("55") || textContent.includes("５５")) {
            log.error("❌ 前の会話を覚えているようです（予期しない動作）");
          } else if (
            textContent.includes("申し訳") ||
            textContent.includes("わかりません") ||
            textContent.includes("教えて") ||
            textContent.includes("不明")
          ) {
            log.success("✅ 期待通り: 前の会話を覚えていません");
          } else {
            log.warn("⚠️  回答が曖昧です");
          }
        }
      }
    }
  } catch (error: any) {
    log.error(`エラー: ${error.message}`);
  }
}

async function testWithContinue() {
  log.info("\n\n===== continue: true のテスト =====");

  try {
    // 1. 最初の会話
    log.info("\n1. 最初の質問: フィボナッチ数列について");
    // let firstResponse = "";

    for await (const message of query({
      prompt: "フィボナッチ数列の最初の10項を教えてください",
      options: {
        maxTurns: 2,
        cwd: process.cwd(),
      },
    })) {
      if (message.type === "assistant") {
        const textContent = extractTextContent(message);
        if (textContent) {
          // firstResponse = textContent;
          log.success("回答を受信");
          log.result(textContent.substring(0, 150) + "...");
        }
      }
    }

    // 2. 続きの会話（continue あり）
    log.info("\n2. 続きの質問: 第10項について（continue: true）");
    // let secondResponse = "";

    for await (const message of query({
      prompt: "今教えてもらった数列の第10項は何でしたか？",
      options: {
        continue: true, // 会話を継続
        maxTurns: 2,
      },
    })) {
      if (message.type === "assistant") {
        const textContent = extractTextContent(message);
        if (textContent) {
          // secondResponse = textContent;
          log.success("回答を受信");
          log.result(textContent.substring(0, 200) + "...");

          // 結果の分析
          if (textContent.includes("55") || textContent.includes("５５")) {
            log.success("✅ 期待通り: 前の会話を覚えています（第10項は55）");
          } else if (textContent.includes("34") || textContent.includes("３４")) {
            log.warn("⚠️  第9項（34）について言及していますが、第10項ではありません");
          } else if (textContent.includes("申し訳") || textContent.includes("わかりません")) {
            log.error("❌ 前の会話を覚えていません（予期しない動作）");
          } else {
            log.warn("⚠️  回答が曖昧です");
          }
        }
      }
    }
  } catch (error: any) {
    log.error(`エラー: ${error.message}`);
  }
}

function extractTextContent(message: any): string | null {
  if (message.type === "assistant" && message.message?.content) {
    const textParts: string[] = [];
    for (const content of message.message.content) {
      if (content.type === "text" && content.text) {
        textParts.push(content.text);
      }
    }
    return textParts.length > 0 ? textParts.join("\n") : null;
  }
  return null;
}

async function runComparison() {
  log.info("===== Continue オプション比較テスト開始 =====");
  log.info("同じ質問に対して、continue: true/false の違いを確認します");

  // continue なしのテスト
  await testWithoutContinue();

  // 少し待機
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // continue ありのテスト
  await testWithContinue();

  log.info("\n\n===== 比較結果まとめ =====");
  log.info("continue: false → 前の会話を覚えていない（新しいセッション）");
  log.info("continue: true  → 前の会話を覚えている（セッション継続）");
}

// メイン実行
void (async () => {
  try {
    await runComparison();
    process.exit(0);
  } catch (error) {
    log.error("テスト失敗", error);
    process.exit(1);
  }
})();

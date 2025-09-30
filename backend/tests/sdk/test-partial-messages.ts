#!/usr/bin/env tsx

import { query } from "@anthropic-ai/claude-agent-sdk";

// 色付きログ出力
const log = {
  info: (msg: string) => console.log(`\x1b[36m[INFO]\x1b[0m ${msg}`),
  success: (msg: string) => console.log(`\x1b[32m[SUCCESS]\x1b[0m ${msg}`),
  error: (msg: string) => console.log(`\x1b[31m[ERROR]\x1b[0m ${msg}`),
  warn: (msg: string) => console.log(`\x1b[33m[WARN]\x1b[0m ${msg}`),
  partial: (msg: string) => console.log(`\x1b[35m[PARTIAL]\x1b[0m ${msg}`),
};

async function testPartialMessages() {
  log.info("===== Partial Message Streaming テスト開始 =====");
  log.info("v1.0.109で追加された部分メッセージストリーミング機能をテスト");

  try {
    // 1. 部分メッセージを含む通常のクエリ
    log.info("\n1. includePartialMessages オプションを有効にしてクエリ実行");

    const messageTypes = new Set<string>();
    let partialMessageCount = 0;
    let completeMessageCount = 0;

    for await (const message of query({
      prompt:
        "フィボナッチ数列の最初の20項を計算して、一つずつ順番に表示してください。各項の計算過程も説明してください。",
      options: {
        maxTurns: 2,
        cwd: process.cwd(),
        // 新しいオプション: 部分メッセージを含める
        includePartialMessages: true,
      },
    })) {
      // メッセージタイプを収集
      messageTypes.add(message.type);

      // メッセージの詳細をログ
      if (message.type === "assistant") {
        const assistantMsg = message as any;

        // 部分メッセージかどうかチェック
        if (assistantMsg.partial || assistantMsg.isPartial) {
          partialMessageCount++;
          log.partial(`部分メッセージ受信 #${partialMessageCount}`);

          // 部分メッセージの内容を表示（最初の100文字）
          if (assistantMsg.message?.content) {
            for (const content of assistantMsg.message.content) {
              if (content.type === "text" && content.text) {
                const preview = content.text.substring(0, 100);
                log.info(`  内容プレビュー: ${preview}...`);
              }
            }
          }
        } else {
          completeMessageCount++;
          log.success(`完全なメッセージ受信 #${completeMessageCount}`);
        }
      } else if (message.type === "partial" || message.type === "stream") {
        // 新しいメッセージタイプの可能性
        partialMessageCount++;
        log.partial(`ストリーミングメッセージ受信: ${message.type}`);
        log.info(`  メッセージ構造: ${JSON.stringify(Object.keys(message))}`);
      }

      // デバッグ: 最初の数メッセージの構造を詳しく表示
      if (partialMessageCount + completeMessageCount <= 3) {
        log.info(`メッセージ #${partialMessageCount + completeMessageCount}:`);
        log.info(`  タイプ: ${message.type}`);
        log.info(`  キー: ${Object.keys(message).join(", ")}`);
      }
    }

    log.info("\n===== 結果サマリー =====");
    log.info(`受信したメッセージタイプ: ${Array.from(messageTypes).join(", ")}`);
    log.info(`部分メッセージ数: ${partialMessageCount}`);
    log.info(`完全メッセージ数: ${completeMessageCount}`);

    // 2. 部分メッセージなしの比較テスト
    log.info("\n2. includePartialMessages を無効にして同じクエリを実行（比較用）");

    const normalMessageTypes = new Set<string>();
    let normalMessageCount = 0;

    for await (const message of query({
      prompt: "1から5までの数字を順番に表示してください。",
      options: {
        maxTurns: 1,
        cwd: process.cwd(),
        includePartialMessages: false, // 明示的に無効化
      },
    })) {
      normalMessageTypes.add(message.type);
      normalMessageCount++;
    }

    log.info(`通常モード - 受信メッセージ数: ${normalMessageCount}`);
    log.info(`通常モード - メッセージタイプ: ${Array.from(normalMessageTypes).join(", ")}`);

    log.info("\n===== テスト完了 =====");
    log.success("部分メッセージストリーミング機能のテストが完了しました");
  } catch (error: any) {
    log.error(`テストエラー: ${error.message}`);
    console.error(error.stack);
  }
}

// メイン実行
void (async () => {
  try {
    await testPartialMessages();
    process.exit(0);
  } catch (error) {
    log.error("テスト失敗", error);
    process.exit(1);
  }
})();

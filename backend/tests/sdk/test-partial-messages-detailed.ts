#!/usr/bin/env tsx

import { query } from "@anthropic-ai/claude-agent-sdk";

// 色付きログ出力
const log = {
  info: (msg: string) => console.log(`\x1b[36m[INFO]\x1b[0m ${msg}`),
  success: (msg: string) => console.log(`\x1b[32m[SUCCESS]\x1b[0m ${msg}`),
  error: (msg: string) => console.log(`\x1b[31m[ERROR]\x1b[0m ${msg}`),
  warn: (msg: string) => console.log(`\x1b[33m[WARN]\x1b[0m ${msg}`),
  stream: (msg: string) => console.log(`\x1b[35m[STREAM]\x1b[0m ${msg}`),
};

async function testStreamEvents() {
  log.info("===== Stream Event 詳細分析 =====");
  log.info("stream_eventタイプのメッセージを詳しく分析");

  try {
    const streamEvents: any[] = [];
    const messageTimeline: Array<{ time: number; type: string; event?: string }> = [];
    const startTime = Date.now();

    for await (const message of query({
      prompt: "こんにちは。簡単に自己紹介してください（50文字程度で）。",
      options: {
        maxTurns: 1,
        cwd: process.cwd(),
        includePartialMessages: true,
      },
    })) {
      const timestamp = Date.now() - startTime;
      messageTimeline.push({
        time: timestamp,
        type: message.type,
        event: (message as any).event,
      });

      if (message.type === "stream_event") {
        streamEvents.push(message);

        // 最初の数イベントを詳しく表示
        if (streamEvents.length <= 5) {
          log.stream(`イベント #${streamEvents.length}:`);
          const eventData = message as any;
          log.info(`  event: ${JSON.stringify(eventData.event)}`);
          log.info(`  全キー: ${Object.keys(eventData).join(", ")}`);

          // イベント固有のデータを表示
          if (eventData.content) {
            log.info(`  content: ${JSON.stringify(eventData.content).substring(0, 100)}...`);
          }
          if (eventData.delta) {
            log.info(`  delta: ${JSON.stringify(eventData.delta).substring(0, 100)}...`);
          }
          if (eventData.chunk) {
            log.info(`  chunk: ${JSON.stringify(eventData.chunk).substring(0, 100)}...`);
          }
        }
      }
    }

    log.info("\n===== ストリーミングイベント分析 =====");
    log.info(`総ストリームイベント数: ${streamEvents.length}`);

    // イベントタイプの集計
    const eventTypes = new Map<string, number>();
    streamEvents.forEach((event) => {
      const eventType = JSON.stringify(event.event) || "unknown";
      eventTypes.set(eventType, (eventTypes.get(eventType) || 0) + 1);
    });

    log.info("\nイベントタイプ別カウント:");
    eventTypes.forEach((count, type) => {
      log.info(`  ${type}: ${count}回`);
    });

    // タイムライン分析
    log.info("\n===== メッセージタイムライン =====");
    log.info("最初の10メッセージ:");
    messageTimeline.slice(0, 10).forEach((item, idx) => {
      const eventStr = item.event ? ` (${JSON.stringify(item.event)})` : "";
      log.info(`  ${idx + 1}. [${item.time}ms] ${item.type}${eventStr}`);
    });

    // パフォーマンス比較テスト
    log.info("\n===== パフォーマンス比較 =====");

    // ストリーミングあり
    const streamStartTime = Date.now();
    let streamFirstResponseTime = 0;
    let streamCompleteTime = 0;

    for await (const message of query({
      prompt: "1から10までの数字を表示してください",
      options: {
        maxTurns: 1,
        cwd: process.cwd(),
        includePartialMessages: true,
      },
    })) {
      if (!streamFirstResponseTime && message.type === "stream_event") {
        streamFirstResponseTime = Date.now() - streamStartTime;
      }
      if (message.type === "assistant") {
        streamCompleteTime = Date.now() - streamStartTime;
      }
    }

    log.info(`ストリーミングあり:`);
    log.info(`  最初のイベントまで: ${streamFirstResponseTime}ms`);
    log.info(`  完全な応答まで: ${streamCompleteTime}ms`);

    // ストリーミングなし
    const normalStartTime = Date.now();
    let normalResponseTime = 0;

    for await (const message of query({
      prompt: "1から10までの数字を表示してください",
      options: {
        maxTurns: 1,
        cwd: process.cwd(),
        includePartialMessages: false,
      },
    })) {
      if (message.type === "assistant") {
        normalResponseTime = Date.now() - normalStartTime;
        break;
      }
    }

    log.info(`\nストリーミングなし:`);
    log.info(`  応答まで: ${normalResponseTime}ms`);

    log.info("\n===== 分析完了 =====");
    log.success("ストリーミングイベントの詳細分析が完了しました");
  } catch (error: any) {
    log.error(`テストエラー: ${error.message}`);
    console.error(error.stack);
  }
}

// メイン実行
void (async () => {
  try {
    await testStreamEvents();
    process.exit(0);
  } catch (error) {
    log.error("テスト失敗", error);
    process.exit(1);
  }
})();

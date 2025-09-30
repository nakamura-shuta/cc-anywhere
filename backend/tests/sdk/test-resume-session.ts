#!/usr/bin/env tsx

import { query } from "@anthropic-ai/claude-agent-sdk";
// import * as fs from "fs";
// import * as path from "path";
// import { fileURLToPath } from "url";

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

// 色付きログ出力
const log = {
  info: (msg: string) => console.log(`\x1b[36m[INFO]\x1b[0m ${msg}`),
  success: (msg: string) => console.log(`\x1b[32m[SUCCESS]\x1b[0m ${msg}`),
  error: (msg: string) => console.log(`\x1b[31m[ERROR]\x1b[0m ${msg}`),
  warn: (msg: string) => console.log(`\x1b[33m[WARN]\x1b[0m ${msg}`),
};

// セッションディレクトリ
// const SESSION_DIR = path.join(process.cwd(), ".claude", "sessions");

// セッションIDを取得
// function getLatestSessionId(): string | null {
//   try {
//     if (!fs.existsSync(SESSION_DIR)) {
//       return null;
//     }
//
//     const files = fs.readdirSync(SESSION_DIR);
//     const sessionFiles = files.filter((f) => f.endsWith(".json"));
//
//     if (sessionFiles.length === 0) {
//       return null;
//     }
//
//     // 最新のセッションファイルを取得
//     const latest = sessionFiles
//       .map((f) => ({
//         name: f,
//         time: fs.statSync(path.join(SESSION_DIR, f)).mtime.getTime(),
//       }))
//       .sort((a, b) => b.time - a.time)[0];
//
//     return latest.name.replace(".json", "");
//   } catch (error) {
//     log.error(`Failed to get session ID: ${error}`);
//     return null;
//   }
// }

async function testResumeSession() {
  log.info("===== Claude Code SDK resumeSession テスト開始 =====");

  try {
    // 1. 最初の会話を開始（新規セッション）
    log.info("\n1. 新規セッションで最初の会話を開始");

    const firstMessages: any[] = [];
    let sessionId: string | null = null;

    for await (const message of query({
      prompt:
        "こんにちは！私は数学の問題を解きたいです。フィボナッチ数列の最初の10項を教えてください。",
      options: {
        maxTurns: 2,
        cwd: process.cwd(),
      },
    })) {
      firstMessages.push(message);

      // セッションIDを探す
      if (message.sessionId) {
        sessionId = message.sessionId;
        log.info(`セッションID検出: ${sessionId}`);
      }

      if (message.type === "assistant") {
        log.success("Claude応答受信");
      }

      // デバッグ: メッセージ構造を確認
      if (firstMessages.length === 1) {
        log.info(`最初のメッセージタイプ: ${message.type}`);
        log.info(`メッセージキー: ${Object.keys(message).join(", ")}`);
      }
    }

    log.success(`最初の会話完了: ${firstMessages.length}メッセージ`);

    // セッションIDが取得できなかった場合は、仮のIDを使用
    if (!sessionId) {
      log.warn("セッションIDが自動取得できませんでした。仮のIDでテストを続行します");
      sessionId = "test-session-" + Date.now();
    }

    log.info(`\n使用するセッションID: ${sessionId}`);

    // 2. resumeSessionを使用して会話を継続
    log.info("\n2. resumeSessionを使用して会話を継続");

    const resumeMessages: any[] = [];
    try {
      for await (const message of query({
        prompt: "ありがとうございます。今教えてもらったフィボナッチ数列の第10項は何でしたか？",
        options: {
          resume: sessionId,
          maxTurns: 2,
          cwd: process.cwd(),
        },
      })) {
        resumeMessages.push(message);
        if (message.type === "assistant") {
          log.success("Resume応答受信");

          // 応答内容を確認
          const assistantMsg = message as any;
          if (assistantMsg.message?.content) {
            for (const content of assistantMsg.message.content) {
              if (content.type === "text" && content.text) {
                const text = content.text.substring(0, 200);
                log.info(`応答内容: ${text}...`);

                // フィボナッチ数列の第10項（55）が含まれているか確認
                if (text.includes("55")) {
                  log.success("✅ 前の会話を正しく覚えています！");
                } else if (text.includes("フィボナッチ") || text.includes("数列")) {
                  log.warn(
                    "フィボナッチ数列について言及していますが、具体的な値は含まれていません",
                  );
                } else {
                  log.warn("前の会話の内容を覚えていない可能性があります");
                }
              }
            }
          }
        }
      }

      log.success(`Resume会話完了: ${resumeMessages.length}メッセージ`);
    } catch (error: any) {
      log.error(`Resume実行エラー: ${error.message}`);
      if (error.stack) {
        console.error(error.stack);
      }
    }

    // 3. continueを使用してみる
    log.info("\n3. continueオプションを使用して会話を継続");

    const continueMessages: any[] = [];
    try {
      for await (const message of query({
        prompt: "さらに、フィボナッチ数列と黄金比の関係について教えてください。",
        options: {
          continue: true,
          maxTurns: 2,
          cwd: process.cwd(),
        },
      })) {
        continueMessages.push(message);
        if (message.type === "assistant") {
          log.success("Continue応答受信");
        }
      }

      log.success(`Continue会話完了: ${continueMessages.length}メッセージ`);
    } catch (error: any) {
      log.error(`Continue実行エラー: ${error.message}`);
      if (error.stack) {
        console.error(error.stack);
      }
    }

    log.info("\n===== テスト完了 =====");
  } catch (error: any) {
    log.error(`テストエラー: ${error.message}`);
    console.error(error.stack);
  }
}

// メイン実行
void (async () => {
  try {
    await testResumeSession();
    process.exit(0);
  } catch (error) {
    log.error("テスト失敗", error);
    process.exit(1);
  }
})();

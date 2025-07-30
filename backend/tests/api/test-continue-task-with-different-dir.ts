#!/usr/bin/env node
/**
 * 継続タスクで異なる作業ディレクトリを指定するテスト
 */

import { apiClient } from "../utils/api-client";
import type { TaskResponse } from "../../src/types/task";

async function testContinueTaskWithDifferentDirectory() {
  console.log("=== 継続タスクで異なる作業ディレクトリを指定するテスト ===\n");

  try {
    // 1. 親タスクを作成（最初の作業ディレクトリ）
    console.log("1. 親タスクを作成中...");
    const parentDir = "/tmp/test-parent-dir";
    const parentTask = await apiClient.post<TaskResponse>("/api/tasks", {
      instruction: "Create a simple test.txt file with 'Hello from parent' content",
      context: {
        workingDirectory: parentDir,
      },
      options: {
        timeout: 60000,
        async: false,
      },
    });

    console.log(`✓ 親タスク作成完了: ${parentTask.taskId}`);
    console.log(`  作業ディレクトリ: ${parentDir}`);
    console.log(`  ステータス: ${parentTask.status}`);

    // 2. 継続タスクを作成（異なる作業ディレクトリ）
    console.log("\n2. 継続タスクを作成中（異なる作業ディレクトリ）...");
    const childDir = "/tmp/test-child-dir";
    const continueTask = await apiClient.post<TaskResponse>(
      `/api/tasks/${parentTask.taskId}/continue`,
      {
        instruction:
          "Create another test.txt file with 'Hello from child' content in the new directory",
        context: {
          workingDirectory: childDir,
        },
        options: {
          timeout: 60000,
          async: false,
        },
      },
    );

    console.log(`✓ 継続タスク作成完了: ${continueTask.taskId}`);
    console.log(`  作業ディレクトリ: ${childDir}`);
    console.log(`  ステータス: ${continueTask.status}`);
    console.log(`  親タスクID: ${continueTask.continuedFrom}`);

    // 3. 結果の確認
    if (continueTask.status === "completed") {
      console.log("\n✅ テスト成功！");
      console.log("継続タスクで異なる作業ディレクトリを指定できることを確認しました。");
    } else if (continueTask.error) {
      console.error("\n❌ タスクエラー:", continueTask.error);
    }

    // 4. タスクの詳細を取得して確認
    console.log("\n3. タスクの詳細を確認中...");
    const taskDetail = await apiClient.get<TaskResponse>(`/api/tasks/${continueTask.taskId}`);

    console.log(`\n継続タスクの詳細:`);
    console.log(`- タスクID: ${taskDetail.taskId}`);
    console.log(`- 作業ディレクトリ: ${taskDetail.workingDirectory}`);
    console.log(`- 親タスクから継続: ${taskDetail.continuedFrom}`);
    console.log(`- SDKセッションID: ${taskDetail.sdkSessionId}`);
  } catch (error) {
    console.error("\n❌ テスト失敗:");
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
  testContinueTaskWithDifferentDirectory()
    .then(() => {
      console.log("\n✨ すべてのテストが完了しました");
      process.exit(0);
    })
    .catch((error) => {
      console.error("テスト実行エラー:", error);
      process.exit(1);
    });
}

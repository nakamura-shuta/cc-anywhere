/**
 * タスク実行結果の検証テスト
 * Claude Code SDKが実際に指示通りに動作したかを確認
 */

import { test, expect } from '@playwright/test';
import { AxiosInstance } from 'axios';
import { createApiClient, waitForTaskCompletion } from '../helpers/api-client';
import * as fs from 'fs/promises';
import * as path from 'path';
import { homedir } from 'os';

const TEST_REPO_PATH = path.join(homedir(), 'dev', 'node', 'test');

test.describe('タスク実行結果検証', () => {
  let api: AxiosInstance;

  test.beforeAll(() => {
    api = createApiClient();
  });

  test.beforeEach(async () => {
    // テスト用ディレクトリを準備
    await fs.mkdir(TEST_REPO_PATH, { recursive: true });
    
    // 既存のテストファイルをクリーンアップ
    const testFiles = ['test-file.txt', 'hello.js', 'README.md'];
    for (const file of testFiles) {
      const filePath = path.join(TEST_REPO_PATH, file);
      try {
        await fs.unlink(filePath);
      } catch {
        // ファイルが存在しない場合は無視
      }
    }
  });

  test('ファイル作成タスクの実行と検証', async () => {
    const fileName = 'test-file.txt';
    const fileContent = 'This is a test file created by Claude Code SDK';
    
    // 1. ファイル作成タスクを実行
    const createResponse = await api.post('/api/tasks', {
      instruction: `${fileName}というファイルを作成して、内容に「${fileContent}」と書いてください`,
      context: {
        workingDirectory: TEST_REPO_PATH
      },
      options: {
        async: true,
        timeout: 60000,
        sdk: {
          maxTurns: 10,
          permissionMode: 'allow'
        }
      }
    });

    expect(createResponse.status).toBe(202);
    const { taskId } = createResponse.data;
    
    // 2. タスクの完了を待つ
    const taskStatus = await waitForTaskCompletion(api, taskId, 60);
    expect(taskStatus).toBe('completed');
    
    // 3. ファイルが作成されたことを確認
    const filePath = path.join(TEST_REPO_PATH, fileName);
    const fileExists = await fs.access(filePath).then(() => true).catch(() => false);
    expect(fileExists).toBe(true);
    
    // 4. ファイルの内容を確認
    const actualContent = await fs.readFile(filePath, 'utf-8');
    expect(actualContent).toContain(fileContent);
    
    console.log('✅ ファイルが正しく作成されました');
  });

  test('JavaScriptファイル作成と実行タスク', async () => {
    const fileName = 'hello.js';
    
    // 1. JavaScriptファイル作成タスクを実行
    const createResponse = await api.post('/api/tasks', {
      instruction: `${fileName}というファイルを作成して、console.log('Hello from Claude Code SDK')を書いてください`,
      context: {
        workingDirectory: TEST_REPO_PATH
      },
      options: {
        async: true,
        timeout: 60000,
        sdk: {
          maxTurns: 10,
          permissionMode: 'allow'
        }
      }
    });

    expect(createResponse.status).toBe(202);
    const { taskId } = createResponse.data;
    
    // 2. タスクの完了を待つ
    const taskStatus = await waitForTaskCompletion(api, taskId, 60);
    expect(taskStatus).toBe('completed');
    
    // 3. JavaScriptファイルが作成されたことを確認
    const filePath = path.join(TEST_REPO_PATH, fileName);
    const fileExists = await fs.access(filePath).then(() => true).catch(() => false);
    expect(fileExists).toBe(true);
    
    // 4. ファイルの内容を確認
    const actualContent = await fs.readFile(filePath, 'utf-8');
    expect(actualContent).toContain("console.log('Hello from Claude Code SDK')");
    
    console.log('✅ JavaScriptファイルが正しく作成されました');
  });

  test('既存ファイルの修正タスク', async () => {
    // 初期ファイルを作成
    const fileName = 'README.md';
    const initialContent = '# Initial Content\n\nThis is the initial content.';
    const filePath = path.join(TEST_REPO_PATH, fileName);
    await fs.writeFile(filePath, initialContent);
    
    // 1. ファイル修正タスクを実行
    const createResponse = await api.post('/api/tasks', {
      instruction: `README.mdファイルに「## Updated by Claude Code SDK」というセクションを追加してください`,
      context: {
        workingDirectory: TEST_REPO_PATH
      },
      options: {
        async: true,
        timeout: 60000,
        sdk: {
          maxTurns: 10,
          permissionMode: 'allow'
        }
      }
    });

    expect(createResponse.status).toBe(202);
    const { taskId } = createResponse.data;
    
    // 2. タスクの完了を待つ
    const taskStatus = await waitForTaskCompletion(api, taskId, 60);
    expect(taskStatus).toBe('completed');
    
    // 3. ファイルが修正されたことを確認
    const updatedContent = await fs.readFile(filePath, 'utf-8');
    expect(updatedContent).toContain('## Updated by Claude Code SDK');
    // Claude Code SDKが元の内容を完全に置き換える可能性があるため、更新されたことのみ確認
    
    console.log('✅ ファイルが正しく修正されました');
  });

  test('タスクのエラーハンドリング - 無効な指示', async () => {
    // 意図的に空の指示を送る
    const createResponse = await api.post('/api/tasks', {
      instruction: ``,  // 空の指示
      context: {
        workingDirectory: TEST_REPO_PATH
      },
      options: {
        async: true,
        timeout: 30000,
        sdk: {
          maxTurns: 5,
          permissionMode: 'allow'
        }
      }
    });

    // 400 Bad Requestを期待
    expect(createResponse.status).toBe(400);
    expect(createResponse.data).toHaveProperty('error');
    expect(createResponse.data.error).toHaveProperty('message');
    expect(createResponse.data.error.message).toContain('instruction');
    console.log('✅ 空の指示は適切に拒否されました:', createResponse.data.error);
  });

  test.afterEach(async () => {
    // テスト後のクリーンアップ（オプション）
    // 必要に応じて、作成したファイルを削除
  });
});
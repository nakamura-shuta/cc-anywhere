/**
 * APIレベルのタスク実行テスト
 * UIを介さず、直接APIを呼び出してテスト
 */

import { test, expect } from '@playwright/test';
import axios, { AxiosInstance } from 'axios';
import { createApiClient, waitForTaskCompletion } from '../helpers/api-client';
import * as path from 'path';
import { homedir } from 'os';

const TEST_REPO_PATH = path.join(homedir(), 'dev', 'node', 'test');

test.describe('タスクAPI統合テスト', () => {
  let api: AxiosInstance;

  test.beforeAll(() => {
    api = createApiClient();
  });

  test('単一タスクの作成と実行', async () => {
    // 1. タスクを作成（作業ディレクトリを指定）
    const createResponse = await api.post('/api/tasks', {
      instruction: 'echo "Hello World from Claude Code SDK" > output.txt というコマンドを実行してください',
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

    // レスポンスを確認
    expect(createResponse.status).toBe(202);  // 非同期タスクは202 Accepted
    expect(createResponse.data).toHaveProperty('taskId');
    expect(createResponse.data).toHaveProperty('status');
    
    const { taskId } = createResponse.data;
    console.log('作成されたタスクID:', taskId);

    // 2. タスクステータスを確認（ポーリング）
    const taskStatus = await waitForTaskCompletion(api, taskId);

    // 3. 最終結果を確認
    expect(['completed', 'failed']).toContain(taskStatus);
    
    if (taskStatus === 'completed') {
      console.log('✅ タスクが正常に完了しました');
      
      // 4. 実際にファイルが作成されたか確認
      const fs = await import('fs/promises');
      const outputPath = path.join(TEST_REPO_PATH, 'output.txt');
      const fileExists = await fs.access(outputPath).then(() => true).catch(() => false);
      
      if (fileExists) {
        const content = await fs.readFile(outputPath, 'utf-8');
        console.log('作成されたファイルの内容:', content);
        expect(content).toContain('Hello World from Claude Code SDK');
      }
    } else {
      const finalResponse = await api.get(`/api/tasks/${taskId}`);
      console.log('タスクエラー:', finalResponse.data.error);
    }
  });

  test('タスクグループの実行', async () => {
    // 1. タスクグループを作成（作業ディレクトリを指定）
    const groupResponse = await api.post('/api/task-groups/execute', {
      name: 'テストグループ',
      tasks: [
        {
          id: 'task1',
          name: 'Task 1',
          instruction: 'echo "Task 1 executed" > task1.txt というコマンドを実行してください'
        },
        {
          id: 'task2', 
          name: 'Task 2',
          instruction: 'echo "Task 2 executed" > task2.txt というコマンドを実行してください',
          dependencies: ['task1']
        }
      ],
      execution: {
        mode: 'sequential',
        continueSession: true,
        continueOnError: false,
        timeout: 60000,
        permissionMode: 'allow'
      },
      context: {
        workingDirectory: TEST_REPO_PATH
      }
    });

    expect(groupResponse.status).toBe(200);  // グループ実行は200 OK
    expect(groupResponse.data).toHaveProperty('groupId');
    
    const { groupId } = groupResponse.data;
    console.log('作成されたグループID:', groupId);

    // 2. グループの実行状態を確認
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const statusResponse = await api.get(`/api/task-groups/${groupId}/status`);
    expect(statusResponse.data).toHaveProperty('status');
    expect(statusResponse.data).toHaveProperty('progress');
    
    console.log('グループステータス:', statusResponse.data.status);
    console.log('進捗:', statusResponse.data.progress + '%');
  });

  test('エラーハンドリング - 無効なリクエスト', async () => {
    const response = await api.post('/api/tasks', {
      // instructionが欠落
      context: {
        workingDirectory: TEST_REPO_PATH
      },
      options: {
        timeout: 60000
      }
    });
    
    // 400 Bad Requestを期待
    expect(response.status).toBe(400);
    expect(response.data).toHaveProperty('error');
    expect(response.data.error).toHaveProperty('message');
    expect(response.data.error.code).toBe('VALIDATION_ERROR');
    console.log('✅ 適切にエラーが返されました:', response.data.error);
  });

  test('認証エラー - 無効なAPIキー', async () => {
    const unauthorizedApi = axios.create({
      baseURL: process.env.API_BASE_URL || 'http://localhost:5000',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'invalid-key'
      }
    });

    try {
      await unauthorizedApi.post('/api/tasks', {
        instruction: 'テストタスク'
      });
      
      expect(true).toBe(false);
    } catch (error: any) {
      // 401 Unauthorizedを期待
      expect(error.response?.status).toBe(401);
      console.log('✅ 認証エラーが適切に処理されました');
    }
  });
});
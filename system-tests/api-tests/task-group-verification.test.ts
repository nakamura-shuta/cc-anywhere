/**
 * タスクグループ実行結果の検証テスト
 * 複数タスクの連携と実行結果を確認
 */

import { test, expect } from '@playwright/test';
import { AxiosInstance } from 'axios';
import { createApiClient } from '../helpers/api-client';
import * as fs from 'fs/promises';
import * as path from 'path';
import { homedir } from 'os';

const TEST_REPO_PATH = path.join(homedir(), 'dev', 'node', 'test');

test.describe('タスクグループ実行検証', () => {
  let api: AxiosInstance;

  test.beforeAll(() => {
    api = createApiClient();
  });

  test.beforeEach(async () => {
    // テスト用ディレクトリを準備
    await fs.mkdir(TEST_REPO_PATH, { recursive: true });
    
    // プロジェクトファイルをクリーンアップ
    const projectFiles = ['package.json', 'index.js', 'utils.js', '.gitignore'];
    for (const file of projectFiles) {
      const filePath = path.join(TEST_REPO_PATH, file);
      try {
        await fs.unlink(filePath);
      } catch {
        // ファイルが存在しない場合は無視
      }
    }
  });

  test('順次実行タスクグループ - プロジェクト初期化', async () => {
    // 1. プロジェクト初期化のタスクグループを実行
    const groupResponse = await api.post('/api/task-groups/execute', {
      name: 'プロジェクト初期化',
      tasks: [
        {
          id: 'init-npm',
          name: 'NPMプロジェクト初期化',
          instruction: 'package.jsonファイルを作成して、name: "test-project", version: "1.0.0"を設定してください'
        },
        {
          id: 'create-index',
          name: 'メインファイル作成',
          instruction: 'index.jsを作成して、console.log("Hello from test project")を書いてください',
          dependencies: ['init-npm']
        },
        {
          id: 'create-gitignore',
          name: 'gitignore作成',
          instruction: '.gitignoreファイルを作成して、node_modulesを追加してください',
          dependencies: ['create-index']
        }
      ],
      execution: {
        mode: 'sequential',
        continueSession: true,
        continueOnError: false,
        timeout: 120000,
        permissionMode: 'allow'
      },
      context: {
        workingDirectory: TEST_REPO_PATH
      }
    });

    expect(groupResponse.status).toBe(200);
    expect(groupResponse.data).toHaveProperty('groupId');
    
    const { groupId } = groupResponse.data;
    console.log('タスクグループID:', groupId);
    
    // 2. グループの完了を待つ（最大2分）
    let groupStatus = 'running';
    let attempts = 0;
    const maxAttempts = 120;
    
    while (attempts < maxAttempts && !['completed', 'failed', 'cancelled'].includes(groupStatus)) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const statusResponse = await api.get(`/api/task-groups/${groupId}/status`);
      groupStatus = statusResponse.data.status;
      
      console.log(`グループステータス (${attempts + 1}/${maxAttempts}):`, groupStatus);
      console.log('進捗:', statusResponse.data.progress + '%');
      attempts++;
    }
    
    expect(groupStatus).toBe('completed');
    
    // 3. 各ファイルが作成されたことを確認
    const packageJsonPath = path.join(TEST_REPO_PATH, 'package.json');
    const packageJsonExists = await fs.access(packageJsonPath).then(() => true).catch(() => false);
    expect(packageJsonExists).toBe(true);
    
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
    expect(packageJson.name).toBe('test-project');
    expect(packageJson.version).toBe('1.0.0');
    
    const indexPath = path.join(TEST_REPO_PATH, 'index.js');
    const indexExists = await fs.access(indexPath).then(() => true).catch(() => false);
    expect(indexExists).toBe(true);
    
    const indexContent = await fs.readFile(indexPath, 'utf-8');
    expect(indexContent).toContain('console.log("Hello from test project")');
    
    const gitignorePath = path.join(TEST_REPO_PATH, '.gitignore');
    const gitignoreExists = await fs.access(gitignorePath).then(() => true).catch(() => false);
    expect(gitignoreExists).toBe(true);
    
    const gitignoreContent = await fs.readFile(gitignorePath, 'utf-8');
    expect(gitignoreContent).toContain('node_modules');
    
    console.log('✅ プロジェクトが正しく初期化されました');
  }, 120000);  // タイムアウトを2分に設定

  test('並列実行タスクグループ - 複数ファイル作成', async () => {
    // 1. 複数ファイルを並列で作成するタスクグループ
    const groupResponse = await api.post('/api/task-groups/execute', {
      name: '並列ファイル作成',
      tasks: [
        {
          id: 'file1',
          name: 'ファイル1作成',
          instruction: 'file1.txt を作成して「ファイル1の内容」と書いてください'
        },
        {
          id: 'file2',
          name: 'ファイル2作成',
          instruction: 'file2.txt を作成して「ファイル2の内容」と書いてください'
        },
        {
          id: 'file3',
          name: 'ファイル3作成',
          instruction: 'file3.txt を作成して「ファイル3の内容」と書いてください'
        }
      ],
      execution: {
        mode: 'parallel',
        continueSession: true,  // Changed to true as required by the type
        continueOnError: true,
        timeout: 60000,
        permissionMode: 'allow'
      },
      context: {
        workingDirectory: TEST_REPO_PATH
      }
    });

    expect(groupResponse.status).toBe(200);
    const { groupId } = groupResponse.data;
    
    // 2. グループの完了を待つ
    let groupStatus = 'running';
    let attempts = 0;
    const maxAttempts = 60;
    
    while (attempts < maxAttempts && !['completed', 'failed', 'cancelled'].includes(groupStatus)) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const statusResponse = await api.get(`/api/task-groups/${groupId}/status`);
      groupStatus = statusResponse.data.status;
      attempts++;
    }
    
    expect(groupStatus).toBe('completed');
    
    // 3. 全てのファイルが作成されたことを確認
    for (let i = 1; i <= 3; i++) {
      const filePath = path.join(TEST_REPO_PATH, `file${i}.txt`);
      const fileExists = await fs.access(filePath).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);
      
      const content = await fs.readFile(filePath, 'utf-8');
      expect(content).toContain(`ファイル${i}の内容`);
    }
    
    console.log('✅ 並列タスクが正しく実行されました');
  });

  test('依存関係のあるタスクグループ', async () => {
    // 1. 依存関係のあるタスクグループを実行
    const groupResponse = await api.post('/api/task-groups/execute', {
      name: 'モジュール作成',
      tasks: [
        {
          id: 'create-utils',
          name: 'ユーティリティ作成',
          instruction: 'utils.jsを作成して、exports.add = (a, b) => a + b; を書いてください'
        },
        {
          id: 'create-main',
          name: 'メインファイル作成',
          instruction: 'main.jsを作成して、const { add } = require("./utils"); console.log(add(2, 3)); を書いてください',
          dependencies: ['create-utils']  // utils.jsが先に作成される必要がある
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

    expect(groupResponse.status).toBe(200);
    const { groupId } = groupResponse.data;
    
    // 2. グループの完了を待つ
    let groupStatus = 'running';
    let attempts = 0;
    const maxAttempts = 60;
    
    while (attempts < maxAttempts && !['completed', 'failed', 'cancelled'].includes(groupStatus)) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const statusResponse = await api.get(`/api/task-groups/${groupId}/status`);
      groupStatus = statusResponse.data.status;
      
      // 個別タスクのステータスも確認
      if (statusResponse.data.tasks) {
        for (const task of statusResponse.data.tasks) {
          console.log(`  - ${task.name}: ${task.status}`);
        }
      }
      
      attempts++;
    }
    
    expect(groupStatus).toBe('completed');
    
    // 3. ファイルが正しく作成され、依存関係が機能することを確認
    const utilsPath = path.join(TEST_REPO_PATH, 'utils.js');
    const utilsExists = await fs.access(utilsPath).then(() => true).catch(() => false);
    expect(utilsExists).toBe(true);
    
    const mainPath = path.join(TEST_REPO_PATH, 'main.js');
    const mainExists = await fs.access(mainPath).then(() => true).catch(() => false);
    expect(mainExists).toBe(true);
    
    const mainContent = await fs.readFile(mainPath, 'utf-8');
    expect(mainContent).toContain('require("./utils")');
    expect(mainContent).toContain('add(2, 3)');
    
    console.log('✅ 依存関係のあるタスクが正しく実行されました');
  });
});
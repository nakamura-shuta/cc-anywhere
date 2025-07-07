#!/usr/bin/env node

/**
 * Git Worktree機能の動作確認用スクリプト
 * 
 * 使い方:
 * 1. .envファイルでENABLE_WORKTREE=trueに設定
 * 2. サーバーを起動: npm run dev
 * 3. このスクリプトを実行: node examples/test-worktree.js
 */

const API_KEY = process.env.API_KEY || 'test-api-key';
const BASE_URL = 'http://localhost:5000';

// 色付きコンソール出力
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  red: '\x1b[31m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// APIリクエストのヘルパー関数
async function apiRequest(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
      ...options.headers
    }
  });
  
  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}

// Worktreeを使用するタスクの例
async function testWorktreeTask() {
  log('\n=== Git Worktree機能テスト ===\n', 'bright');

  // 1. 通常のタスク（Worktreeなし）
  log('1. 通常のタスク実行（Worktreeなし）', 'yellow');
  const normalTask = {
    instruction: 'echo "Hello from normal execution" > test-normal.txt && pwd && ls -la',
    context: {
      workingDirectory: process.cwd()
    }
  };

  try {
    const normalResult = await apiRequest('/api/tasks', {
      method: 'POST',
      body: JSON.stringify(normalTask)
    });
    
    log(`タスクID: ${normalResult.taskId}`, 'blue');
    
    // タスク完了を待つ
    await waitForTaskCompletion(normalResult.taskId);
    
  } catch (error) {
    log(`エラー: ${error.message}`, 'red');
  }

  // 2. Worktreeを使用するタスク
  log('\n2. Worktree機能を使用したタスク実行', 'yellow');
  const worktreeTask = {
    instruction: `
      echo "Hello from worktree execution" > test-worktree.txt && 
      pwd && 
      git status && 
      git branch --show-current
    `,
    context: {
      workingDirectory: process.cwd()
    },
    options: {
      useWorktree: true  // Worktree機能を有効化
    }
  };

  try {
    const worktreeResult = await apiRequest('/api/tasks', {
      method: 'POST',
      body: JSON.stringify(worktreeTask)
    });
    
    log(`タスクID: ${worktreeResult.taskId}`, 'blue');
    
    // タスク完了を待つ
    await waitForTaskCompletion(worktreeResult.taskId);
    
  } catch (error) {
    log(`エラー: ${error.message}`, 'red');
  }

  // 3. Worktreeの詳細オプションを使用
  log('\n3. Worktreeの詳細オプションを使用したタスク実行', 'yellow');
  const advancedWorktreeTask = {
    instruction: `
      echo "Testing advanced worktree options" > advanced-test.txt &&
      git add . &&
      git status
    `,
    context: {
      workingDirectory: process.cwd()
    },
    options: {
      worktree: {
        enabled: true,
        baseBranch: 'main',
        branchName: 'feature/test-worktree',
        keepAfterCompletion: true,  // タスク完了後もWorktreeを保持
        autoCommit: false,
        autoMerge: false
      }
    }
  };

  try {
    const advancedResult = await apiRequest('/api/tasks', {
      method: 'POST',
      body: JSON.stringify(advancedWorktreeTask)
    });
    
    log(`タスクID: ${advancedResult.taskId}`, 'blue');
    log('注意: keepAfterCompletion=trueのため、Worktreeは自動削除されません', 'yellow');
    
    // タスク完了を待つ
    await waitForTaskCompletion(advancedResult.taskId);
    
    // Worktreeの確認
    log('\n現在のWorktreeを確認:', 'yellow');
    console.log('実行コマンド: git worktree list');
    
  } catch (error) {
    log(`エラー: ${error.message}`, 'red');
  }
}

// タスクの完了を待つヘルパー関数
async function waitForTaskCompletion(taskId, maxWaitTime = 30000) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitTime) {
    const task = await apiRequest(`/api/tasks/${taskId}`);
    
    if (task.status === 'completed') {
      log('タスク完了!', 'green');
      console.log('\n実行結果:');
      console.log(task.result?.result || task.result);
      
      if (task.logs && task.logs.length > 0) {
        console.log('\nログ:');
        task.logs.forEach(log => console.log(`  - ${log}`));
      }
      
      return task;
    } else if (task.status === 'failed') {
      log('タスク失敗!', 'red');
      console.log('エラー:', task.error);
      throw new Error('Task failed');
    }
    
    // 1秒待機
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  throw new Error('Task timeout');
}

// WebSocketを使用したリアルタイムログ監視の例
async function testWorktreeWithWebSocket() {
  log('\n=== WebSocketを使用したWorktreeタスクの監視 ===\n', 'bright');
  
  // WebSocket接続の例（実装にはws等のライブラリが必要）
  log('WebSocket接続の例:', 'yellow');
  console.log(`
const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:5000', {
  headers: {
    'X-API-Key': '${API_KEY}'
  }
});

ws.on('open', () => {
  console.log('WebSocket接続成功');
});

ws.on('message', (data) => {
  const message = JSON.parse(data);
  if (message.type === 'task.log') {
    console.log(\`[\${message.taskId}] \${message.log}\`);
  }
});
  `);
}

// メイン実行
async function main() {
  try {
    // サーバーの状態確認
    const health = await fetch(`${BASE_URL}/health`).then(r => r.json());
    log(`サーバー状態: ${health.status}`, 'green');
    
    // Worktree機能のテスト実行
    await testWorktreeTask();
    
    // WebSocket例の表示
    await testWorktreeWithWebSocket();
    
    log('\n=== テスト完了 ===', 'bright');
    
    // クリーンアップのヒント
    log('\nクリーンアップ方法:', 'yellow');
    console.log('1. 作成されたWorktreeを確認: git worktree list');
    console.log('2. 不要なWorktreeを削除: git worktree remove <path>');
    console.log('3. 全てのWorktreeを削除: git worktree prune');
    
  } catch (error) {
    log(`\nエラーが発生しました: ${error.message}`, 'red');
    console.error(error);
  }
}

// 実行
main();
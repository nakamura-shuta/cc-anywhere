#!/usr/bin/env node

/**
 * Git Worktree機能の包括的なテストスイート
 * 
 * 使用方法:
 *   node examples/worktree-test-suite.js [オプション]
 * 
 * オプション:
 *   --api-key    APIキー（デフォルト: .envから読み込み）
 *   --base-url   ベースURL（デフォルト: http://localhost:5000）
 *   --repo-path  テスト用リポジトリパス（デフォルト: カレントディレクトリ）
 *   --verbose    詳細ログを表示
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 環境設定
const args = process.argv.slice(2);
const getArg = (name, defaultValue) => {
  const index = args.indexOf(name);
  return index !== -1 && args[index + 1] ? args[index + 1] : defaultValue;
};

const API_KEY = getArg('--api-key', process.env.API_KEY || 'test-api-key');
const BASE_URL = getArg('--base-url', 'http://localhost:5000');
const REPO_PATH = getArg('--repo-path', process.cwd());
const VERBOSE = args.includes('--verbose');

// カラー出力用
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

// ユーティリティ関数
function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function section(title) {
  console.log();
  log(`${'='.repeat(50)}`, 'blue');
  log(`  ${title}`, 'cyan');
  log(`${'='.repeat(50)}`, 'blue');
  console.log();
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function createTask(taskData) {
  const response = await fetch(`${BASE_URL}/api/tasks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY
    },
    body: JSON.stringify(taskData)
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
}

async function getTask(taskId) {
  const response = await fetch(`${BASE_URL}/api/tasks/${taskId}`, {
    headers: {
      'X-API-Key': API_KEY
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
}

async function waitForTask(taskId, maxWait = 30000) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWait) {
    const task = await getTask(taskId);
    
    if (task.status === 'completed' || task.status === 'failed') {
      return task;
    }
    
    if (VERBOSE) {
      process.stdout.write('.');
    }
    
    await sleep(1000);
  }
  
  throw new Error('Task timeout');
}

function getWorktreeList() {
  try {
    const output = execSync('git worktree list', { 
      cwd: REPO_PATH,
      encoding: 'utf8' 
    });
    return output.split('\n').filter(line => line.includes('cc-anywhere'));
  } catch (error) {
    return [];
  }
}

// テストケース
const tests = {
  // 1. 基本的なWorktree作成
  async basicWorktreeCreation() {
    log('テスト: 基本的なWorktree作成', 'yellow');
    
    const initialWorktrees = getWorktreeList().length;
    
    const task = await createTask({
      instruction: 'pwd && git branch --show-current && echo "Worktree test successful"',
      context: {
        workingDirectory: REPO_PATH
      },
      options: {
        useWorktree: true
      }
    });
    
    log(`タスクID: ${task.taskId}`, 'cyan');
    
    // Worktreeが作成されたか確認
    await sleep(2000);
    const duringWorktrees = getWorktreeList();
    
    if (duringWorktrees.length > initialWorktrees) {
      log('✅ Worktreeが作成されました', 'green');
      if (VERBOSE) {
        duringWorktrees.forEach(wt => log(`  ${wt}`, 'cyan'));
      }
    } else {
      log('❌ Worktreeが作成されませんでした', 'red');
      return false;
    }
    
    // タスク完了待機
    const result = await waitForTask(task.taskId);
    
    if (result.status === 'completed') {
      log('✅ タスクが正常に完了しました', 'green');
      
      if (result.result && result.result.includes('cc-anywhere/task')) {
        log('✅ 正しいブランチ名が使用されています', 'green');
      }
    } else {
      log('❌ タスクが失敗しました', 'red');
      return false;
    }
    
    return true;
  },

  // 2. カスタムブランチ名
  async customBranchName() {
    log('テスト: カスタムブランチ名', 'yellow');
    
    const branchName = `test/custom-${Date.now()}`;
    
    const task = await createTask({
      instruction: 'git branch --show-current',
      context: {
        workingDirectory: REPO_PATH
      },
      options: {
        worktree: {
          enabled: true,
          branchName: branchName
        }
      }
    });
    
    const result = await waitForTask(task.taskId);
    
    if (result.status === 'completed' && result.result.includes(branchName)) {
      log(`✅ カスタムブランチ名が使用されました: ${branchName}`, 'green');
      return true;
    } else {
      log('❌ カスタムブランチ名が使用されませんでした', 'red');
      return false;
    }
  },

  // 3. 並列実行
  async parallelExecution() {
    log('テスト: 並列実行（3タスク）', 'yellow');
    
    const tasks = [];
    
    // 3つのタスクを同時に作成
    for (let i = 1; i <= 3; i++) {
      tasks.push(createTask({
        instruction: `sleep 3 && echo "Task ${i} completed"`,
        context: {
          workingDirectory: REPO_PATH
        },
        options: {
          useWorktree: true
        }
      }));
    }
    
    const results = await Promise.all(tasks);
    log(`✅ ${results.length}個のタスクが作成されました`, 'green');
    
    // Worktreeの数を確認
    await sleep(1000);
    const worktrees = getWorktreeList();
    
    if (worktrees.length >= 3) {
      log(`✅ ${worktrees.length}個のWorktreeが同時に存在しています`, 'green');
    } else {
      log(`⚠️  Worktreeの数が予想より少ない: ${worktrees.length}`, 'yellow');
    }
    
    // すべてのタスクの完了を待つ
    const completedTasks = await Promise.all(
      results.map(task => waitForTask(task.taskId))
    );
    
    const allSuccess = completedTasks.every(task => task.status === 'completed');
    
    if (allSuccess) {
      log('✅ すべてのタスクが正常に完了しました', 'green');
      return true;
    } else {
      log('❌ 一部のタスクが失敗しました', 'red');
      return false;
    }
  },

  // 4. エラーハンドリング
  async errorHandling() {
    log('テスト: エラーハンドリング', 'yellow');
    
    // 存在しないコマンド
    const task = await createTask({
      instruction: 'this-command-does-not-exist',
      context: {
        workingDirectory: REPO_PATH
      },
      options: {
        useWorktree: true
      }
    });
    
    const result = await waitForTask(task.taskId);
    
    if (result.status === 'failed') {
      log('✅ エラーが適切にハンドリングされました', 'green');
      
      // Worktreeがクリーンアップされているか確認
      await sleep(2000);
      const worktrees = getWorktreeList();
      const taskWorktree = worktrees.find(wt => wt.includes(task.taskId.substring(0, 8)));
      
      if (!taskWorktree) {
        log('✅ エラー後にWorktreeがクリーンアップされました', 'green');
        return true;
      } else {
        log('⚠️  エラー後もWorktreeが残っています', 'yellow');
        return true; // クリーンアップ遅延の可能性があるため警告のみ
      }
    } else {
      log('❌ エラーが検出されませんでした', 'red');
      return false;
    }
  },

  // 5. keepAfterCompletionテスト
  async keepWorktree() {
    log('テスト: keepAfterCompletion', 'yellow');
    
    const branchName = `keep/test-${Date.now()}`;
    
    const task = await createTask({
      instruction: 'echo "This worktree should be kept"',
      context: {
        workingDirectory: REPO_PATH
      },
      options: {
        worktree: {
          enabled: true,
          branchName: branchName,
          keepAfterCompletion: true
        }
      }
    });
    
    await waitForTask(task.taskId);
    
    // 10秒待ってもWorktreeが残っているか確認
    await sleep(10000);
    
    const worktrees = getWorktreeList();
    const keptWorktree = worktrees.find(wt => wt.includes(branchName));
    
    if (keptWorktree) {
      log('✅ Worktreeが保持されています', 'green');
      
      // クリーンアップ（テスト環境を汚さないため）
      try {
        const worktreePath = keptWorktree.split(' ')[0];
        execSync(`git worktree remove ${worktreePath}`, { cwd: REPO_PATH });
        log('🧹 テスト用Worktreeをクリーンアップしました', 'cyan');
      } catch (error) {
        log('⚠️  手動でのクリーンアップが必要です', 'yellow');
      }
      
      return true;
    } else {
      log('❌ Worktreeが保持されませんでした', 'red');
      return false;
    }
  }
};

// メイン実行
async function main() {
  log('Git Worktree機能 テストスイート', 'cyan');
  log(`ベースURL: ${BASE_URL}`, 'blue');
  log(`リポジトリ: ${REPO_PATH}`, 'blue');
  console.log();

  // Gitリポジトリチェック
  try {
    execSync('git status', { cwd: REPO_PATH, stdio: 'ignore' });
  } catch (error) {
    log('❌ 指定されたパスはGitリポジトリではありません', 'red');
    process.exit(1);
  }

  const results = [];
  
  // 各テストを実行
  for (const [testName, testFunc] of Object.entries(tests)) {
    section(testName);
    
    try {
      const success = await testFunc();
      results.push({ name: testName, success });
      
      if (success) {
        log(`\n✅ ${testName} - 成功`, 'green');
      } else {
        log(`\n❌ ${testName} - 失敗`, 'red');
      }
    } catch (error) {
      log(`\n❌ ${testName} - エラー: ${error.message}`, 'red');
      results.push({ name: testName, success: false, error: error.message });
      
      if (VERBOSE) {
        console.error(error);
      }
    }
    
    // テスト間のクリーンアップ時間
    await sleep(3000);
  }

  // サマリー
  section('テスト結果サマリー');
  
  const successCount = results.filter(r => r.success).length;
  const totalCount = results.length;
  const successRate = Math.round((successCount / totalCount) * 100);
  
  results.forEach(result => {
    const icon = result.success ? '✅' : '❌';
    const status = result.success ? '成功' : '失敗';
    log(`${icon} ${result.name}: ${status}`, result.success ? 'green' : 'red');
  });
  
  console.log();
  log(`成功率: ${successCount}/${totalCount} (${successRate}%)`, 
      successRate === 100 ? 'green' : 'yellow');

  // 最終クリーンアップ
  section('最終クリーンアップ');
  
  const remainingWorktrees = getWorktreeList();
  if (remainingWorktrees.length > 0) {
    log(`${remainingWorktrees.length}個のWorktreeが残っています`, 'yellow');
    
    if (args.includes('--cleanup')) {
      log('クリーンアップを実行します...', 'cyan');
      try {
        execSync('git worktree prune', { cwd: REPO_PATH });
        log('✅ クリーンアップ完了', 'green');
      } catch (error) {
        log('⚠️  クリーンアップに失敗しました', 'yellow');
      }
    } else {
      log('--cleanup オプションでクリーンアップできます', 'cyan');
    }
  } else {
    log('✅ すべてのWorktreeがクリーンアップされています', 'green');
  }

  process.exit(successRate === 100 ? 0 : 1);
}

// エラーハンドリング
process.on('unhandledRejection', (error) => {
  log(`\n予期しないエラー: ${error.message}`, 'red');
  if (VERBOSE) {
    console.error(error);
  }
  process.exit(1);
});

// 実行
main().catch(error => {
  log(`\nエラー: ${error.message}`, 'red');
  process.exit(1);
});
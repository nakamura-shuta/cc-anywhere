# Git Worktree機能の使い方

## 概要

Git Worktree機能を使用すると、タスクごとに独立したワークツリーで作業を実行できます。これにより、並列実行や安全な実行が可能になります。

## セットアップ

### 1. 環境変数の設定

`.env`ファイルに以下を追加：

```bash
# Git Worktree機能を有効化
ENABLE_WORKTREE=true

# その他のオプション（デフォルト値）
WORKTREE_BASE_PATH=.worktrees      # Worktreeのベースディレクトリ
MAX_WORKTREES=5                     # 最大同時Worktree数
WORKTREE_AUTO_CLEANUP=true          # 自動クリーンアップ
WORKTREE_CLEANUP_DELAY=300000       # クリーンアップ遅延（5分）
WORKTREE_PREFIX=cc-anywhere         # Worktree名のプレフィックス
```

### 2. サーバーの起動

```bash
npm run dev
```

## 使用方法

### 基本的な使い方

APIリクエストで`useWorktree: true`を指定：

```json
{
  "instruction": "echo 'Hello from worktree' && pwd",
  "context": {
    "workingDirectory": "/path/to/repo"
  },
  "options": {
    "useWorktree": true
  }
}
```

### 詳細なオプション

```json
{
  "instruction": "your task here",
  "context": {
    "workingDirectory": "/path/to/repo"
  },
  "options": {
    "worktree": {
      "enabled": true,
      "baseBranch": "main",
      "branchName": "feature/my-task",
      "keepAfterCompletion": false,
      "autoCommit": false,
      "autoMerge": false
    }
  }
}
```

## 動作確認方法

### 1. Node.jsスクリプトを使用

```bash
node examples/test-worktree.js
```

### 2. cURLコマンドを使用

```bash
# 基本的なWorktreeタスク
curl -X POST http://localhost:5000/api/tasks \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "instruction": "pwd && git branch",
    "context": {"workingDirectory": "'$(pwd)'"},
    "options": {"useWorktree": true}
  }'
```

### 3. Worktreeの確認

```bash
# 現在のWorktreeを一覧表示
git worktree list

# Worktreeディレクトリの内容を確認
ls -la .worktrees/

# 特定のWorktreeに移動
cd .worktrees/cc-anywhere-task-123/
```

## 動作の流れ

1. **タスク受信**: Worktreeオプションが有効なタスクを受信
2. **Worktree作成**: 
   - 新しいブランチを作成（例: `cc-anywhere/task-123-1234567890`）
   - `.worktrees/cc-anywhere-task-123`にWorktreeを作成
3. **タスク実行**: Worktree内でタスクを実行
4. **クリーンアップ**: 
   - `keepAfterCompletion: false`の場合、自動的にWorktreeを削除
   - `WORKTREE_CLEANUP_DELAY`で指定した時間後にクリーンアップ

## トラブルシューティング

### Worktreeが作成されない

1. 環境変数を確認：
   ```bash
   echo $ENABLE_WORKTREE  # trueであることを確認
   ```

2. Gitリポジトリであることを確認：
   ```bash
   git status
   ```

3. ログを確認：
   ```bash
   # サーバーログでWorktree関連のメッセージを確認
   npm run dev
   ```

### Worktreeが削除されない

1. 手動で削除：
   ```bash
   git worktree remove .worktrees/cc-anywhere-task-123
   ```

2. 全てのWorktreeをクリーンアップ：
   ```bash
   git worktree prune
   ```

### 最大Worktree数エラー

`MAX_WORKTREES`を超えた場合、古いWorktreeを削除する必要があります：

```bash
# 不要なWorktreeを確認
git worktree list

# 削除
git worktree remove <path>
```

## 高度な使用例

### 1. 並列タスクの実行

複数のタスクを同時に異なるWorktreeで実行：

```javascript
const tasks = [
  { instruction: "task1", options: { useWorktree: true } },
  { instruction: "task2", options: { useWorktree: true } },
  { instruction: "task3", options: { useWorktree: true } }
];

const results = await Promise.all(
  tasks.map(task => 
    fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
      body: JSON.stringify(task)
    })
  )
);
```

### 2. 特定のブランチからWorktreeを作成

```json
{
  "instruction": "npm test",
  "context": {
    "workingDirectory": "/path/to/repo"
  },
  "options": {
    "worktree": {
      "enabled": true,
      "baseBranch": "develop",  // developブランチから作成
      "branchName": "test/integration-test"
    }
  }
}
```

### 3. 変更を保持してレビュー

```json
{
  "instruction": "npm run build && npm test",
  "context": {
    "workingDirectory": "/path/to/repo"
  },
  "options": {
    "worktree": {
      "enabled": true,
      "keepAfterCompletion": true,  // Worktreeを保持
      "branchName": "review/changes"
    }
  }
}
```

## セキュリティと注意事項

1. **ディスク容量**: Worktreeは完全なコピーを作成するため、十分なディスク容量が必要
2. **クリーンアップ**: 定期的に不要なWorktreeを削除
3. **並列実行**: 同じブランチ名でのWorktree作成は避ける
4. **権限**: Gitリポジトリへの書き込み権限が必要

## 関連ドキュメント

- [worktree-spec.md](./worktree-spec.md) - 機能仕様
- [worktree-implementation-plan.md](./worktree-implementation-plan.md) - 実装計画
- [worktree-safety-management.md](./worktree-safety-management.md) - 安全管理
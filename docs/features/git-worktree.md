# Git Worktree機能

独立した作業環境でタスクを実行するGit Worktree機能について説明します。

## 概要

Git Worktree機能により、以下が可能になります：

- 🔀 メインリポジトリに影響を与えずにタスクを実行
- 🚀 複数タスクの独立実行（異なるブランチで）
- 🧪 実験的な変更の安全な実行
- 📦 タスクごとの独立した環境

## 基本的な使い方

### 1. 機能の有効化

`.env`ファイル：

```env
ENABLE_WORKTREE=true
```

### 2. APIでの使用

```bash
curl -X POST http://localhost:5000/api/tasks \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "instruction": "npm test を実行してください",
    "context": {
      "workingDirectory": "/path/to/repo"
    },
    "options": {
      "useWorktree": true
    }
  }'
```

### 3. Web UIでの使用

1. タスク作成フォームで「Git Worktreeを使用」にチェック
2. オプションでブランチ名を指定
3. タスクを実行

## 詳細な設定

### 環境変数

```env
# Worktree機能の有効化
ENABLE_WORKTREE=true

# Worktreeのベースディレクトリ
WORKTREE_BASE_PATH=.worktrees

# 最大同時Worktree数
MAX_WORKTREES=5

# 自動クリーンアップ
WORKTREE_AUTO_CLEANUP=true

# クリーンアップ遅延（ミリ秒）
WORKTREE_CLEANUP_DELAY=300000

# Worktree名のプレフィックス
WORKTREE_PREFIX=cc-anywhere
```

### 高度なオプション

```json
{
  "instruction": "ビルドとテストを実行",
  "context": {
    "workingDirectory": "/repos/my-project"
  },
  "options": {
    "worktree": {
      "enabled": true,
      "baseBranch": "develop",
      "branchName": "feature/test-123",
      "keepAfterCompletion": true
    }
  }
}
```

## 動作の仕組み

1. **タスク受信**: Worktreeオプション付きタスクを受信
2. **Worktree作成**: 
   - 新しいブランチを作成
   - `.worktrees/cc-anywhere-task-{id}`にWorktreeを作成
3. **タスク実行**: Worktree内でタスクを実行
4. **クリーンアップ**: タスク完了後、自動的にWorktreeを削除

## ユースケース

### 1. 安全なテスト実行

```bash
# メインブランチに影響を与えずにテストを実行
{
  "instruction": "rm -rf node_modules && npm install && npm test",
  "options": {
    "useWorktree": true
  }
}
```

### 2. 複数バージョンの独立ビルド

```bash
# 異なるブランチで独立してビルド
for branch in main develop feature/x; do
  curl -X POST ... -d "{
    \"instruction\": \"npm run build\",
    \"options\": {
      \"worktree\": {
        \"enabled\": true,
        \"baseBranch\": \"$branch\"
      }
    }
  }"
done
```

**注意**: タスクはキューシステムによって管理されるため、実際の実行は`QUEUE_CONCURRENCY`の設定に基づいて順次処理されます。

### 3. 実験的な変更

```bash
# 破壊的な変更を安全に実行
{
  "instruction": "大規模なリファクタリングスクリプトを実行",
  "options": {
    "worktree": {
      "enabled": true,
      "keepAfterCompletion": true
    }
  }
}
```

## 管理とモニタリング

### Worktreeの確認

```bash
# 現在のWorktreeを一覧表示
git worktree list

# CC-Anywhereが作成したWorktreeのみ
git worktree list | grep cc-anywhere
```

### 手動クリーンアップ

```bash
# 特定のWorktreeを削除
git worktree remove .worktrees/cc-anywhere-task-123

# 全てのCC-Anywhere Worktreeを削除
git worktree prune
rm -rf .worktrees/cc-anywhere-*
```

## トラブルシューティング

### Worktreeが作成されない

1. **Gitリポジトリか確認**
   ```bash
   git status
   ```

2. **権限を確認**
   ```bash
   ls -la .git
   ```

3. **ログを確認**
   ```bash
   pm2 logs cc-anywhere | grep -i worktree
   ```

### 最大数エラー

```bash
# 現在のWorktree数を確認
git worktree list | wc -l

# 不要なWorktreeを削除
git worktree prune
```

### ディスク容量不足

Worktreeは完全なコピーを作成するため、十分な空き容量が必要：

```bash
# ディスク使用量を確認
df -h .
du -sh .worktrees/
```

## ベストプラクティス

1. **適切なクリーンアップ設定**
   - 自動クリーンアップを有効にする
   - 適切な遅延時間を設定

2. **リソース管理**
   - MAX_WORKTREESを適切に設定
   - ディスク容量を監視

3. **ブランチ戦略**
   - 意味のあるブランチ名を使用
   - ベースブランチを明示的に指定

4. **エラーハンドリング**
   - Worktree作成失敗時の代替処理を検討

## 複数タスク実行について

### アーキテクチャの制限

CC-Anywhereでは、タスクの実行はキューシステムによって制御されます：

- **キューの並行数**: `QUEUE_CONCURRENCY`で設定（デフォルト: 3）
- **Worktreeの最大数**: `MAX_WORKTREES`で設定（デフォルト: 5）
- **実行モデル**: タスクは順次実行されますが、各タスクは独立したWorktreeで実行

### 実際の動作

1. 複数のタスクを同時に投入した場合：
   - すべてのタスクがキューに追加される
   - `QUEUE_CONCURRENCY`の数だけ同時に処理開始
   - 各タスクは独自のWorktreeで実行

2. Worktreeの利点：
   - タスク間の完全な独立性
   - ファイルシステムレベルでの分離
   - 異なるブランチでの同時作業

## 関連ドキュメント

- [Git Worktree公式ドキュメント](https://git-scm.com/docs/git-worktree)
- [APIリファレンス](../api/api-reference.md#worktree-options)
- [設定ガイド](../getting-started/configuration.md#git-worktree)
- [Worktreeテストガイド](../testing/worktree-tests.md)
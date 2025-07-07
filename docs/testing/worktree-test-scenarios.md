# Git Worktree機能 テストシナリオ

Git Worktree機能を徹底的にテストするためのシナリオ集です。

## 前提条件

- CC-Anywhereが起動している
- `.env`で`ENABLE_WORKTREE=true`が設定されている
- テスト用のGitリポジトリが準備されている

## 1. 基本機能テスト

### 1.1 シンプルなWorktree作成

**目的**: 基本的なWorktree作成と実行を確認

```bash
# テストコマンド
curl -X POST http://localhost:5000/api/tasks \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "instruction": "pwd && git branch --show-current && echo \"Worktree test successful\"",
    "context": {
      "workingDirectory": "/path/to/your/repo"
    },
    "options": {
      "useWorktree": true
    }
  }'
```

**期待される結果**:
- ✅ 新しいWorktreeが`.worktrees/cc-anywhere-task-{id}`に作成される
- ✅ 現在のディレクトリがWorktreeのパスを示す
- ✅ ブランチ名が`cc-anywhere/task-{id}-{timestamp}`形式
- ✅ タスク完了後、Worktreeが自動削除される

**確認コマンド**:
```bash
# Worktreeの確認
git worktree list

# ブランチの確認
git branch -a | grep cc-anywhere
```

### 1.2 カスタムブランチ名でのWorktree

**目的**: 指定したブランチ名でWorktreeが作成されることを確認

```json
{
  "instruction": "git branch --show-current",
  "context": {
    "workingDirectory": "/path/to/repo"
  },
  "options": {
    "worktree": {
      "enabled": true,
      "branchName": "test/custom-branch-name"
    }
  }
}
```

**期待される結果**:
- ✅ ブランチ名が`test/custom-branch-name`になる

## 2. 並列実行テスト

### 2.1 複数タスクの同時実行

**目的**: 複数のWorktreeが同時に作成・実行できることを確認

```bash
# 3つのタスクを同時に起動
for i in 1 2 3; do
  curl -X POST http://localhost:5000/api/tasks \
    -H "Content-Type: application/json" \
    -H "X-API-Key: your-api-key" \
    -d "{
      \"instruction\": \"sleep 5 && echo 'Task $i completed'\",
      \"context\": {
        \"workingDirectory\": \"/path/to/repo\"
      },
      \"options\": {
        \"useWorktree\": true
      }
    }" &
done
wait
```

**期待される結果**:
- ✅ 3つの異なるWorktreeが作成される
- ✅ 各タスクが独立して実行される
- ✅ 各Worktreeが異なるブランチを持つ

**確認コマンド**:
```bash
# 実行中のWorktreeを確認
watch -n 1 "git worktree list | grep cc-anywhere"
```

### 2.2 最大Worktree数の制限テスト

**目的**: MAX_WORKTREES制限が正しく機能することを確認

```bash
# .envでMAX_WORKTREES=3に設定後

# 5つのタスクを送信
for i in {1..5}; do
  curl -X POST http://localhost:5000/api/tasks \
    -H "Content-Type: application/json" \
    -H "X-API-Key: your-api-key" \
    -d '{
      "instruction": "sleep 10",
      "options": {"useWorktree": true}
    }'
done
```

**期待される結果**:
- ✅ 最初の3つは成功
- ✅ 4つ目と5つ目はエラーまたはキュー待機

## 3. ファイル操作テスト

### 3.1 ファイル作成と独立性確認

**目的**: Worktree内の変更がメインリポジトリに影響しないことを確認

```json
{
  "instruction": "echo 'test content' > worktree-test.txt && git add worktree-test.txt && git status",
  "context": {
    "workingDirectory": "/path/to/repo"
  },
  "options": {
    "useWorktree": true
  }
}
```

**期待される結果**:
- ✅ Worktree内にファイルが作成される
- ✅ メインリポジトリには影響なし
- ✅ git statusでWorktree内の変更が表示される

**確認コマンド**:
```bash
# メインリポジトリで確認
cd /path/to/repo
git status  # 変更なしであること
ls worktree-test.txt  # ファイルが存在しないこと
```

### 3.2 大規模ファイル操作

**目的**: Worktreeでの大規模な変更が安全に実行されることを確認

```json
{
  "instruction": "rm -rf node_modules && npm install && npm run build",
  "context": {
    "workingDirectory": "/path/to/node-project"
  },
  "options": {
    "useWorktree": true,
    "timeout": 600000
  }
}
```

**期待される結果**:
- ✅ Worktree内で安全に実行される
- ✅ メインのnode_modulesは影響を受けない

## 4. エラーハンドリングテスト

### 4.1 Worktree作成失敗

**目的**: Gitリポジトリでない場所でのエラーハンドリング

```json
{
  "instruction": "echo 'test'",
  "context": {
    "workingDirectory": "/tmp"
  },
  "options": {
    "useWorktree": true
  }
}
```

**期待される結果**:
- ❌ エラーレスポンスが返る
- ✅ エラーメッセージが明確
- ✅ システムがクラッシュしない

### 4.2 タスク実行中のエラー

**目的**: Worktree内でエラーが発生した場合のクリーンアップ

```json
{
  "instruction": "exit 1",
  "options": {
    "useWorktree": true
  }
}
```

**期待される結果**:
- ❌ タスクは失敗
- ✅ Worktreeは自動的にクリーンアップされる

## 5. クリーンアップテスト

### 5.1 自動クリーンアップの動作確認

**目的**: WORKTREE_CLEANUP_DELAYが正しく機能することを確認

```bash
# .envでWORKTREE_CLEANUP_DELAY=10000（10秒）に設定

# タスク実行
curl -X POST ... -d '{
  "instruction": "echo done",
  "options": {"useWorktree": true}
}'

# タスク完了後、Worktreeの状態を監視
watch -n 1 "date && git worktree list"
```

**期待される結果**:
- ✅ タスク完了直後はWorktreeが存在
- ✅ 10秒後に自動削除される

### 5.2 keepAfterCompletionオプション

**目的**: Worktreeを保持するオプションが機能することを確認

```json
{
  "instruction": "echo 'important changes' > result.txt",
  "options": {
    "worktree": {
      "enabled": true,
      "keepAfterCompletion": true,
      "branchName": "keep/this-worktree"
    }
  }
}
```

**期待される結果**:
- ✅ タスク完了後もWorktreeが残る
- ✅ 手動で削除するまで保持される

## 6. パフォーマンステスト

### 6.1 Worktree作成時間の測定

```bash
# 時間測定スクリプト
time curl -X POST ... -d '{
  "instruction": "echo \"Worktree ready\"",
  "options": {"useWorktree": true}
}'
```

**確認ポイント**:
- Worktree作成にかかる時間（目標: 5秒以内）
- リポジトリサイズによる影響

### 6.2 ディスク使用量の確認

```bash
# Worktree作成前後のディスク使用量
df -h .
du -sh .worktrees/
```

## 7. UI統合テスト

### 7.1 Web UIからのWorktree使用

1. ブラウザで`http://localhost:5000`にアクセス
2. タスク作成フォームで「Git Worktreeを使用」にチェック
3. ブランチ名に`ui-test/feature-x`を入力
4. タスクを実行

**期待される結果**:
- ✅ UIからWorktreeオプションが送信される
- ✅ タスク詳細画面でWorktree情報が表示される

## 8. 異常系テスト

### 8.1 システム再起動時の動作

```bash
# Worktreeを作成したまま強制終了
pm2 stop cc-anywhere

# 再起動
pm2 start cc-anywhere

# 残存Worktreeの確認
git worktree list
```

**期待される結果**:
- ✅ 起動時に古いWorktreeがクリーンアップされる

### 8.2 ディスク容量不足

```bash
# ディスク容量を意図的に制限（テスト環境のみ）
# Worktree作成を試みる
```

**期待される結果**:
- ❌ 適切なエラーメッセージ
- ✅ 部分的に作成されたWorktreeがクリーンアップされる

## テスト自動化スクリプト

```bash
#!/bin/bash
# test-worktree.sh

echo "=== Git Worktree機能テストスイート ==="

# 基本テスト
echo "1. 基本的なWorktree作成テスト"
./examples/test-worktree.js

# 並列実行テスト  
echo "2. 並列実行テスト"
node examples/parallel-worktree-test.js

# クリーンアップ確認
echo "3. クリーンアップ確認"
git worktree list
sleep 10
git worktree list

echo "=== テスト完了 ==="
```

## レポート項目

テスト実施後、以下を記録：

1. **成功率**: 成功したテスト数 / 全テスト数
2. **パフォーマンス**: 
   - Worktree作成時間（平均）
   - タスク実行時間（Worktreeあり/なし比較）
3. **リソース使用**:
   - ディスク使用量
   - メモリ使用量
4. **エラー内容**: 発生したエラーとその対処
5. **改善提案**: テストで発見された改善点
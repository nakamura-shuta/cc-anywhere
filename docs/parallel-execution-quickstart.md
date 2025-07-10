# 並列実行クイックスタートガイド

## 概要
cc-anywhereを使用して、複数のタスクを並列実行する方法を説明します。

## 前提条件
- cc-anywhereがインストール済み
- APIサーバーが起動中（`npm run dev`）
- Git worktree機能が有効（`.env`で`ENABLE_WORKTREE=true`）

## 基本的な並列実行

### 1. シンプルな並列実行スクリプト

```bash
#!/bin/bash
# parallel-tasks.sh

API_URL="http://localhost:5000/api/tasks"
API_KEY="your key"

# タスク1: バックエンド開発
curl -X POST $API_URL \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{
    "instruction": "Express.js APIサーバーを実装",
    "options": {
      "worktree": {
        "enabled": true,
        "branchName": "feature/backend"
      }
    }
  }' &

# タスク2: フロントエンド開発
curl -X POST $API_URL \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{
    "instruction": "React UIを実装",
    "options": {
      "worktree": {
        "enabled": true,
        "branchName": "feature/frontend"
      }
    }
  }' &

# すべてのタスクの完了を待つ
wait
```

### 2. 自己組織化型（司令塔パターン）

```bash
#!/bin/bash
# orchestrator.sh

curl -X POST http://localhost:5000/api/tasks \
  -H "Content-Type: application/json" \
  -H "X-API-Key: hoge" \
  -d '{
    "instruction": "司令塔として以下を実行：\n1. プロジェクト設計\n2. curlコマンドで3つのタスクを並列作成\n3. 各タスクの監視\n4. 結果レポート作成",
    "options": {
      "sdk": {
        "allowedTools": ["Read", "Write", "Bash", "LS"],
        "maxTurns": 50
      }
    }
  }'
```

## 重要な設定

### SDK Options
```json
{
  "sdk": {
    "allowedTools": ["Read", "Write", "Edit", "Bash", "LS"],
    "maxTurns": 30,
    "permissionMode": "allow"
  }
}
```

### Worktree Options
```json
{
  "worktree": {
    "enabled": true,
    "branchName": "feature/my-task",
    "keepAfterCompletion": true
  }
}
```

## トラブルシューティング

### 1. タスクが作成されない
- APIキーを確認（`.env`の`API_KEY`）
- サーバーが起動しているか確認
- ポート5000が使用可能か確認

### 2. worktreeエラー
- リポジトリが初期化されているか確認
- `.env`で`ENABLE_WORKTREE=true`を設定
- worktreeの数が上限に達していないか確認

### 3. 並列実行されない
- Bashスクリプトで`&`を使用しているか確認
- `wait`コマンドを追加しているか確認

## ベストプラクティス

1. **明確な指示**: タスクには具体的な手順を含める
2. **適切なツール許可**: 必要なツールのみを`allowedTools`に含める
3. **エラーハンドリング**: タスクの失敗を考慮した設計
4. **リソース管理**: 同時実行タスク数を適切に制限

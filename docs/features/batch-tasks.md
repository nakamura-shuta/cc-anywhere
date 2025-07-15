# バッチタスク

複数のリポジトリに対して同じタスクを並列実行する機能です。

## 概要

バッチタスクを使用すると、複数のプロジェクトに対して同じ操作を一度に実行できます。各リポジトリで独立したタスクが作成され、並列で処理されます。

## 使用方法

### APIでの使用

```bash
# 複数リポジトリでテストを実行
curl -X POST http://localhost:5000/api/batch/tasks \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "instruction": "npm test",
    "repositories": [
      {"name": "app1", "path": "/path/to/app1"},
      {"name": "app2", "path": "/path/to/app2"},
      {"name": "app3", "path": "/path/to/app3"}
    ],
    "options": {
      "timeout": 300000,
      "allowedTools": ["Bash", "Read", "Write"]
    }
  }'
```

### Web UIでの使用

1. タスク実行画面（`/index.html`）でリポジトリリストを表示
2. 複数のリポジトリを選択（Ctrl/Cmdキーを押しながらクリック）
3. プロンプトを入力
4. 「タスクを実行」をクリック

選択された各リポジトリに対して独立したタスクが作成され、並列で実行されます。

## バッチタスクのステータス確認

```bash
# グループIDを使用してバッチタスクのステータスを確認
curl -X GET http://localhost:5000/api/batch/tasks/{groupId}/status \
  -H "X-API-Key: your-api-key"
```

### レスポンス例

```json
{
  "groupId": "group_123",
  "summary": {
    "total": 3,
    "pending": 1,
    "running": 1,
    "completed": 1,
    "failed": 0
  },
  "tasks": [
    {
      "taskId": "task1",
      "repository": "app1",
      "status": "completed",
      "duration": 5000
    },
    {
      "taskId": "task2",
      "repository": "app2",
      "status": "running",
      "duration": null
    },
    {
      "taskId": "task3",
      "repository": "app3",
      "status": "pending",
      "duration": null
    }
  ]
}
```

## 実用的な使用例

### 1. 複数プロジェクトの依存関係更新

```bash
curl -X POST http://localhost:5000/api/batch/tasks \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "instruction": "npm update && npm audit fix",
    "repositories": [
      {"name": "frontend", "path": "/projects/frontend"},
      {"name": "backend", "path": "/projects/backend"},
      {"name": "shared-lib", "path": "/projects/shared-lib"}
    ]
  }'
```

### 2. コードスタイルの統一

```bash
curl -X POST http://localhost:5000/api/batch/tasks \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "instruction": "npm run lint:fix && npm run format",
    "repositories": [
      {"name": "service-a", "path": "/services/a"},
      {"name": "service-b", "path": "/services/b"},
      {"name": "service-c", "path": "/services/c"}
    ]
  }'
```

### 3. 複数プロジェクトのビルド確認

```bash
curl -X POST http://localhost:5000/api/batch/tasks \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "instruction": "npm run build",
    "repositories": [
      {"name": "web-app", "path": "/apps/web"},
      {"name": "mobile-app", "path": "/apps/mobile"},
      {"name": "admin-panel", "path": "/apps/admin"}
    ],
    "options": {
      "timeout": 600000,
      "sdk": {
        "permissionMode": "bypassPermissions"
      }
    }
  }'
```

## 注意事項

- 各タスクは独立して実行されるため、タスク間での状態共有はできません
- タスクの実行順序は保証されません（並列実行）
- 大量のリポジトリを同時に処理する場合は、`MAX_CONCURRENT_TASKS`の設定に注意してください
- Git Worktreeオプションと組み合わせることで、メインブランチに影響を与えずに実行できます

## APIリファレンス

### POST /api/batch/tasks

バッチタスクを作成します。

**リクエストボディ:**

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| instruction | string | ✓ | 実行するタスクの指示 |
| repositories | array | ✓ | リポジトリの配列 |
| repositories[].name | string | ✓ | リポジトリの名前 |
| repositories[].path | string | ✓ | リポジトリのパス |
| options | object | - | タスクオプション（通常のタスクと同じ） |

**レスポンス:**

```json
{
  "groupId": "group_xxx",
  "tasks": [
    {
      "taskId": "task_xxx",
      "repository": "app1",
      "status": "pending"
    }
  ]
}
```

### GET /api/batch/tasks/{groupId}/status

バッチタスクのステータスを取得します。

**レスポンス:**

| フィールド | 型 | 説明 |
|-----------|-----|------|
| groupId | string | グループID |
| summary | object | タスクのサマリー |
| summary.total | number | 総タスク数 |
| summary.pending | number | 待機中のタスク数 |
| summary.running | number | 実行中のタスク数 |
| summary.completed | number | 完了したタスク数 |
| summary.failed | number | 失敗したタスク数 |
| tasks | array | 各タスクの詳細 |
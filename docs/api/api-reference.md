# APIリファレンス

## エンドポイント一覧

### ヘルスチェック

```
GET /health
```

サーバーの状態を確認します。

**レスポンス:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 3600,
  "environment": "development"
}
```

### タスクの作成

```
POST /api/tasks
```

新しいタスクを作成して実行します。

**ヘッダー:**
- `X-API-Key` (必須): APIキー
- `Content-Type`: `application/json`

**リクエストボディ:**

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| instruction | string | ✓ | Claudeに実行させたいタスクの指示。スラッシュコマンド（例: `/project:analyze`）もサポート |
| context | object | - | タスク実行時のコンテキスト情報 |
| context.workingDirectory | string | - | 作業ディレクトリのパス |
| context.files | string[] | - | 関連ファイルのリスト |
| options | object | - | タスク実行オプション |
| options.timeout | number | - | タイムアウト時間（ミリ秒）。デフォルト: 600000 (10分)、最大: 1800000 (30分) |
| options.async | boolean | - | 非同期実行フラグ。デフォルト: false |
| options.allowedTools | string[] | - | Claude Codeが使用できるツールを制限。例: ["Read", "Write", "Bash"] |
| options.retry | object | - | リトライ設定 |
| options.retry.maxRetries | number | - | 最大リトライ回数。デフォルト: 0（リトライなし） |
| options.retry.initialDelay | number | - | 初回リトライまでの遅延（ミリ秒）。デフォルト: 1000 |
| options.retry.maxDelay | number | - | 最大遅延時間（ミリ秒）。デフォルト: 60000 |
| options.sdk | object | - | Claude Code SDK用の詳細設定（下記参照） |
| options.useWorktree | boolean | - | Git Worktreeを使用するかどうか。デフォルト: false |
| options.worktree | object | - | Git Worktree詳細設定（下記参照） |
| options.retry.backoffMultiplier | number | - | 指数バックオフの倍率。デフォルト: 2 |
| options.retry.policy | string | - | リトライポリシー: "none", "linear", "exponential"。デフォルト: "exponential" |
| options.retry.retryableErrors | string[] | - | リトライ対象のエラーコード/メッセージ。空の場合は全エラーがリトライ対象 |

**SDKオプション (options.sdk):**

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| maxTurns | number | - | Claudeが実行できる最大ステップ数。デフォルト: 3 |
| permissionMode | string | - | ツール実行時の確認動作: "ask", "allow", "deny", "plan"。デフォルト: "ask" |
| systemPrompt | string | - | Claudeの動作を制御するカスタムプロンプト |
| allowedTools | string[] | - | 使用を許可するツールのリスト。例: ["Read", "Write", "Edit"] |
| disallowedTools | string[] | - | 使用を禁止するツールのリスト |
| outputFormat | string | - | 出力形式: "text", "json"。デフォルト: "text" |
| executable | string | - | 実行環境: "node", "python", "bash"。デフォルト: "node" |
| mcpConfig | object | - | Model Context Protocol設定 |
| continueSession | boolean | - | 前回のセッションを継続するか。デフォルト: false |
| verbose | boolean | - | 詳細ログを出力するか。デフォルト: false |

**Worktreeオプション (options.worktree):**

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| enabled | boolean | - | Worktreeを使用するか（useWorktreeより優先）。デフォルト: false |
| baseBranch | string | - | ベースブランチ名。省略時は現在のブランチを使用 |
| branchName | string | - | 作成するWorktreeのブランチ名。省略時は自動生成 |
| keepAfterCompletion | boolean | - | タスク完了後もWorktreeを保持するか。デフォルト: false |

**レスポンス（同期実行）:**
```json
{
  "taskId": "123e4567-e89b-12d3-a456-426614174000",
  "status": "completed",
  "instruction": "Calculate the sum of 1 to 100",
  "result": "The sum of 1 to 100 is 5050",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "startedAt": "2024-01-01T00:00:00.100Z",
  "completedAt": "2024-01-01T00:00:05.000Z"
}
```

**レスポンス（非同期実行）:**
```json
{
  "taskId": "123e4567-e89b-12d3-a456-426614174000",
  "status": "pending",
  "instruction": "Calculate the sum of 1 to 100",
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

**ステータスコード:**
- `201`: タスクが正常に作成され、同期実行が完了
- `202`: タスクが正常に作成され、非同期実行が開始
- `400`: リクエストが不正（バリデーションエラー）
- `401`: 認証エラー（APIキーが無効）
- `500`: サーバーエラー

### タスクステータスの確認

```
GET /api/tasks/{taskId}
```

指定されたタスクのステータスを取得します。

**パラメータ:**
- `taskId` (必須): タスクID

**ヘッダー:**
- `X-API-Key` (必須): APIキー

**レスポンス:**
```json
{
  "taskId": "123e4567-e89b-12d3-a456-426614174000",
  "status": "running",
  "instruction": "Calculate the sum of 1 to 100",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "startedAt": "2024-01-01T00:00:00.100Z",
  "workingDirectory": "/path/to/project",
  "allowedTools": ["Write", "Read", "Edit", "Bash"],
  "retryMetadata": {
    "currentAttempt": 1,
    "maxRetries": 3
  }
}
```

**タスクステータス:**
- `pending`: タスクは作成されたが、まだ実行されていない
- `running`: タスクは現在実行中
- `completed`: タスクは正常に完了
- `failed`: タスクはエラーで失敗
- `cancelled`: タスクはキャンセルされた

### タスクログの取得

```
GET /api/tasks/{taskId}/logs
```

指定されたタスクの実行ログを取得します。

**パラメータ:**
- `taskId` (必須): タスクID

**ヘッダー:**
- `X-API-Key` (必須): APIキー

**レスポンス:**
```json
{
  "taskId": "123e4567-e89b-12d3-a456-426614174000",
  "logs": [
    "Task started: Calculate the sum of 1 to 100",
    "Received 2 messages from Claude Code",
    "Task completed successfully"
  ]
}
```

### タスク一覧の取得

```
GET /api/tasks
```

タスクの一覧を取得します。

**クエリパラメータ:**
- `status`: フィルタするステータス（pending, running, completed, failed, cancelled）
- `limit`: 取得件数（1-100）。デフォルト: 20
- `offset`: オフセット。デフォルト: 0

**ヘッダー:**
- `X-API-Key` (必須): APIキー

**レスポンス:**
```json
{
  "tasks": [
    {
      "taskId": "123e4567-e89b-12d3-a456-426614174000",
      "status": "completed",
      "instruction": "Calculate the sum of 1 to 100",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "startedAt": "2024-01-01T00:00:00.100Z",
      "completedAt": "2024-01-01T00:00:05.000Z",
      "workingDirectory": "/path/to/project",
      "result": {
        "message": "The sum of 1 to 100 is 5050"
      },
      "logs": [
        "Task started: Calculate the sum of 1 to 100",
        "Received 2 messages from Claude Code",
        "Task completed successfully"
      ]
    }
  ],
  "total": 1,
  "limit": 20,
  "offset": 0
}
```

### タスクのキャンセル

```
DELETE /api/tasks/{taskId}
```

実行中のタスクをキャンセルします。

**パラメータ:**
- `taskId` (必須): タスクID

**ヘッダー:**
- `X-API-Key` (必須): APIキー

**レスポンス:**
```json
{
  "message": "Task cancelled successfully",
  "taskId": "123e4567-e89b-12d3-a456-426614174000"
}
```

### タスクのリトライ

```
POST /api/tasks/{taskId}/retry
```

失敗したタスクを手動でリトライします。

**パラメータ:**
- `taskId` (必須): リトライするタスクのID

**ヘッダー:**
- `X-API-Key` (必須): APIキー

**前提条件:**
- タスクが "failed" ステータスであること
- タスクにリトライ設定（maxRetries > 0）があること
- 最大リトライ回数に達していないこと

**レスポンス:**
```json
{
  "taskId": "新しいタスクID",
  "status": "pending",
  "instruction": "元のタスクの指示",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "retryMetadata": {
    "currentAttempt": 2,
    "maxRetries": 3,
    "retryHistory": [...]
  }
}
```

**エラーレスポンス:**
- `400`: タスクがリトライ不可（ステータスが不適切、リトライ設定なし、最大リトライ回数到達）
- `404`: タスクが見つからない
- `500`: リトライ処理に失敗

### エコーエンドポイント（テスト用）

```
POST /api/echo
```

リクエストボディをそのまま返します。APIの疎通確認に使用できます。

**ヘッダー:**
- `X-API-Key` (必須): APIキー
- `Content-Type`: `application/json`

**リクエストボディ:**
任意のJSONオブジェクト

**レスポンス:**
リクエストボディと同じ内容

## バッチタスクエンドポイント

### バッチタスクの作成

```
POST /api/batch/tasks
```

複数のリポジトリに対して同じタスクを並列実行します。

**ヘッダー:**
- `X-API-Key` (必須): APIキー
- `Content-Type`: `application/json`

**リクエストボディ:**
```json
{
  "instruction": "実行する指示（必須）",
  "repositories": [
    {
      "name": "リポジトリ名（必須）",
      "path": "リポジトリのパス（必須）",
      "timeout": 300000,  // オプション：リポジトリ固有のタイムアウト
      "retryOptions": {   // オプション：リポジトリ固有のリトライ設定
        "maxRetries": 3,
        "initialDelay": 1000,
        "maxDelay": 10000
      }
    }
  ],
  "options": {
    "timeout": 600000,  // デフォルトタイムアウト（ミリ秒）
    "allowedTools": ["Bash", "Read", "Write"],  // 許可するツール
    "retry": {
      "maxRetries": 2,
      "initialDelay": 1000,
      "maxDelay": 10000
    }
  }
}
```

**レスポンス:**
```json
{
  "groupId": "group_abc123",
  "tasks": [
    {
      "taskId": "task1",
      "repository": "app1",
      "status": "pending"
    },
    {
      "taskId": "task2",
      "repository": "app2",
      "status": "pending"
    }
  ]
}
```

### バッチタスクのステータス確認

```
GET /api/batch/tasks/{groupId}/status
```

グループIDを使用してバッチタスクの実行状況を確認します。

**パラメータ:**
- `groupId` (必須): バッチタスクのグループID

**ヘッダー:**
- `X-API-Key` (必須): APIキー

**レスポンス:**
```json
{
  "groupId": "group_abc123",
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
      "duration": 5000,
      "result": {...}
    },
    {
      "taskId": "task2",
      "repository": "app2",
      "status": "running"
    },
    {
      "taskId": "task3",
      "repository": "app3",
      "status": "pending"
    }
  ]
}
```

## エラーレスポンス

すべてのエラーは以下の形式で返されます：

```json
{
  "error": {
    "message": "エラーの説明",
    "statusCode": 400,
    "code": "ERROR_CODE"
  }
}
```

開発環境では、追加でスタックトレースが含まれる場合があります：

```json
{
  "error": {
    "message": "エラーの説明",
    "statusCode": 500,
    "code": "INTERNAL_ERROR",
    "stack": "Error: ...\n    at ...",
    "originalMessage": "詳細なエラーメッセージ"
  }
}
```

## 認証

すべてのAPIエンドポイント（`/health`を除く）はAPIキー認証が必要です。

APIキーは`X-API-Key`ヘッダーで送信する必要があります：

```bash
curl -H "X-API-Key: your-api-key" http://localhost:5000/api/tasks
```

有効なAPIキーは環境変数`API_KEYS`にカンマ区切りで設定します：

```env
API_KEYS=key1,key2,key3
```

## レート制限

現在、レート制限は実装されていませんが、将来的に追加される可能性があります。

## タスク履歴

### タスク履歴の取得

```
GET /api/history/tasks
```

データベースに保存されたタスクの履歴を取得します。

**ヘッダー:**
- `X-API-Key` (必須): APIキー

**クエリパラメータ:**
- `status`: フィルタするステータス（pending, running, completed, failed, cancelled）
- `priority`: 最小優先度（指定した値以上の優先度のタスクを取得）
- `search`: 指示の部分一致検索
- `createdAfter`: この日時以降に作成されたタスク（ISO 8601形式）
- `createdBefore`: この日時以前に作成されたタスク（ISO 8601形式）
- `limit`: 取得件数（1-100）。デフォルト: 20
- `offset`: オフセット。デフォルト: 0
- `orderBy`: ソート項目 (created_at, completed_at, priority)。デフォルト: created_at
- `orderDirection`: ソート方向 (ASC, DESC)。デフォルト: DESC

**レスポンス:**
```json
{
  "tasks": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "instruction": "Calculate the sum of 1 to 100",
      "context": {
        "workingDirectory": "/project",
        "files": ["file1.ts"]
      },
      "options": {
        "timeout": 60000,
        "allowedTools": ["Read"]
      },
      "priority": 5,
      "status": "completed",
      "result": {
        "message": "The sum of 1 to 100 is 5050"
      },
      "createdAt": "2024-01-01T00:00:00.000Z",
      "startedAt": "2024-01-01T00:00:00.100Z",
      "completedAt": "2024-01-01T00:00:05.000Z"
    }
  ],
  "total": 100,
  "limit": 20,
  "offset": 0
}
```

**使用例:**
```bash
# 全タスク履歴を取得
curl -X GET http://localhost:5000/api/history/tasks \
  -H "X-API-Key: your-api-key"

# 完了済みタスクのみ取得
curl -X GET "http://localhost:5000/api/history/tasks?status=completed" \
  -H "X-API-Key: your-api-key"

# 高優先度タスクを日付でフィルタ
curl -X GET "http://localhost:5000/api/history/tasks?priority=5&createdAfter=2024-01-01T00:00:00Z" \
  -H "X-API-Key: your-api-key"

# 検索とページネーション
curl -X GET "http://localhost:5000/api/history/tasks?search=authentication&limit=10&offset=20" \
  -H "X-API-Key: your-api-key"
```

### 特定タスクの履歴取得

```
GET /api/history/tasks/{taskId}
```

データベースから特定のタスクを取得します。

**パラメータ:**
- `taskId` (必須): タスクID

**ヘッダー:**
- `X-API-Key` (必須): APIキー

**レスポンス:**
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "instruction": "Calculate the sum of 1 to 100",
  "context": null,
  "options": {
    "timeout": 300000
  },
  "priority": 0,
  "status": "completed",
  "result": {
    "message": "The sum of 1 to 100 is 5050"
  },
  "error": null,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "startedAt": "2024-01-01T00:00:00.100Z",
  "completedAt": "2024-01-01T00:00:05.000Z",
  "updatedAt": "2024-01-01T00:00:05.000Z"
}
```

**ステータスコード:**
- `200`: タスクが見つかった
- `404`: タスクが見つからない
- `401`: 認証エラー

### 古いタスクのクリーンアップ

```
DELETE /api/history/tasks/cleanup
```

指定した日数より古い完了済みタスクを削除します。

**ヘッダー:**
- `X-API-Key` (必須): APIキー

**クエリパラメータ:**
- `daysToKeep`: 保持する日数（1-365）。デフォルト: 30

**レスポンス:**
```json
{
  "message": "Successfully deleted 45 old tasks",
  "deletedCount": 45
}
```

**使用例:**
```bash
# 30日より古いタスクを削除（デフォルト）
curl -X DELETE http://localhost:5000/api/history/tasks/cleanup \
  -H "X-API-Key: your-api-key"

# 7日より古いタスクを削除
curl -X DELETE "http://localhost:5000/api/history/tasks/cleanup?daysToKeep=7" \
  -H "X-API-Key: your-api-key"
```

## タスクキュー

### キューにタスクを追加

```
POST /api/queue/tasks
```

タスクをキューに追加して、順次実行します。

**リクエストボディ:**

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| instruction | string | ✓ | Claudeに実行させたいタスクの指示。スラッシュコマンド（例: `/project:analyze`）もサポート |
| context | object | - | タスク実行時のコンテキスト情報 |
| context.workingDirectory | string | - | 作業ディレクトリのパス |
| context.files | string[] | - | 関連ファイルのリスト |
| options | object | - | タスク実行オプション |
| options.timeout | number | - | タイムアウト時間（ミリ秒） |
| options.allowedTools | string[] | - | 使用可能なツールを制限 |
| priority | number | - | 優先度（高い値ほど優先）。デフォルト: 0 |

### キュー統計情報

```
GET /api/queue/stats
```

キューの現在の状態を取得します。

**レスポンス:**
```json
{
  "size": 10,
  "pending": 5,
  "running": 2,
  "completed": 20,
  "failed": 3,
  "isPaused": false,
  "concurrency": 2
}
```

### キュー内のタスク一覧

```
GET /api/queue/tasks
```

キュー内のすべてのタスクを取得します。

**クエリパラメータ:**
- `status`: フィルタするステータス（pending, running, completed, failed, cancelled）
- `limit`: 取得件数（1-100）。デフォルト: 20
- `offset`: オフセット。デフォルト: 0

### キュー内の特定タスク

```
GET /api/queue/tasks/{taskId}
```

キュー内の特定のタスクを取得します。

### キュー制御

```
POST /api/queue/start    # キューを開始
POST /api/queue/pause    # キューを一時停止
POST /api/queue/clear    # キューをクリア
```

### キュー同時実行数の変更

```
PUT /api/queue/concurrency
```

**リクエストボディ:**
```json
{
  "concurrency": 5
}
```

### キュー内タスクのキャンセル

```
DELETE /api/queue/tasks/{taskId}
```

キュー内のタスクをキャンセルします。ペンディングまたは実行中のタスクのみキャンセル可能です。

**パラメータ:**
- `taskId` (必須): タスクID

**ヘッダー:**
- `X-API-Key` (必須): APIキー

**レスポンス (200 OK):**
```json
{
  "message": "Task cancelled successfully",
  "taskId": "123e4567-e89b-12d3-a456-426614174000"
}
```

**エラーレスポンス:**
- `404`: タスクが見つからない
- `400`: タスクが既に完了またはキャンセル済み

## プリセット管理

### プリセット一覧の取得

```
GET /api/presets
```

保存されているプリセット（システムプリセットとユーザープリセット）の一覧を取得します。

**ヘッダー:**
- `X-API-Key` (必須): APIキー

**レスポンス:**
```json
{
  "presets": [
    {
      "id": "default",
      "name": "デフォルト設定",
      "description": "一般的なタスク用の標準設定",
      "isSystem": true,
      "settings": {
        "sdk": {
          "maxTurns": 3,
          "permissionMode": "ask",
          "allowedTools": ["Read", "Write", "Edit"],
          "outputFormat": "text"
        },
        "timeout": 600000,
        "useWorktree": false
      }
    }
  ],
  "userPresets": [
    {
      "id": "user-123",
      "name": "開発用設定",
      "description": "開発作業用のカスタム設定",
      "isSystem": false,
      "settings": {
        "sdk": {
          "maxTurns": 10,
          "permissionMode": "allow",
          "allowedTools": ["*"]
        },
        "timeout": 1800000,
        "useWorktree": true
      },
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

### 特定プリセットの取得

```
GET /api/presets/{presetId}
```

指定されたIDのプリセットを取得します。

**パラメータ:**
- `presetId` (必須): プリセットID

**ヘッダー:**
- `X-API-Key` (必須): APIキー

**レスポンス:**
```json
{
  "id": "user-123",
  "name": "開発用設定",
  "description": "開発作業用のカスタム設定",
  "isSystem": false,
  "settings": {
    "sdk": {
      "maxTurns": 10,
      "permissionMode": "allow",
      "allowedTools": ["*"]
    },
    "timeout": 1800000,
    "useWorktree": true
  },
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

### プリセットの作成

```
POST /api/presets
```

新しいユーザープリセットを作成します。

**ヘッダー:**
- `X-API-Key` (必須): APIキー
- `Content-Type`: `application/json`

**リクエストボディ:**
```json
{
  "name": "カスタムプリセット",
  "description": "特定のタスク用の設定",
  "settings": {
    "sdk": {
      "maxTurns": 5,
      "permissionMode": "ask",
      "allowedTools": ["Read", "Write", "Edit", "Bash"],
      "systemPrompt": "コードの品質とセキュリティに注意してください",
      "outputFormat": "json"
    },
    "timeout": 900000,
    "useWorktree": true,
    "worktree": {
      "keepAfterCompletion": true
    }
  }
}
```

**レスポンス (201 Created):**
```json
{
  "id": "user-456",
  "name": "カスタムプリセット",
  "description": "特定のタスク用の設定",
  "isSystem": false,
  "settings": { ... },
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

### プリセットの更新

```
PUT /api/presets/{presetId}
```

ユーザープリセットを更新します。システムプリセットは更新できません。

**パラメータ:**
- `presetId` (必須): プリセットID

**ヘッダー:**
- `X-API-Key` (必須): APIキー
- `Content-Type`: `application/json`

**リクエストボディ:**
```json
{
  "name": "更新されたプリセット名",
  "description": "更新された説明",
  "settings": {
    "sdk": {
      "maxTurns": 7
    }
  }
}
```

### プリセットの削除

```
DELETE /api/presets/{presetId}
```

ユーザープリセットを削除します。システムプリセットは削除できません。

**パラメータ:**
- `presetId` (必須): プリセットID

**ヘッダー:**
- `X-API-Key` (必須): APIキー

**レスポンス (200 OK):**
```json
{
  "message": "Preset deleted successfully"
}
```

**エラーレスポンス:**
- `403`: システムプリセットの変更・削除を試みた場合
- `404`: プリセットが見つからない場合

### プリセットを使用したタスク作成

タスク作成時に、プリセットの設定を参照して使用できます：

```json
{
  "instruction": "ファイルを分析してください",
  "context": {
    "workingDirectory": "/project"
  },
  "options": {
    "presetId": "development",  // プリセットIDを指定
    "sdk": {
      "maxTurns": 15  // プリセットの設定を部分的に上書き
    }
  }
}
```

注意: `presetId`を指定した場合、プリセットの設定がベースとなり、`options`で指定した個別の設定で上書きされます。

## Worktree使用例

### 基本的なWorktree使用

```bash
curl -X POST http://localhost:5000/api/tasks \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "instruction": "破壊的なテストを実行",
    "context": {
      "workingDirectory": "/path/to/repo"
    },
    "options": {
      "useWorktree": true
    }
  }'
```

### 詳細なWorktree設定

```bash
curl -X POST http://localhost:5000/api/tasks \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "instruction": "実験的な機能を実装",
    "context": {
      "workingDirectory": "/path/to/repo"
    },
    "options": {
      "worktree": {
        "enabled": true,
        "baseBranch": "develop",
        "branchName": "feature/experiment-123",
        "keepAfterCompletion": true
      }
    }
  }'
```

### 並列タスク実行の例

```bash
# 複数のタスクを異なるWorktreeで同時実行

# タスク1: バックエンドAPI実装
curl -X POST http://localhost:5000/api/queue/tasks \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "instruction": "TODO APIをExpressで実装",
    "options": {
      "worktree": {
        "enabled": true,
        "branchName": "feature/backend-api"
      }
    }
  }' &

# タスク2: フロントエンドUI実装
curl -X POST http://localhost:5000/api/queue/tasks \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "instruction": "ReactでTODOアプリのUIを実装",
    "options": {
      "worktree": {
        "enabled": true,
        "branchName": "feature/frontend-ui"
      }
    }
  }' &

wait
```

各タスクは独立したWorktreeで実行されるため、ファイルの競合を避けて安全に並列実行できます。

## 非同期タスクの処理

非同期タスクを使用する場合の推奨フロー：

1. `options.async: true`でタスクを作成、または`POST /api/queue/tasks`でキューに追加
2. レスポンスから`taskId`を取得
3. 定期的に`GET /api/tasks/{taskId}`または`GET /api/queue/tasks/{taskId}`でステータスを確認
4. ステータスが`completed`、`failed`、または`cancelled`になったら処理完了

ポーリング間隔は2-5秒を推奨します。

## スケジュール API

### スケジュールの作成

```
POST /api/schedules
```

定期実行またはワンタイム実行のスケジュールを作成します。

**ヘッダー:**
- `X-API-Key` (必須): APIキー
- `Content-Type`: `application/json`

**リクエストボディ:**
```json
{
  "name": "スケジュール名（必須）",
  "description": "スケジュールの説明（オプション）",
  "taskRequest": {
    "instruction": "実行する指示（必須）",
    "context": {
      "workingDirectory": "/path/to/directory"
    },
    "options": {
      "timeout": 300000,
      "sdk": {
        "permissionMode": "allow"
      }
    }
  },
  "schedule": {
    "type": "cron",  // "cron" または "once"
    "expression": "0 2 * * *",  // Cron式（cronタイプの場合必須）
    "executeAt": "2024-01-15T10:00:00Z",  // 実行日時（onceタイプの場合必須）
    "timezone": "Asia/Tokyo"  // タイムゾーン（オプション）
  },
  "status": "active"  // "active" または "inactive"（デフォルト: active）
}
```

### スケジュール一覧の取得

```
GET /api/schedules
```

**クエリパラメータ:**
- `limit`: 取得件数（デフォルト: 10、最大: 100）
- `offset`: オフセット（デフォルト: 0）
- `status`: フィルタするステータス（active/inactive）

### スケジュールの取得

```
GET /api/schedules/{scheduleId}
```

### スケジュールの更新

```
PUT /api/schedules/{scheduleId}
```

**リクエストボディ:**
スケジュール作成と同じフィールドを指定（すべてオプション）

### スケジュールの削除

```
DELETE /api/schedules/{scheduleId}
```

### スケジュールの有効化

```
POST /api/schedules/{scheduleId}/enable
```

### スケジュールの無効化

```
POST /api/schedules/{scheduleId}/disable
```

### 実行履歴の取得

```
GET /api/schedules/{scheduleId}/history
```

スケジュールの実行履歴を取得します。

## データベース

タスクはローカルSQLiteデータベースに保存され、サーバー再起動後も履歴が保持されます。データベースの場所は`DB_PATH`環境変数で設定できます。
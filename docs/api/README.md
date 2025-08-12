# CC-Anywhere API リファレンス

CC-AnywhereのREST APIエンドポイントの完全なリファレンスです。

## OpenAPI/Swagger ドキュメント

APIの詳細仕様は、OpenAPI 3.1.0仕様として定義されており、Swagger UIで対話的に確認できます。

### Swagger UIへのアクセス

開発サーバー起動後、以下のURLでSwagger UIにアクセスできます：

```
http://localhost:5000/api/docs
```

### OpenAPI仕様ファイル

OpenAPI仕様は `/backend/openapi.yaml` に定義されています。

### 特徴

- **対話的なドキュメント**: Swagger UIから直接APIをテストできます
- **型定義**: すべてのリクエスト/レスポンスの型が明確に定義されています
- **認証対応**: APIキー認証を設定してテストが可能です
- **自動更新**: コードと同期した最新のAPI仕様を提供します

## 目次

- [認証](#認証)
- [タスク管理](#タスク管理)
- [バッチタスク](#バッチタスク)
- [セッション管理](#セッション管理)
- [スケジューラー](#スケジューラー)
- [リポジトリエクスプローラー](#リポジトリエクスプローラー)
- [リポジトリ管理](#リポジトリ管理)
- [プリセット](#プリセット)
- [履歴](#履歴)
- [設定](#設定)
- [ワーカー管理](#ワーカー管理)
- [キュー管理](#キュー管理)
- [ヘルスチェック](#ヘルスチェック)
- [WebSocket](#websocket)

## 基本情報

### ベースURL
```
http://localhost:5000/api
```

### コンテンツタイプ
- リクエスト: `application/json`
- レスポンス: `application/json`

### 日付フォーマット
ISO 8601形式（例: `2024-01-15T10:30:00.000Z`）

## 認証

APIキーが設定されている場合、すべてのエンドポイントで認証が必要です。

### ヘッダー
```http
X-API-Key: your-api-key
```

### 認証エラーレスポンス
```json
{
  "error": "Unauthorized",
  "message": "Invalid or missing API key"
}
```

## タスク管理

### GET /api/tasks
タスク一覧を取得

**クエリパラメータ:**
| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| status | string | No | タスクステータス（pending, running, completed, failed, cancelled） |
| repository | string | No | リポジトリ名でフィルタ |
| limit | number | No | 取得件数（1-100、デフォルト: 20） |
| offset | number | No | オフセット（デフォルト: 0） |

**レスポンス例:**
```json
{
  "tasks": [
    {
      "taskId": "task-123",
      "status": "completed",
      "instruction": "READMEを更新してください",
      "createdAt": "2024-01-15T10:00:00.000Z",
      "startedAt": "2024-01-15T10:00:01.000Z",
      "completedAt": "2024-01-15T10:00:30.000Z",
      "workingDirectory": "/path/to/project",
      "result": {
        "output": "Task completed successfully",
        "filesChanged": ["README.md"]
      },
      "error": null,
      "logs": ["Starting task...", "Updating README..."],
      "retryMetadata": null,
      "allowedTools": null,
      "continuedFrom": null,
      "sdkSessionId": "session-456"
    }
  ],
  "total": 50,
  "limit": 20,
  "offset": 0
}
```

### POST /api/tasks
新しいタスクを作成

**リクエストボディ:**
```json
{
  "instruction": "実行する指示の内容",
  "repositoryName": "my-project",
  "context": {
    "workingDirectory": "/path/to/project",
    "files": ["README.md", "package.json"]
  },
  "options": {
    "timeout": 300000,
    "async": true,
    "retryOptions": {
      "maxRetries": 3,
      "initialDelay": 1000,
      "maxDelay": 60000
    },
    "allowedTools": ["read", "write", "run"],
    "sdk": {
      "permissionMode": "allow",
      "maxTurns": 30,
      "model": "claude-3.5-sonnet"
    }
  }
}
```

**レスポンス例:**
```json
{
  "taskId": "task-789",
  "status": "pending",
  "instruction": "実行する指示の内容",
  "createdAt": "2024-01-15T10:30:00.000Z",
  "workingDirectory": "/path/to/project"
}
```

### GET /api/tasks/:taskId
特定タスクの詳細を取得

**パスパラメータ:**
- `taskId`: タスクID

**レスポンス例:**
```json
{
  "taskId": "task-123",
  "status": "completed",
  "instruction": "READMEを更新してください",
  "createdAt": "2024-01-15T10:00:00.000Z",
  "startedAt": "2024-01-15T10:00:01.000Z",
  "completedAt": "2024-01-15T10:00:30.000Z",
  "result": {
    "output": "Task completed successfully"
  },
  "error": null,
  "logs": ["Starting task...", "Completed"],
  "conversation": [
    {
      "role": "user",
      "content": "READMEを更新してください"
    },
    {
      "role": "assistant",
      "content": "READMEを更新します..."
    }
  ]
}
```

### GET /api/tasks/:taskId/logs
タスクのログをストリーミング取得（Server-Sent Events）

**パスパラメータ:**
- `taskId`: タスクID

**レスポンス例（SSE形式）:**
```
data: {"type":"log","timestamp":"2024-01-15T10:00:01.000Z","message":"Starting task..."}
data: {"type":"log","timestamp":"2024-01-15T10:00:02.000Z","message":"Reading files..."}
data: {"type":"status","timestamp":"2024-01-15T10:00:30.000Z","status":"completed"}
```

### DELETE /api/tasks/:taskId
タスクをキャンセル

**パスパラメータ:**
- `taskId`: タスクID

**レスポンス例:**
```json
{
  "taskId": "task-123",
  "status": "cancelled",
  "message": "Task cancelled successfully"
}
```

### POST /api/tasks/:taskId/retry
タスクを再試行

**パスパラメータ:**
- `taskId`: タスクID

**リクエストボディ（オプション）:**
```json
{
  "instruction": "修正された指示（省略時は元の指示を使用）",
  "options": {
    "timeout": 600000
  }
}
```

### POST /api/tasks/:taskId/continue
タスクを継続実行

**パスパラメータ:**
- `taskId`: タスクID

**リクエストボディ:**
```json
{
  "additionalInstruction": "追加の指示内容",
  "options": {
    "timeout": 300000,
    "sdk": {
      "maxTurns": 20
    }
  }
}
```

## バッチタスク

### POST /api/batch/tasks
複数リポジトリへの一括タスク実行

**リクエストボディ:**
```json
{
  "instruction": "package.jsonの依存関係を更新",
  "repositories": [
    {
      "name": "project-1",
      "path": "/path/to/project1",
      "timeout": 300000,
      "retryOptions": {
        "maxRetries": 3,
        "initialDelay": 1000
      }
    },
    {
      "name": "project-2", 
      "path": "/path/to/project2"
    }
  ],
  "options": {
    "timeout": 600000,
    "parallel": true,
    "stopOnError": false,
    "sdk": {
      "permissionMode": "allow",
      "maxTurns": 30
    }
  }
}
```

**レスポンス例:**
```json
{
  "batchId": "batch-123",
  "tasks": [
    {
      "taskId": "task-456",
      "repository": "project-1",
      "status": "pending"
    },
    {
      "taskId": "task-789",
      "repository": "project-2",
      "status": "pending"
    }
  ],
  "totalTasks": 2,
  "createdAt": "2024-01-15T10:00:00.000Z"
}
```

### GET /api/batch/tasks/:batchId
バッチタスクの状態を取得

**パスパラメータ:**
- `batchId`: バッチID

**レスポンス例:**
```json
{
  "batchId": "batch-123",
  "status": "running",
  "progress": {
    "total": 2,
    "pending": 0,
    "running": 1,
    "completed": 1,
    "failed": 0
  },
  "tasks": [
    {
      "taskId": "task-456",
      "repository": "project-1",
      "status": "completed"
    },
    {
      "taskId": "task-789",
      "repository": "project-2",
      "status": "running"
    }
  ]
}
```

## セッション管理

### POST /api/sessions
新しいセッションを作成

**リクエストボディ:**
```json
{
  "workingDirectory": "/path/to/project",
  "options": {
    "model": "claude-3.5-sonnet",
    "maxTurns": 30
  }
}
```

### GET /api/sessions
セッション一覧を取得

**レスポンス例:**
```json
{
  "sessions": [
    {
      "sessionId": "session-123",
      "status": "active",
      "createdAt": "2024-01-15T10:00:00.000Z",
      "workingDirectory": "/path/to/project",
      "taskCount": 5
    }
  ]
}
```

### POST /api/sessions/:sessionId/continue
セッションを継続

**パスパラメータ:**
- `sessionId`: セッションID

**リクエストボディ:**
```json
{
  "instruction": "続きの指示",
  "context": {
    "additionalFiles": ["new-file.js"]
  }
}
```

### DELETE /api/sessions/:sessionId
セッションを削除

**パスパラメータ:**
- `sessionId`: セッションID

### GET /api/sessions/:sessionId/conversation
セッションの会話履歴を取得

**パスパラメータ:**
- `sessionId`: セッションID

### GET /api/sessions/:sessionId/tasks
セッションに関連するタスク一覧を取得

**パスパラメータ:**
- `sessionId`: セッションID

## スケジューラー

### POST /api/schedules
新しいスケジュールを作成

**リクエストボディ:**
```json
{
  "name": "日次バックアップ",
  "description": "毎日深夜にバックアップを実行",
  "cronExpression": "0 0 * * *",
  "timezone": "Asia/Tokyo",
  "instruction": "バックアップスクリプトを実行",
  "repositoryName": "my-project",
  "enabled": true,
  "options": {
    "timeout": 600000,
    "sdk": {
      "permissionMode": "allow"
    }
  }
}
```

### GET /api/schedules
スケジュール一覧を取得

**クエリパラメータ:**
| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| enabled | boolean | No | 有効/無効でフィルタ |
| repository | string | No | リポジトリ名でフィルタ |

### GET /api/schedules/:id
スケジュール詳細を取得

**パスパラメータ:**
- `id`: スケジュールID

### PUT /api/schedules/:id
スケジュールを更新

**パスパラメータ:**
- `id`: スケジュールID

**リクエストボディ:**
```json
{
  "name": "更新された名前",
  "cronExpression": "0 */6 * * *",
  "enabled": false
}
```

### DELETE /api/schedules/:id
スケジュールを削除

**パスパラメータ:**
- `id`: スケジュールID

### POST /api/schedules/:id/enable
スケジュールを有効化

**パスパラメータ:**
- `id`: スケジュールID

### POST /api/schedules/:id/disable
スケジュールを無効化

**パスパラメータ:**
- `id`: スケジュールID

### GET /api/schedules/:id/history
スケジュールの実行履歴を取得

**パスパラメータ:**
- `id`: スケジュールID

## リポジトリエクスプローラー

### GET /api/repositories/tree
ファイルツリーを取得

**クエリパラメータ:**
| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| repository | string | Yes | リポジトリのパス |
| path | string | No | サブディレクトリのパス |

**レスポンス例:**
```json
{
  "name": "my-project",
  "path": "/path/to/my-project",
  "type": "directory",
  "children": [
    {
      "name": "src",
      "path": "/path/to/my-project/src",
      "type": "directory",
      "children": [
        {
          "name": "index.js",
          "path": "/path/to/my-project/src/index.js",
          "type": "file",
          "size": 1024,
          "modifiedAt": "2024-01-15T10:00:00.000Z"
        }
      ]
    },
    {
      "name": "README.md",
      "path": "/path/to/my-project/README.md",
      "type": "file",
      "size": 2048,
      "modifiedAt": "2024-01-14T15:30:00.000Z"
    }
  ]
}
```

### GET /api/repositories/file
ファイル内容を取得

**クエリパラメータ:**
| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| repository | string | Yes | リポジトリのパス |
| path | string | Yes | ファイルの相対パス |

**レスポンス例:**
```json
{
  "path": "src/index.js",
  "content": "console.log('Hello World');",
  "encoding": "utf8",
  "size": 28,
  "mimeType": "text/javascript",
  "language": "javascript",
  "modifiedAt": "2024-01-15T10:00:00.000Z"
}
```

**エラーレスポンス（ファイルが大きすぎる場合）:**
```json
{
  "error": "File too large to read: 15MB"
}
```

### POST /api/repositories/watch
リポジトリのファイル監視を開始

**クエリパラメータ:**
| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| repository | string | Yes | リポジトリのパス |

**レスポンス例:**
```json
{
  "success": true,
  "message": "Started watching repository: /path/to/project"
}
```

### DELETE /api/repositories/watch
リポジトリのファイル監視を停止

**クエリパラメータ:**
| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| repository | string | Yes | リポジトリのパス |

**レスポンス例:**
```json
{
  "success": true,
  "message": "Stopped watching repository: /path/to/project"
}
```

### GET /api/repositories/watched
監視中のリポジトリ一覧を取得

**レスポンス例:**
```json
{
  "repositories": [
    "/path/to/project1",
    "/path/to/project2"
  ]
}
```

## リポジトリ管理

### GET /api/repositories
設定済みリポジトリ一覧を取得

**レスポンス例:**
```json
{
  "repositories": [
    {
      "name": "my-project",
      "path": "/path/to/my-project",
      "description": "メインプロジェクト"
    },
    {
      "name": "sub-project",
      "path": "/path/to/sub-project",
      "description": "サブプロジェクト"
    }
  ]
}
```

## プリセット

### GET /api/presets
プリセット一覧を取得

**クエリパラメータ:**
| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| category | string | No | カテゴリでフィルタ |
| search | string | No | 名前で検索 |

**レスポンス例:**
```json
{
  "presets": [
    {
      "id": "preset-1",
      "name": "コード品質チェック",
      "description": "ESLintとPrettierを実行",
      "category": "quality",
      "instruction": "npm run lint && npm run format",
      "options": {
        "timeout": 60000
      }
    }
  ]
}
```

### GET /api/presets/:id
プリセット詳細を取得

**パスパラメータ:**
- `id`: プリセットID

### POST /api/presets
プリセットを作成

**リクエストボディ:**
```json
{
  "name": "新しいプリセット",
  "description": "説明",
  "category": "custom",
  "instruction": "実行する指示",
  "options": {
    "timeout": 300000
  }
}
```

### PUT /api/presets/:id
プリセットを更新

**パスパラメータ:**
- `id`: プリセットID

### DELETE /api/presets/:id
プリセットを削除

**パスパラメータ:**
- `id`: プリセットID

## 履歴

### GET /api/history
タスク実行履歴を取得

**クエリパラメータ:**
| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| repository | string | No | リポジトリ名でフィルタ |
| status | string | No | ステータスでフィルタ |
| from | string | No | 開始日時（ISO 8601） |
| to | string | No | 終了日時（ISO 8601） |
| limit | number | No | 取得件数（デフォルト: 50） |
| offset | number | No | オフセット |

### GET /api/history/stats
統計情報を取得

**クエリパラメータ:**
| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| period | string | No | 期間（day, week, month, year） |
| repository | string | No | リポジトリ名でフィルタ |

**レスポンス例:**
```json
{
  "totalTasks": 150,
  "completedTasks": 120,
  "failedTasks": 10,
  "cancelledTasks": 5,
  "pendingTasks": 15,
  "averageExecutionTime": 45000,
  "successRate": 0.8
}
```

### DELETE /api/history
履歴を削除

**クエリパラメータ:**
| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| before | string | Yes | この日時より前の履歴を削除（ISO 8601） |

## 設定

### GET /api/settings
現在の設定を取得

**レスポンス例:**
```json
{
  "claude": {
    "apiKey": "***",
    "model": "claude-3.5-sonnet",
    "maxTokens": 4096
  },
  "server": {
    "port": 5000,
    "host": "localhost"
  },
  "features": {
    "worktree": true,
    "scheduler": true,
    "batch": true
  }
}
```

### PUT /api/settings
設定を更新

**リクエストボディ:**
```json
{
  "claude": {
    "model": "claude-3-opus",
    "maxTokens": 8192
  }
}
```

## ワーカー管理

### GET /api/workers
ワーカー状態を取得

**レスポンス例:**
```json
{
  "workers": [
    {
      "id": "worker-1",
      "status": "idle",
      "currentTask": null,
      "processedTasks": 45,
      "startedAt": "2024-01-15T08:00:00.000Z"
    },
    {
      "id": "worker-2",
      "status": "busy",
      "currentTask": "task-123",
      "processedTasks": 38,
      "startedAt": "2024-01-15T08:00:00.000Z"
    }
  ],
  "totalWorkers": 2,
  "activeWorkers": 1
}
```

### GET /api/workers/:id
特定ワーカーの詳細を取得

**パスパラメータ:**
- `id`: ワーカーID

### POST /api/workers
新しいワーカーを起動

**リクエストボディ:**
```json
{
  "count": 2,
  "options": {
    "maxConcurrentTasks": 5
  }
}
```

### DELETE /api/workers/:id
ワーカーを停止

**パスパラメータ:**
- `id`: ワーカーID

## キュー管理

### GET /api/queue
キューの状態を取得

**レスポンス例:**
```json
{
  "status": "running",
  "stats": {
    "pending": 5,
    "running": 2,
    "completed": 100,
    "failed": 3
  },
  "tasks": [
    {
      "taskId": "task-456",
      "position": 1,
      "priority": 10,
      "addedAt": "2024-01-15T10:00:00.000Z"
    }
  ]
}
```

### POST /api/queue/start
キューを開始

### POST /api/queue/pause
キューを一時停止

### POST /api/queue/clear
キューをクリア

### PUT /api/queue/:taskId/priority
タスクの優先度を変更

**パスパラメータ:**
- `taskId`: タスクID

**リクエストボディ:**
```json
{
  "priority": 100
}
```

### DELETE /api/queue/:taskId
キューからタスクを削除

**パスパラメータ:**
- `taskId`: タスクID

## ヘルスチェック

### GET /api/health
システムヘルスチェック

**レスポンス例:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:00:00.000Z",
  "services": {
    "database": "healthy",
    "queue": "healthy",
    "websocket": "healthy",
    "claude": "healthy"
  },
  "version": "1.0.0",
  "uptime": 86400
}
```

## WebSocket

WebSocketを使用してリアルタイムイベントを受信できます。

### 接続
```javascript
const ws = new WebSocket('ws://localhost:5000/ws');
```

### 認証
```javascript
ws.send(JSON.stringify({
  type: 'auth',
  payload: { apiKey: 'your-api-key' }
}));
```

### イベントタイプ

#### タスクイベント
```javascript
// タスク購読
ws.send(JSON.stringify({
  type: 'subscribe',
  payload: { taskId: 'task-123' }
}));

// タスク購読解除
ws.send(JSON.stringify({
  type: 'unsubscribe',
  payload: { taskId: 'task-123' }
}));

// 受信イベント
{
  "type": "task-update",
  "payload": {
    "taskId": "task-123",
    "status": "running",
    "progress": 50
  }
}

{
  "type": "task-log",
  "payload": {
    "taskId": "task-123",
    "timestamp": "2024-01-15T10:00:00.000Z",
    "message": "Processing file..."
  }
}

{
  "type": "task-complete",
  "payload": {
    "taskId": "task-123",
    "status": "completed",
    "result": { ... }
  }
}
```

#### リポジトリファイル変更イベント
```javascript
// 自動的にブロードキャスト
{
  "type": "repository-file-change",
  "payload": {
    "type": "added" | "changed" | "removed",
    "repository": "/path/to/repository",
    "path": "src/file.js",
    "timestamp": 1705315200000
  }
}
```

#### システムイベント
```javascript
{
  "type": "system-status",
  "payload": {
    "status": "healthy",
    "queueSize": 5,
    "activeWorkers": 2
  }
}
```

## エラーレスポンス

すべてのエラーレスポンスは以下の形式で返されます：

```json
{
  "error": "エラータイプ",
  "message": "詳細なエラーメッセージ",
  "code": "ERROR_CODE",
  "details": {
    "field": "追加の詳細情報"
  }
}
```

### 一般的なエラーコード

| HTTPステータス | エラーコード | 説明 |
|--------------|-------------|------|
| 400 | INVALID_REQUEST | リクエストが不正 |
| 401 | UNAUTHORIZED | 認証が必要または失敗 |
| 403 | FORBIDDEN | アクセス権限がない |
| 404 | NOT_FOUND | リソースが見つからない |
| 409 | CONFLICT | リソースの競合 |
| 413 | PAYLOAD_TOO_LARGE | リクエストサイズが大きすぎる |
| 429 | RATE_LIMITED | レート制限に達した |
| 500 | INTERNAL_ERROR | サーバー内部エラー |
| 503 | SERVICE_UNAVAILABLE | サービス利用不可 |

## レート制限

デフォルトでは以下のレート制限が適用されます：

- 全体: 100リクエスト/分
- タスク作成: 10リクエスト/分
- ファイル読み取り: 60リクエスト/分

レート制限に達した場合、以下のヘッダーが返されます：

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1705315200
Retry-After: 60
```

## ページネーション

一覧取得エンドポイントは標準的なページネーションをサポートします：

**リクエスト:**
```
GET /api/tasks?limit=20&offset=40
```

**レスポンス:**
```json
{
  "data": [...],
  "pagination": {
    "total": 150,
    "limit": 20,
    "offset": 40,
    "hasNext": true,
    "hasPrev": true
  }
}
```

## 使用例

### cURL

```bash
# タスク作成
curl -X POST http://localhost:5000/api/tasks \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "instruction": "READMEを更新",
    "repositoryName": "my-project"
  }'

# タスク状態確認
curl http://localhost:5000/api/tasks/task-123 \
  -H "X-API-Key: your-api-key"

# ファイルツリー取得
curl "http://localhost:5000/api/repositories/tree?repository=/path/to/project" \
  -H "X-API-Key: your-api-key"
```

### JavaScript (Fetch API)

```javascript
// タスク作成
const response = await fetch('http://localhost:5000/api/tasks', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'your-api-key'
  },
  body: JSON.stringify({
    instruction: 'READMEを更新',
    repositoryName: 'my-project'
  })
});

const task = await response.json();
console.log('Created task:', task.taskId);

// WebSocket接続
const ws = new WebSocket('ws://localhost:5000/ws');

ws.onopen = () => {
  // 認証
  ws.send(JSON.stringify({
    type: 'auth',
    payload: { apiKey: 'your-api-key' }
  }));
  
  // タスク購読
  ws.send(JSON.stringify({
    type: 'subscribe',
    payload: { taskId: task.taskId }
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Event:', data.type, data.payload);
};
```

### Python

```python
import requests
import json

# タスク作成
response = requests.post(
    'http://localhost:5000/api/tasks',
    headers={
        'Content-Type': 'application/json',
        'X-API-Key': 'your-api-key'
    },
    json={
        'instruction': 'READMEを更新',
        'repositoryName': 'my-project'
    }
)

task = response.json()
print(f"Created task: {task['taskId']}")

# タスク状態確認
response = requests.get(
    f"http://localhost:5000/api/tasks/{task['taskId']}",
    headers={'X-API-Key': 'your-api-key'}
)

status = response.json()
print(f"Task status: {status['status']}")
```

## 変更履歴

### v1.0.0 (2024-01-15)
- 初回リリース
- タスク管理API
- バッチ実行API
- スケジューラーAPI
- リポジトリエクスプローラーAPI
- WebSocketサポート
# APIリファレンス

## 認証

すべてのAPIエンドポイントは以下のいずれかの方法で認証が必要です：

**HTTPヘッダー（推奨）:**
```
X-API-Key: your-api-key
```

**クエリパラメータ:**
```
?apiKey=your-api-key
```

## タスク管理 API

### タスクの作成・実行

```
POST /api/tasks
```

**リクエストボディ:**

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| instruction | string | ✓ | 実行したいタスクの指示 |
| context.workingDirectory | string | - | 作業ディレクトリ |
| options.timeout | number | - | タイムアウト（ミリ秒） |
| options.async | boolean | - | 非同期実行フラグ |
| options.sdk.permissionMode | string | - | 権限モード（default/acceptEdits/bypassPermissions/plan） |
| options.sdk.allowedTools | string[] | - | 使用可能なツールを制限 |
| options.sdk.enableWebSearch | boolean | - | Web検索機能の有効化 |
| options.sdk.webSearchConfig | object | - | Web検索の詳細設定 |
| options.worktree.enabled | boolean | - | Git worktree機能の有効化 |
| options.useWorktree | boolean | - | Git worktree機能の有効化（簡易版） |
| options.sdk.maxTurns | number | - | 最大ターン数 |
| options.sdk.disallowedTools | string[] | - | 使用を禁止するツール |
| options.sdk.systemPrompt | string | - | カスタムシステムプロンプト |
| options.sdk.continueSession | boolean | - | セッション継続フラグ |
| options.sdk.resumeSession | string | - | 再開するセッションID |

**例:**
```bash
curl -X POST http://localhost:5000/api/tasks \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "instruction": "READMEファイルを分析してください",
    "context": {
      "workingDirectory": "/path/to/project"
    },
    "options": {
      "sdk": {
        "permissionMode": "acceptEdits"
      }
    }
  }'
```

### タスク一覧の取得

```
GET /api/tasks
```

**クエリパラメータ:**
- `status`: フィルタするステータス（pending, running, completed, failed, cancelled）
- `limit`: 取得件数（デフォルト: 20）
- `offset`: オフセット（ページネーション用）
- `sortBy`: ソートフィールド（createdAt, startedAt, completedAt）
- `sortOrder`: ソート順（asc, desc）

### タスクの状態取得

```
GET /api/tasks/{taskId}
```

### タスクのログ取得

```
GET /api/tasks/{taskId}/logs
```

### タスクのキャンセル

```
DELETE /api/tasks/{taskId}
```

### タスクのリトライ

```
POST /api/tasks/{taskId}/retry
```

失敗したタスクを再実行します。

## バッチタスク API

### バッチタスクの作成

```
POST /api/batch/tasks
```

**リクエストボディ:**

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| instruction | string | ✓ | 実行するタスクの指示 |
| repositories | array | ✓ | リポジトリの配列 |
| repositories[].name | string | ✓ | リポジトリ名 |
| repositories[].path | string | ✓ | リポジトリパス |
| options | object | - | タスクオプション（通常のタスクと同じ） |

### バッチタスクのステータス取得

```
GET /api/batch/tasks/{groupId}/status
```

## セッション管理 API

> **注意**: セッション管理機能は実装されていますが、Claude Code SDKのresumeSessionオプションにバグがあるため、現時点では正常に動作しません。
> 関連issue: https://github.com/anthropics/claude-code/issues/1967

### セッションの作成

```
POST /api/sessions
```

**リクエストボディ:**
```json
{
  "name": "セッション名",
  "description": "セッションの説明"
}
```

### セッション一覧の取得

```
GET /api/sessions
```

### セッション情報の取得

```
GET /api/sessions/{sessionId}
```

### セッションの継続（会話の続行）

```
POST /api/sessions/{sessionId}/continue
```

**リクエストボディ:**
```json
{
  "instruction": "続きの指示",
  "options": {
    "sdk": {
      "maxTurns": 3
    }
  }
}
```

### セッション履歴の取得

```
GET /api/sessions/{sessionId}/history
```

### セッションの削除

```
DELETE /api/sessions/{sessionId}
```

## スケジューラー API

### スケジュールの作成

```
POST /api/schedules
```

**リクエストボディ:**

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| name | string | ✓ | スケジュール名 |
| description | string | - | 説明 |
| taskRequest | object | ✓ | 実行するタスクの定義 |
| schedule.type | string | ✓ | "cron" または "once" |
| schedule.expression | string | - | Cron式（type="cron"の場合） |
| schedule.executeAt | string | - | 実行日時（type="once"の場合） |

**例:**
```bash
curl -X POST http://localhost:5000/api/schedules \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "毎日のバックアップ",
    "taskRequest": {
      "instruction": "プロジェクトをバックアップ",
      "options": {
        "sdk": {
          "permissionMode": "bypassPermissions"
        }
      }
    },
    "schedule": {
      "type": "cron",
      "expression": "0 2 * * *"
    }
  }'
```

### スケジュール一覧の取得

```
GET /api/schedules
```

### スケジュールの更新

```
PUT /api/schedules/{scheduleId}
```

### スケジュールの有効化

```
POST /api/schedules/{scheduleId}/enable
```

### スケジュールの無効化

```
POST /api/schedules/{scheduleId}/disable
```

### スケジュール実行履歴の取得

```
GET /api/schedules/{scheduleId}/history
```

### スケジュールの削除

```
DELETE /api/schedules/{scheduleId}
```

## タスクキュー管理 API

### キューにタスクを追加

```
POST /api/queue/tasks
```

**リクエストボディ:**
```json
{
  "instruction": "タスクの指示",
  "priority": 10,
  "context": {},
  "options": {}
}
```

### キューの統計情報

```
GET /api/queue/stats
```

### キュー内のタスク一覧

```
GET /api/queue/tasks
```

### キューの操作

```
POST /api/queue/start   # キューの開始
POST /api/queue/pause   # キューの一時停止
POST /api/queue/clear   # キューのクリア
```

### 並行実行数の更新

```
PUT /api/queue/concurrency
```

**リクエストボディ:**
```json
{
  "concurrency": 5
}
```

## タスク履歴 API

### タスク履歴の取得

```
GET /api/history/tasks
```

**クエリパラメータ:**
- `status`: ステータスフィルタ
- `startDate`: 開始日時
- `endDate`: 終了日時
- `limit`: 取得件数
- `offset`: オフセット

### タスク詳細の取得

```
GET /api/history/tasks/{taskId}
```

### 古いタスクの削除

```
DELETE /api/history/cleanup
```

**クエリパラメータ:**
- `olderThan`: この日数より古いタスクを削除（デフォルト: 30）

## プリセット管理 API

### プリセット一覧

```
GET /api/presets
```

### プリセットの取得

```
GET /api/presets/{id}
```

### プリセットの作成

```
POST /api/presets
```

**リクエストボディ:**
```json
{
  "name": "プリセット名",
  "description": "説明",
  "config": {
    "permissionMode": "acceptEdits",
    "maxTurns": 5,
    "allowedTools": ["Read", "Write"]
  }
}
```

### プリセットの更新

```
PUT /api/presets/{id}
```

### プリセットの削除

```
DELETE /api/presets/{id}
```

## ワーカー管理 API

### ワーカー一覧

```
GET /api/workers
```

### ワーカーのステータス

```
GET /api/workers/{workerId}
```

### ワーカーの起動

```
POST /api/workers
```

**リクエストボディ:**
```json
{
  "workerId": "worker-1"
}
```

### ワーカーの停止

```
DELETE /api/workers/{workerId}
```

## その他のエンドポイント

### ヘルスチェック

```
GET /health
```

### リポジトリ一覧

```
GET /api/repositories
```

### エコーテスト（デバッグ用）

```
POST /api/echo
```

リクエストボディをそのまま返します。

## エラーレスポンス

エラー時は以下の形式でレスポンスが返されます：

```json
{
  "error": "エラーメッセージ",
  "code": "ERROR_CODE",
  "statusCode": 400
}
```

### 一般的なエラーコード

| ステータスコード | エラーコード | 説明 |
|--------------|-----------|------|
| 400 | VALIDATION_ERROR | リクエストが無効 |
| 401 | UNAUTHORIZED | 認証エラー |
| 404 | NOT_FOUND | リソースが見つからない |
| 409 | TASK_ALREADY_EXISTS | タスクが既に存在 |
| 500 | INTERNAL_ERROR | サーバーエラー |

## WebSocket API

リアルタイムログストリーミング用のWebSocketエンドポイント：

```
ws://localhost:5000/ws
```

### 認証

接続後、以下のメッセージを送信：

```json
{
  "type": "auth",
  "apiKey": "your-api-key"
}
```

### メッセージタイプ

- `task.log`: タスクのログメッセージ
- `task.status`: タスクステータスの更新
- `task.progress`: タスクの進捗情報
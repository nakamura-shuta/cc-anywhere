# APIリファレンス

## 認証

すべてのAPIエンドポイントはヘッダーでAPIキーによる認証が必要です：

```
X-API-Key: your-api-key
```

## 主要エンドポイント

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

### タスクの状態取得

```
GET /api/tasks/{taskId}
```

### タスクのキャンセル

```
DELETE /api/tasks/{taskId}
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

### スケジュールの有効化/無効化

```
PUT /api/schedules/{scheduleId}/status
```

**リクエストボディ:**
```json
{
  "status": "active" | "inactive"
}
```

### スケジュールの削除

```
DELETE /api/schedules/{scheduleId}
```

## その他のエンドポイント

### ヘルスチェック

```
GET /health
```

### タスクキュー管理

```
POST /api/queue/tasks   # キューにタスクを追加
GET /api/queue/tasks    # キュー内のタスク一覧
```

### プリセット管理

```
GET /api/presets        # プリセット一覧
POST /api/presets       # プリセット作成
DELETE /api/presets/{id} # プリセット削除
```

## エラーレスポンス

エラー時は以下の形式でレスポンスが返されます：

```json
{
  "error": "エラーメッセージ",
  "code": "ERROR_CODE"
}
```

一般的なステータスコード：
- 400: リクエストが無効
- 401: 認証エラー
- 404: リソースが見つからない
- 500: サーバーエラー
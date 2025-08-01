# APIリファレンス

CC-AnywhereのREST APIエンドポイント仕様です。

## 🔐 認証

QR認証が有効な場合、すべてのAPIリクエストにトークンが必要です:

```bash
# ヘッダー
X-Auth-Token: your-token

# またはクエリパラメータ
?auth_token=your-token
```

## 📡 エンドポイント

### タスク実行

#### POST /api/tasks
新規タスクを作成・実行します。

```bash
curl -X POST http://localhost:5000/api/tasks \
  -H "Content-Type: application/json" \
  -H "X-Auth-Token: hello" \
  -d '{
    "instruction": "package.jsonを読み込んで依存関係を一覧表示して",
    "context": {
      "workingDirectory": "/path/to/project"
    },
    "options": {
      "timeout": 300000,
      "async": true
    }
  }'
```

**リクエスト:**
```json
{
  "instruction": "実行する指示（必須）",
  "context": {
    "workingDirectory": "作業ディレクトリ（必須）",
    "files": ["関連ファイル（オプション）"]
  },
  "options": {
    "timeout": 300000,           // タイムアウト（ミリ秒）
    "async": true,               // 非同期実行
    "repository": "リポジトリ名", // Git worktree使用時
    "sdk": {                     // Claude Code SDK オプション
      "permissionMode": "allow",
      "maxTurns": 30
    }
  }
}
```

**レスポンス:**
```json
{
  "taskId": "task-abc123",
  "status": "running",
  "createdAt": "2024-01-01T00:00:00Z"
}
```

#### GET /api/tasks/:taskId
タスクの詳細を取得します。

```bash
curl http://localhost:5000/api/tasks/task-abc123 \
  -H "X-Auth-Token: hello"
```

#### GET /api/tasks/:taskId/logs
タスクのログをストリーミングで取得します（Server-Sent Events）。

```bash
curl http://localhost:5000/api/tasks/task-abc123/logs \
  -H "X-Auth-Token: hello" \
  -H "Accept: text/event-stream"
```

#### DELETE /api/tasks/:taskId
実行中のタスクをキャンセルします。

```bash
curl -X DELETE http://localhost:5000/api/tasks/task-abc123 \
  -H "X-Auth-Token: hello"
```

### タスク継続

既存タスクから新しいタスクを作成して継続実行します。

```bash
curl -X POST http://localhost:5000/api/tasks \
  -H "Content-Type: application/json" \
  -H "X-Auth-Token: hello" \
  -d '{
    "instruction": "前のタスクで作成したファイルにテストを追加して",
    "context": {
      "workingDirectory": "/path/to/project"
    },
    "options": {
      "sdk": {
        "continueFromTaskId": "task-abc123"  // 継続元のタスクID
      }
    }
  }'
```

### セッション管理

#### POST /api/sessions
新規セッションを作成します。

```bash
curl -X POST http://localhost:5000/api/sessions \
  -H "Content-Type: application/json" \
  -H "X-Auth-Token: hello" \
  -d '{
    "name": "My Session",
    "context": {
      "workingDirectory": "/path/to/project"
    }
  }'
```

#### POST /api/sessions/:sessionId/messages
セッションにメッセージを送信します。

```bash
curl -X POST http://localhost:5000/api/sessions/session-123/messages \
  -H "Content-Type: application/json" \
  -H "X-Auth-Token: hello" \
  -d '{
    "message": "package.jsonを更新して"
  }'
```

### バッチ実行

#### POST /api/batch/tasks
複数のタスクを一括で作成します。

```bash
curl -X POST http://localhost:5000/api/batch/tasks \
  -H "Content-Type: application/json" \
  -H "X-Auth-Token: hello" \
  -d '{
    "instruction": "すべてのテストを実行",
    "repositories": ["repo1", "repo2", "repo3"],
    "options": {
      "async": true
    }
  }'
```

### スケジューラー

#### GET /api/schedules
スケジュール一覧を取得します。

#### POST /api/schedules
新規スケジュールを作成します。

```bash
curl -X POST http://localhost:5000/api/schedules \
  -H "Content-Type: application/json" \
  -H "X-Auth-Token: hello" \
  -d '{
    "name": "Daily Test",
    "cron": "0 9 * * *",
    "task": {
      "instruction": "npm test",
      "context": {
        "workingDirectory": "/path/to/project"
      }
    }
  }'
```

### キュー管理

#### GET /api/queue/stats
キューの統計情報を取得します。

#### PUT /api/queue/concurrency
同時実行数を変更します。

```bash
curl -X PUT http://localhost:5000/api/queue/concurrency \
  -H "Content-Type: application/json" \
  -H "X-Auth-Token: hello" \
  -d '{"concurrency": 5}'
```

### その他

#### GET /health
ヘルスチェック

#### GET /api/repositories
リポジトリ一覧

#### GET /api/presets
プリセット一覧

## 🔄 WebSocket

リアルタイム通信用のWebSocketエンドポイント。

```javascript
const ws = new WebSocket('ws://localhost:5000/ws');

// 認証
ws.send(JSON.stringify({
  type: 'auth',
  payload: { apiKey: 'hello' }
}));

// タスクをサブスクライブ
ws.send(JSON.stringify({
  type: 'subscribe',
  payload: { taskId: 'task-abc123' }
}));

// ハートビート（30秒ごと）
setInterval(() => {
  ws.send(JSON.stringify({
    type: 'ping',
    payload: { timestamp: Date.now() }
  }));
}, 30000);
```

## 🔧 SDKオプション

Claude Code SDKの詳細オプション:

```json
{
  "sdk": {
    "permissionMode": "allow",      // ask|allow|deny|bypassPermissions
    "maxTurns": 30,                 // 最大ターン数
    "systemPrompt": "カスタムプロンプト",
    "disallowedTools": ["Read"],    // 使用禁止ツール
    "continueFromTaskId": "task-id" // タスク継続
  }
}
```

## 📝 エラーレスポンス

```json
{
  "error": {
    "message": "エラーメッセージ",
    "statusCode": 400,
    "code": "INVALID_REQUEST"
  }
}
```

## 📖 関連ドキュメント

- [エラーハンドリング](./error-handling-guide.md) - エラー処理の統一ガイド
- [Claude Code SDK](./sdk/claude-code-sdk-features.md) - SDK固有機能の詳細
- [はじめに](../getting-started/) - インストールと基本設定
- [機能ガイド](../features/) - 各機能の詳細な使い方
- [デプロイメント](../deployment/) - 本番環境へのデプロイ方法
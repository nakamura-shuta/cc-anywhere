# WebSocket Support

CC-Anywhereは、タスクの実行状態とログをリアルタイムで監視するためのWebSocketサポートを提供します。

## 概要

WebSocketを使用すると、以下のことが可能になります：

- タスクの状態変更をリアルタイムで受信
- タスク実行中のログをストリーミングで取得
- 複数のタスクを同時に監視
- 効率的な双方向通信

## WebSocketエンドポイント

WebSocketサーバーは以下のエンドポイントで利用可能です：

```
ws://localhost:3000/ws
```

## 認証

WebSocket接続を確立した後、最初に認証メッセージを送信する必要があります：

```json
{
  "type": "auth",
  "payload": {
    "apiKey": "your-api-key"
  }
}
```

認証が成功すると、以下のメッセージを受信します：

```json
{
  "type": "auth:success",
  "payload": {
    "message": "Authenticated successfully"
  }
}
```

## タスクのサブスクリプション

特定のタスクの更新を受信するには、タスクIDでサブスクライブします：

```json
{
  "type": "subscribe",
  "payload": {
    "taskId": "task-123"
  }
}
```

サブスクリプションを解除するには：

```json
{
  "type": "unsubscribe",  
  "payload": {
    "taskId": "task-123"
  }
}
```

## メッセージタイプ

### タスク状態更新

タスクの状態が変更されると、以下のメッセージを受信します：

```json
{
  "type": "task:update",
  "payload": {
    "taskId": "task-123",
    "status": "running",
    "timestamp": "2024-01-01T12:00:00Z",
    "metadata": {
      "startedAt": "2024-01-01T12:00:00Z"
    }
  }
}
```

### タスクログ

タスク実行中のログメッセージ：

```json
{
  "type": "task:log",
  "payload": {
    "taskId": "task-123",
    "log": "Processing file...",
    "timestamp": "2024-01-01T12:00:01Z",
    "level": "info"
  }
}
```

### ツール実行イベント

ツール実行開始：

```json
{
  "type": "task:tool:start",
  "payload": {
    "taskId": "task-123",
    "toolId": "tool-456",
    "tool": "Write",
    "input": { "file_path": "test.txt", "content": "Hello" },
    "timestamp": "2024-01-20T10:00:00Z"
  }
}
```

ツール実行終了：

```json
{
  "type": "task:tool:end",
  "payload": {
    "taskId": "task-123",
    "toolId": "tool-456",
    "tool": "Write",
    "output": "File written successfully",
    "error": null,
    "duration": 125,
    "success": true,
    "timestamp": "2024-01-20T10:00:00.125Z"
  }
}
```

### Claude応答イベント

```json
{
  "type": "task:claude:response",
  "payload": {
    "taskId": "task-123",
    "text": "I'll create a hello world file for you...",
    "turnNumber": 1,
    "timestamp": "2024-01-20T10:00:00Z"
  }
}
```

### TODO更新イベント

```json
{
  "type": "todo:update",
  "payload": {
    "taskId": "task-123",
    "todos": [
      {
        "id": "todo-1",
        "content": "Create hello world file",
        "status": "completed",
        "priority": "high"
      }
    ]
  }
}
```

### 統計情報イベント

```json
{
  "type": "task:statistics",
  "payload": {
    "taskId": "task-123",
    "statistics": {
      "totalTurns": 3,
      "totalToolCalls": 5,
      "toolStats": {
        "Write": {
          "count": 2,
          "successes": 2,
          "failures": 0,
          "totalDuration": 250,
          "avgDuration": 125
        }
      },
      "currentPhase": "complete",
      "elapsedTime": 5000
    }
  }
}
```

### エラーメッセージ

エラーが発生した場合：

```json
{
  "type": "error",
  "payload": {
    "message": "Error description",
    "code": "ERROR_CODE"
  }
}
```

## ハートビート

接続の維持のため、定期的にpingメッセージを送信できます：

```json
{
  "type": "ping",
  "payload": {
    "timestamp": 1704110400000
  }
}
```

サーバーはpongメッセージで応答します：

```json
{
  "type": "pong",
  "payload": {
    "timestamp": 1704110400001
  }
}
```

## サンプルクライアント

### JavaScript/Node.js

```javascript
const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:3000/ws');

ws.on('open', () => {
  // 認証
  ws.send(JSON.stringify({
    type: 'auth',
    payload: { apiKey: 'your-api-key' }
  }));
});

ws.on('message', (data) => {
  const message = JSON.parse(data);
  
  switch (message.type) {
    case 'auth:success':
      // タスクにサブスクライブ
      ws.send(JSON.stringify({
        type: 'subscribe',
        payload: { taskId: 'task-123' }
      }));
      break;
      
    case 'task:update':
      console.log('Task status:', message.payload.status);
      break;
      
    case 'task:log':
      console.log('Log:', message.payload.log);
      break;
  }
});
```

### Python

```python
import websocket
import json

def on_message(ws, message):
    data = json.loads(message)
    
    if data['type'] == 'auth:success':
        # タスクにサブスクライブ
        ws.send(json.dumps({
            'type': 'subscribe',
            'payload': {'taskId': 'task-123'}
        }))
    elif data['type'] == 'task:update':
        print(f"Task status: {data['payload']['status']}")
    elif data['type'] == 'task:log':
        print(f"Log: {data['payload']['log']}")

def on_open(ws):
    # 認証
    ws.send(json.dumps({
        'type': 'auth',
        'payload': {'apiKey': 'your-api-key'}
    }))

ws = websocket.WebSocketApp("ws://localhost:3000/ws",
                            on_open=on_open,
                            on_message=on_message)
ws.run_forever()
```

## 設定

WebSocketサーバーは以下の環境変数で設定できます：

- `WEBSOCKET_ENABLED`: WebSocketサーバーを有効にする（デフォルト: true）
- `WEBSOCKET_HEARTBEAT_INTERVAL`: ハートビート間隔（ミリ秒、デフォルト: 30000）
- `WEBSOCKET_HEARTBEAT_TIMEOUT`: ハートビートタイムアウト（ミリ秒、デフォルト: 60000）
- `WEBSOCKET_AUTH_TIMEOUT`: 認証タイムアウト（ミリ秒、デフォルト: 10000）

## セキュリティ考慮事項

- WebSocket接続にはHTTPと同じAPIキーベースの認証を使用
- 認証されていないクライアントはタスク情報にアクセスできません
- 各クライアントは明示的にサブスクライブしたタスクの情報のみ受信します
- タイムアウトによる自動切断でリソースを保護
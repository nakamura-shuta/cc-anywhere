# API リファレンス

## 認証

```bash
# ヘッダー
X-API-Key: your-token
```

## エンドポイント

### タスク実行

**POST /api/tasks**
```json
{
  "instruction": "実行する指示",
  "context": {
    "workingDirectory": "/path/to/project"
  },
  "options": {
    "timeout": 300000,
    "async": true,
    "sdk": {
      "permissionMode": "allow",
      "maxTurns": 30
    }
  }
}
```

**GET /api/tasks/:taskId** - タスク詳細

**GET /api/tasks/:taskId/logs** - ログストリーミング

**DELETE /api/tasks/:taskId** - キャンセル

### WebSocket

```javascript
const ws = new WebSocket('ws://localhost:5000/ws');

// 認証
ws.send(JSON.stringify({
  type: 'auth',
  payload: { apiKey: 'your-token' }
}));

// タスク購読
ws.send(JSON.stringify({
  type: 'subscribe',
  payload: { taskId: 'task-id' }
}));
```
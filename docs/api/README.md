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

### リポジトリエクスプローラー

**GET /api/repositories/tree** - ファイルツリー取得
```bash
GET /api/repositories/tree?repository=/path/to/repo&path=subdirectory
```

**GET /api/repositories/file** - ファイル内容取得
```bash
GET /api/repositories/file?repository=/path/to/repo&path=file.txt
```

**POST /api/repositories/watch** - ファイル監視開始
```bash
POST /api/repositories/watch?repository=/path/to/repo
```

**DELETE /api/repositories/watch** - ファイル監視停止
```bash
DELETE /api/repositories/watch?repository=/path/to/repo
```

**GET /api/repositories/watched** - 監視中リポジトリ一覧
```json
{
  "repositories": ["/path/to/repo1", "/path/to/repo2"]
}
```

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

// リポジトリファイル変更通知を受信
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'repository-file-change') {
    // data.payload: { type: 'added'|'changed'|'removed', repository, path, timestamp }
  }
};
```
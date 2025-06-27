# CC-Anywhere Documentation

CC-Anywhereは、Claude Code SDKを使用してHTTP経由でタスクを実行できるサーバーアプリケーションです。

## 目次

### APIドキュメント
- [APIリファレンス](./api/api-reference.md) - 全エンドポイントの詳細
- [API使用例](./api/api-examples.md) - 実際の使用例とサンプルコード

### 実装ガイド
- [WebSocket通信](./guides/websocket.md) - リアルタイムログとステータス更新
- [タイムアウト処理](./guides/timeout-handling.md) - 高度なタイムアウト制御
- [ワーカー使用ガイド](./guides/worker-usage.md) - ワーカーシステムの詳細な使用方法

### アーキテクチャ
- [ワーカーシステム](./architecture/worker-system.md) - 並行タスク処理
- [キューアーキテクチャ](./architecture/queue-architecture.md) - タスクキューの設計

### コード例
- [サンプルコード](./examples/) - WebSocketクライアントなどの実装例

## クイックスタート

### 1. サーバーの起動

```bash
npm install
npm run dev
```

### 2. タスクの作成

```bash
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "instruction": "ファイルの内容を読み取って要約してください",
    "context": {
      "workingDirectory": "/path/to/project"
    }
  }'
```

### 3. WebSocket接続

```javascript
const ws = new WebSocket('ws://localhost:3000/ws?apiKey=your-key');

ws.on('open', () => {
  ws.send(JSON.stringify({
    type: 'subscribe',
    payload: { taskId: 'task-123' }
  }));
});

ws.on('message', (data) => {
  const message = JSON.parse(data);
  console.log('Received:', message);
});
```

## 主な機能

- **非同期タスク実行**: Claude Code SDKを使用した高度なタスク処理
- **リアルタイム通信**: WebSocketによるログストリーミング
- **柔軟なタイムアウト**: フェーズ別のタイムアウト制御
- **自動リトライ**: エラー時の自動再試行
- **並行処理**: 複数のワーカーによる効率的な処理
- **永続化**: SQLiteによるタスク履歴の保存

## アーキテクチャ

CC-Anywhereは以下のコンポーネントで構成されています：

1. **HTTPサーバー** (Fastify) - RESTful APIの提供
2. **WebSocketサーバー** - リアルタイム通信
3. **タスクキュー** - 効率的なタスク管理
4. **ワーカープール** - 並行タスク処理
5. **データベース** (SQLite) - タスクの永続化
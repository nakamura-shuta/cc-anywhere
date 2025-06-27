# コード例

このディレクトリには、CC-Anywhereの使用例が含まれています。

## WebSocketクライアント

- [websocket-client.js](./websocket-client.js) - Node.jsでWebSocket接続を行うクライアントの例

### 使用方法

```bash
# WebSocketクライアントを起動
node docs/examples/websocket-client.js [taskId]

# タスクIDを指定して特定のタスクをサブスクライブ
node docs/examples/websocket-client.js task-123-456-789
```

## その他の例

より詳細な使用例については以下を参照してください：

- [API使用例](../api/api-examples.md) - REST APIの使用例
- [ワーカー使用ガイド](../guides/worker-usage.md) - ワーカーシステムの詳細な使用方法
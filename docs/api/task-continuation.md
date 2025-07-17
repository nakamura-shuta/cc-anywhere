# Task Continuation API

## 概要

タスク継続APIを使用すると、完了したタスクの会話コンテキストを引き継いで新しいタスクを作成できます。これにより、Claude Code SDKとの対話を複数のタスクにまたがって継続することが可能になります。

## エンドポイント

### POST /api/tasks/:taskId/continue

完了したタスクから新しい継続タスクを作成します。

#### リクエスト

```bash
POST /api/tasks/{parentTaskId}/continue
X-API-Key: your-api-key
Content-Type: application/json

{
  "instruction": "継続タスクの指示内容",
  "context": {
    "workingDirectory": "/path/to/project" // オプション
  },
  "options": {
    "timeout": 300000,
    "sdk": {
      "maxTurns": 10,
      "systemPrompt": "カスタムシステムプロンプト" // オプション
    }
  }
}
```

#### レスポンス

```json
{
  "taskId": "new-task-id",
  "status": "pending",
  "instruction": "継続タスクの指示内容",
  "createdAt": "2024-01-20T10:30:00.000Z",
  "continuedFrom": "parent-task-id"
}
```

#### エラーレスポンス

- **404 Not Found**: 親タスクが見つからない場合
```json
{
  "error": {
    "message": "Parent task not found",
    "statusCode": 404,
    "code": "PARENT_TASK_NOT_FOUND"
  }
}
```

- **400 Bad Request**: 親タスクが完了していない場合
```json
{
  "error": {
    "message": "Can only continue from completed tasks",
    "statusCode": 400,
    "code": "INVALID_STATE"
  }
}
```

## 使用例

### 基本的な使用例

```javascript
// 1. 最初のタスクを実行
const firstResponse = await fetch('http://localhost:5000/api/tasks', {
  method: 'POST',
  headers: {
    'X-API-Key': 'your-api-key',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    instruction: "フィボナッチ数列の第10項を計算してください"
  })
});

const { taskId } = await firstResponse.json();

// 2. タスクの完了を待つ（実際にはWebSocketやポーリングで監視）
await waitForTaskCompletion(taskId);

// 3. 継続タスクを作成
const continueResponse = await fetch(`http://localhost:5000/api/tasks/${taskId}/continue`, {
  method: 'POST',
  headers: {
    'X-API-Key': 'your-api-key',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    instruction: "さっき計算した数は素数ですか？"
  })
});

const continuationTask = await continueResponse.json();
```

### カスタムシステムプロンプトを使用

```javascript
const continueResponse = await fetch(`http://localhost:5000/api/tasks/${taskId}/continue`, {
  method: 'POST',
  headers: {
    'X-API-Key': 'your-api-key',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    instruction: "前回の実装にテストを追加してください",
    options: {
      sdk: {
        systemPrompt: "あなたはTDDの専門家です。常にテストファーストで実装してください。"
      }
    }
  })
});
```

## 実装詳細

### 会話履歴の保存

タスクが完了すると、Claude Code SDKから返されたメッセージ（SDKMessage[]）がデータベースの`conversation_history`フィールドに保存されます。

### 会話コンテキストの引き継ぎ

継続タスクを作成する際、以下の情報が引き継がれます：

1. **会話履歴**: 親タスクの完全な会話履歴（SDKメッセージ）
2. **作業ディレクトリ**: 親タスクの作業ディレクトリ（指定されていない場合）
3. **システムプロンプト**: 会話履歴を含む自動生成されたプロンプト

### システムプロンプトの自動生成

継続タスクには、以下の形式でシステムプロンプトが自動的に追加されます：

```
Previous conversation:
User: [親タスクの指示]
Assistant: [親タスクの応答]
[ツール使用情報]

Please continue from the above conversation, maintaining context and remembering what was discussed.
```

## 制限事項

1. **親タスクの状態**: 親タスクは`completed`状態である必要があります
2. **プロセス分離**: 各タスクは独立したプロセスで実行されるため、Claude Code SDKの`continue`オプションは使用できません
3. **会話履歴のサイズ**: 大きな会話履歴はデータベースのストレージとパフォーマンスに影響する可能性があります

## 関連情報

- [タスクAPI](./tasks.md)
- [Claude Code SDK設定](./claude-code-sdk.md)
- [WebSocket通知](./websocket.md)
# マルチExecutor対応機能

## 概要

CC-Anywhereは複数のAgent SDKをサポートし、タスク実行時にExecutorを選択できる機能を提供します。

現在サポートされているExecutor:
- **Claude Agent SDK**: Anthropic公式のエージェントフレームワーク（デフォルト）
- **OpenAI Codex SDK**: OpenAIのコーディングアシスタント

## アーキテクチャ

### Executor抽象化

すべてのExecutorは共通の`IAgentExecutor`インターフェースを実装します：

```typescript
interface IAgentExecutor {
  executeTask(
    request: AgentTaskRequest,
    options: AgentExecutionOptions
  ): AsyncIterator<AgentExecutionEvent>;

  cancelTask(taskId: string): Promise<void>;
  getExecutorType(): ExecutorType;
}
```

### Factory Pattern

`AgentExecutorFactory`がリクエストに応じて適切なExecutorインスタンスを生成します：

```typescript
const executor = AgentExecutorFactory.create(executorType);
const events = executor.executeTask(request, options);
```

### イベント統一

すべてのExecutorは統一されたイベント形式でタスクの進捗を報告します：

- `agent:start`: タスク開始
- `agent:progress`: 進捗更新
- `agent:tool_use`: ツール使用
- `agent:completed`: タスク完了
- `agent:error`: エラー発生

## 使用方法

### API経由でのExecutor選択

#### タスク作成時

```bash
curl -X POST http://localhost:5000/api/queue/tasks \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "instruction": "Create a README file",
    "context": {
      "workingDirectory": "/path/to/repo"
    },
    "options": {
      "executor": "claude"
    }
  }'
```

#### 利用可能なExecutorの確認

```bash
curl -X GET http://localhost:5000/api/executors \
  -H "X-API-Key: your-api-key"
```

レスポンス例：
```json
{
  "executors": [
    {
      "type": "claude",
      "available": true,
      "description": "Claude Agent SDK - Official Anthropic agent framework"
    },
    {
      "type": "codex",
      "available": false,
      "description": "OpenAI Codex SDK - AI coding assistant"
    }
  ]
}
```

### フロントエンドでのExecutor選択

タスク作成画面で、ドロップダウンメニューからExecutorを選択できます：

1. 「新規タスク作成」ページを開く
2. 「Executor」セレクターから使用するExecutorを選択
3. その他の設定を入力
4. 「タスクを作成」をクリック

### タスク情報の確認

作成されたタスクには使用されたExecutorの情報が記録されます：

- **タスクリスト**: 各タスク項目にExecutorバッジが表示されます
- **タスク詳細**: タスク詳細ページにExecutor情報セクションが表示されます

## データベーススキーマ

タスクテーブルに以下のカラムが追加されています：

- `executor` (VARCHAR): 使用されたExecutorタイプ（"claude" | "codex"）
- `executor_metadata` (JSON): Executor固有のメタデータ

## 拡張性

新しいExecutorの追加は以下の手順で行います：

1. `IAgentExecutor`インターフェースを実装した新しいクラスを作成
2. `ExecutorType`型定義に新しいタイプを追加
3. `AgentExecutorFactory`に新しいExecutorの生成ロジックを追加
4. 必要に応じてデータベースマイグレーションを作成

```typescript
// 例: Gemini Executor
class GeminiAgentExecutor implements IAgentExecutor {
  async *executeTask(request, options) {
    // Gemini SDK統合実装
    yield { type: "agent:start", executor: "gemini", timestamp: new Date() };
    // ...
  }

  async cancelTask(taskId: string) {
    // キャンセル処理実装
  }

  getExecutorType(): ExecutorType {
    return "gemini";
  }
}
```

## トラブルシューティング

### Executorが利用不可の場合

特定のExecutorが利用できない場合、以下を確認してください：

1. **環境変数の設定**: 必要なAPI キーや認証情報が設定されているか
2. **SDK のインストール**: 必要なSDKパッケージがインストールされているか
3. **ネットワーク接続**: 外部APIへの接続が可能か

### デフォルトExecutorの変更

システムのデフォルトExecutorは`claude`です。これを変更する場合は、環境変数または設定ファイルで指定できます（今後の機能拡張で対応予定）。

## パフォーマンス考慮事項

- Executorの選択はタスクの性質に応じて行ってください
- 各Executorには異なる特性があります：
  - **Claude**: 会話的な対話、複雑な推論、包括的なタスク実行
  - **Codex**: コード生成、技術的なタスク（実装予定）

## セキュリティ

- Executor固有の認証情報は環境変数で管理されます
- APIキー等の機密情報はログに記録されません
- Executor間でセッション情報は共有されません

## 参照

- [API ドキュメント](../backend/openapi.yaml)
- [バックエンドアーキテクチャ](./architecture.md)
- [開発ガイド](../README.md)

# 会話履歴機能

## 概要

会話履歴機能は、Claude Code SDKとの対話履歴をデータベースに永続化する機能です。タスク実行中のすべての会話（ユーザーの指示とClaudeの応答）が自動的に保存され、後から参照できます。

## 機能の詳細

### 自動保存

タスクが完了すると、以下の情報が自動的にデータベースに保存されます：

- ユーザーの指示
- Claudeの応答
- ツール使用の履歴
- タスクの成功/失敗に関わらず保存

### データベーススキーマ

```sql
ALTER TABLE tasks ADD COLUMN conversationHistory TEXT
```

会話履歴はJSON形式で保存されます：

```json
[
  {
    "type": "user",
    "content": "Test instruction"
  },
  {
    "type": "assistant",
    "content": "Test response"
  }
]
```

## API

### タスクリポジトリ

```typescript
interface ITaskRepository {
  updateConversationHistory(id: string, conversationHistory: unknown): Promise<void>;
}
```

### 使用例

```typescript
// タスク実行後、会話履歴を保存
const result = await executor.execute(task);
if (result.conversationHistory) {
  await repository.updateConversationHistory(
    task.id,
    result.conversationHistory
  );
}
```

## フロントエンド連携

会話履歴はタスク詳細画面で確認できます：

```typescript
// GET /api/tasks/:id
{
  "taskId": "...",
  "status": "completed",
  "conversationHistory": [
    // 会話履歴の配列
  ]
}
```

## 自動マイグレーション

既存のデータベースに対して、自動的に`conversationHistory`カラムが追加されます。手動でのマイグレーション作業は不要です。

## パフォーマンス考慮事項

- 会話履歴はJSON形式でテキスト保存されます
- 大量の会話履歴が予想される場合、定期的なクリーンアップを検討してください
- SQLiteのパフォーマンス特性上、数千件程度までは問題なく動作します

## トラブルシューティング

### 会話履歴が保存されない

1. タスクが正常に完了しているか確認
2. データベースの接続状態を確認
3. ログで`updateConversationHistory`が呼ばれているか確認

### 既存タスクに会話履歴がない

- 会話履歴機能は新しく追加された機能です
- この機能が実装される前のタスクには会話履歴が含まれません
- 新しいタスクから自動的に保存されます

## 関連ファイル

- `backend/src/repositories/task-repository.ts` - リポジトリ実装
- `backend/src/repositories/types.ts` - インターフェース定義
- `backend/src/queue/task-queue.ts` - 会話履歴保存のロジック
- `backend/tests/unit/conversation-history.test.ts` - テスト

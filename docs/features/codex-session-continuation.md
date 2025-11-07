# Codex Executor セッション継続機能

## 概要

Codex Executor のセッション継続機能は、Codex SDK のスレッド（thread）を使用して、複数のタスクにわたって会話の文脈を保持する機能です。これにより、前回の作業内容を引き継いで追加の指示を実行できます。

## 機能の詳細

### セッション継続の仕組み

Codex SDK では、各会話が「スレッド（Thread）」として管理されます。スレッドには以下の特徴があります：

- **Thread ID**: 各スレッドには一意の ID が割り当てられます
- **文脈の保持**: スレッド内の全ての会話履歴が保持されます
- **再開可能**: Thread ID を指定することで、過去のスレッドを継続できます

### データフロー

```
1. 初回タスク実行
   ↓
2. Codex SDK が Thread ID を返す
   ↓
3. Thread ID を sdkSessionId として保存
   ↓
4. ユーザーが「継続」ボタンをクリック
   ↓
5. 前回の Thread ID を使用して新しいタスクを作成
   ↓
6. Codex SDK が同じスレッドで会話を継続
```

## API 使用方法

### タスク作成時にセッション継続を指定

```typescript
// POST /api/tasks
{
  "instruction": "前回の変更を確認して、追加の修正を実施してください",
  "context": {
    "workingDirectory": "/path/to/repo"
  },
  "options": {
    "executor": "codex",
    "codex": {
      "sandboxMode": "workspace-write",
      "continueSession": true,
      "resumeSession": "thread-abc123"  // 前回のタスクの Thread ID
    }
  }
}
```

### レスポンスに含まれる Thread ID

```typescript
// タスク完了後のレスポンス
{
  "taskId": "task-xyz",
  "status": "completed",
  "executor": "codex",
  "sdkSessionId": "thread-abc123",  // Codex の Thread ID
  // ...
}
```

## フロントエンド連携

### タスク詳細ページでの表示

Codex Executor を使用したタスクでは、以下のように表示されます：

- **セッション ID 表示**: "Thread ID（継続で使用可能）" として表示
- **継続ボタン**: "スレッドを継続" ボタンで次のタスクを作成
- **CLI 指示**: Codex は CLI 継続をサポートしていないため非表示

### タスク作成フォームでの継続

1. タスク詳細ページで「Web UI で継続する」ボタンをクリック
2. タスク作成フォームが開き、以下が自動設定される：
   - Executor: `codex`（変更不可）
   - Thread ID: 前回のタスクの Thread ID
   - Sandbox Mode: 前回の設定を引き継ぎ
   - Model: 前回の設定を引き継ぎ
   - 作業ディレクトリ: 前回の作業ディレクトリを引き継ぎ

## Executor の制限事項

### セッション継続時の Executor 変更不可

セッション継続時は Executor を変更できません：

- **理由**: Claude と Codex のセッション形式が異なるため
- **UI**: Executor 選択が無効化され、変更不可であることを表示
- **実装**: `frontend/src/routes/tasks/new/+page.svelte:327-336`

### Claude との違い

| 機能 | Claude Executor | Codex Executor |
|-----|----------------|----------------|
| セッション ID | Session ID | Thread ID |
| CLI 継続 | サポート | 非サポート |
| Web UI 継続 | サポート | サポート |
| Session 形式 | Claude Code SDK Session | Codex Thread |

## バックエンド実装

### CodexAgentExecutor

`backend/src/agents/codex-agent-executor.ts` で実装されています：

```typescript
export class CodexAgentExecutor implements AgentExecutor {
  async *executeAgent(
    instruction: string,
    workingDirectory: string,
    options: ClaudeSDKOptions
  ): AsyncGenerator<AgentEvent> {
    // オプションから Thread ID を取得
    const resumeThreadId = options.codex?.resumeSession;

    // Thread ID が指定されている場合は再開、なければ新規作成
    const thread = resumeThreadId
      ? codex.resumeThread({ threadId: resumeThreadId })
      : codex.startThread({ workingDirectory });

    // タスクを実行
    const result = await thread.runStreamed({ instruction });

    // Thread ID をキャプチャ
    for await (const event of result.events) {
      if (event.type === 'thread.started') {
        threadId = event.thread_id;
      }
      // ...
    }

    // Thread ID を sessionId として返す
    yield {
      type: 'agent:completed',
      sessionId: threadId,  // Thread ID をセッション ID として返す
      // ...
    };
  }
}
```

### TaskQueue での保存

`backend/src/queue/task-queue.ts` でタスク完了時に Thread ID を保存：

```typescript
if (result.sessionId) {
  await this.taskRepository.update(task.id, {
    sdkSessionId: result.sessionId,  // Thread ID を保存
  });
}
```

## 注意事項

### Thread ID の永続性

- Thread ID は Codex SDK 側で管理されます
- タスク完了後も Thread ID は有効です
- ただし、Codex SDK の仕様により、一定期間後に無効になる可能性があります

### エラーハンドリング

Thread ID が無効な場合：

```typescript
// Codex SDK が ThreadNotFoundError を返す可能性
try {
  const thread = codex.resumeThread({ threadId: invalidThreadId });
} catch (error) {
  // エラーハンドリング: 新しいスレッドを作成するなど
}
```

### 作業ディレクトリの一貫性

セッション継続時は、前回と同じ作業ディレクトリを使用することを推奨します：

- 異なる作業ディレクトリを指定すると、ファイル参照が一致しない可能性があります
- UI では前回の作業ディレクトリが自動的に設定されます

## トラブルシューティング

### Thread ID が表示されない

**症状**: タスク完了後に Thread ID が表示されない

**原因と対処**:
1. Codex Executor を使用しているか確認
   - Claude Executor では Session ID が表示されます
2. タスクが正常に完了しているか確認
   - エラーで終了した場合、Thread ID が保存されない可能性があります
3. バックエンドログを確認
   - "Thread ID captured" ログが出力されているか確認

### セッション継続が機能しない

**症状**: 継続ボタンを押しても文脈が引き継がれない

**原因と対処**:
1. Thread ID が正しく渡されているか確認
   - ブラウザの DevTools でリクエストペイロードを確認
   - `options.codex.resumeSession` に Thread ID が含まれているか確認
2. 作業ディレクトリが一致しているか確認
3. Codex SDK のログを確認
   - `resumeThread` が呼ばれているか確認

### Executor を変更できない

**症状**: セッション継続時に Executor を変更したい

**対処**:
- これは仕様です。Claude と Codex のセッション形式が異なるため、変更できません
- 別の Executor で新しいタスクを作成してください

## 関連ファイル

### バックエンド
- `backend/src/agents/codex-agent-executor.ts` - Codex Executor 実装
- `backend/src/queue/task-queue.ts` - Thread ID 保存ロジック
- `backend/tests/integration/codex-session-continuation.test.ts` - 統合テスト

### フロントエンド
- `frontend/src/routes/tasks/[id]/+page.svelte` - タスク詳細ページ（Thread ID 表示）
- `frontend/src/routes/tasks/new/+page.svelte` - タスク作成フォーム（継続 UI）
- `frontend/src/lib/types/api.ts` - 型定義

### ドキュメント
- `docs/features/codex-session-continuation.md` - 本ドキュメント
- `backend/openapi.yaml` - API 仕様

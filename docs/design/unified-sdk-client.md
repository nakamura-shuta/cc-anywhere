# Claude SDK統合設計書

## 概要

現在、タスク実行とチャット機能でClaude Code SDKを別々に利用していますが、これらを統合することでコードの重複を削減し、保守性を向上させます。

## 現状分析

### タスク実行 (`backend/src/agents/claude-agent-executor.ts`)

**使用方法**:
- `ClaudeCodeClient`（共有インスタンス）経由でSDKを利用
- `getSharedClaudeClient()`でシングルトンインスタンスを取得

**特徴**:
- バッチ処理型の実行モデル
- Todo管理、進捗追跡（`TaskTracker`）
- 詳細なメッセージ管理（`MessageTracker`）
- セッション継続（`resumeSession`）
- 複雑なオプション管理
  - maxTurns, allowedTools, disallowedTools
  - systemPrompt, permissionMode
  - mcpConfig, hooks, webSearch
- イベント駆動（`AsyncIterator<AgentExecutionEvent>`）

**フロー**:
```
Request → ClaudeAgentExecutor → ClaudeCodeClient → SDK query()
                ↓
        Progress Events (バッチ)
                ↓
        Result (messages[], todos, sessionId)
```

### チャット (`backend/src/chat/chat-executor.ts`)

**使用方法**:
- `@anthropic-ai/claude-agent-sdk`の`query()`を直接呼び出し
- API Keyは`withApiKey()`ヘルパーで一時的に設定

**特徴**:
- リアルタイムストリーミング
- WebSocketによる即座のフィードバック
- 軽量な実装
- セッション継続（`resume`オプション）
- シンプルなオプション
  - systemPrompt, cwd, sdkSessionId
- イベントコールバック（`onEvent(ChatStreamEvent)`）

**フロー**:
```
Message → ClaudeChatExecutor → SDK query() directly
              ↓
        Stream Events (リアルタイム)
              ↓
        WebSocket → Frontend
              ↓
        Result (content, sdkSessionId)
```

### 共通点

| 項目 | 詳細 |
|------|------|
| SDK | `@anthropic-ai/claude-agent-sdk` |
| セッション継続 | `sdkSessionId` / `resume` |
| システムプロンプト | カスタマイズ可能 |
| キャンセル | `AbortController` |
| アーキテクチャ | イベント駆動 |
| エラーハンドリング | try-catch + エラーイベント |

### 相違点

| 観点 | タスク実行 | チャット |
|------|-----------|---------|
| SDK使用 | `ClaudeCodeClient` ラッパー | `query()` 直接呼び出し |
| 目的 | タスク完了 | リアルタイム会話 |
| ストリーミング | イベントベース（バッチ） | WebSocketリアルタイム |
| 複雑さ | 高（多機能） | 低（シンプル） |
| メッセージ管理 | `TaskTracker`, `MessageTracker` | 最小限 |
| 進捗追跡 | 詳細なフェーズ管理 | text/tool_use イベントのみ |
| 戻り値 | `messages[]`, `todos`, `sessionId` | `content`, `sdkSessionId` |
| API Key管理 | グローバル設定 | 一時的設定（`withApiKey`） |

## 統合の目的

### メリット

1. **コード重複の削減**
   - SDK呼び出しロジックの共通化
   - セッション管理の統一
   - エラーハンドリングの一元化

2. **一貫性の向上**
   - 統一されたオプション構造
   - 同じセッション継続メカニズム
   - 統一されたログ形式

3. **保守性の向上**
   - 1つのSDKラッパーのみ管理
   - バグ修正が両方に適用
   - テストの共通化

4. **拡張性**
   - 新しい機能を両方で利用可能
   - 統一されたインターフェース

### 課題

1. **異なるユースケース**
   - タスク: バッチ処理、完了待ち、詳細な追跡
   - チャット: リアルタイムストリーミング、即座のフィードバック

2. **パフォーマンス要件**
   - チャット: 低レイテンシが重要
   - タスク: 完全性・詳細性が重要

3. **複雑性のバランス**
   - タスクに必要な機能をチャットに押し付けない
   - チャットのシンプルさを保つ

## 設計方針

### 採用アプローチ: 段階的統合

**基本方針**: 共通基盤を作成し、各ユースケースに最適化されたラッパーを提供

```
          ┌─────────────────────┐
          │   ClaudeSDKBase     │
          │  (共通基盤層)        │
          └──────────┬──────────┘
                     │
        ┌────────────┴────────────┐
        │                         │
┌───────▼────────┐      ┌────────▼────────┐
│  TaskExecutor  │      │  ChatExecutor   │
│  (フル機能)     │      │  (軽量)         │
└────────────────┘      └─────────────────┘
```

### アーキテクチャ

#### 1. ClaudeSDKBase（共通基盤層）

**責務**:
- SDK `query()` の呼び出し管理
- セッション管理（sessionId, resume）
- API Key管理
- 基本的なエラーハンドリング
- AbortController管理

**インターフェース**:
```typescript
interface SDKExecutionOptions {
  // 共通オプション
  prompt: string;
  sessionId?: string;
  resume?: string;
  systemPrompt?: string;
  cwd?: string;
  maxTurns?: number;
  abortController?: AbortController;

  // 詳細オプション（オプショナル）
  allowedTools?: string[];
  disallowedTools?: string[];
  permissionMode?: PermissionMode;
  mcpConfig?: Record<string, any>;
  hookConfig?: HookConfig;
  webSearchConfig?: WebSearchConfig;
}

interface SDKExecutionResult {
  sessionId?: string;
  success: boolean;
  error?: Error;
}

abstract class ClaudeSDKBase {
  protected abstract executeQuery(
    options: SDKExecutionOptions,
    onEvent: (event: SDKEvent) => void | Promise<void>
  ): Promise<SDKExecutionResult>;

  protected handleSessionResume(resume?: string): QueryOptions;
  protected handleApiKey(fn: () => any): any;
  protected createQueryOptions(options: SDKExecutionOptions): QueryOptions;
}
```

#### 2. TaskSDKClient（タスク用ラッパー）

**責務**:
- Todo管理
- 詳細な進捗追跡（`TaskTracker`）
- メッセージ管理（`MessageTracker`）
- バッチイベント処理
- 複雑なオプション管理

**インターフェース**:
```typescript
interface TaskExecutionOptions extends SDKExecutionOptions {
  taskId?: string;
  onProgress?: (progress: ProgressEvent) => void | Promise<void>;
  continueFromTaskId?: string;
}

interface TaskExecutionResult extends SDKExecutionResult {
  messages: SDKMessage[];
  todos?: Todo[];
  tracker?: TaskTracker;
}

class TaskSDKClient extends ClaudeSDKBase {
  async executeTask(
    instruction: string,
    options: TaskExecutionOptions
  ): Promise<TaskExecutionResult>;

  async *executeTaskStream(
    instruction: string,
    options: TaskExecutionOptions
  ): AsyncIterator<AgentExecutionEvent>;
}
```

#### 3. ChatSDKClient（チャット用ラッパー）

**責務**:
- リアルタイムストリーミング
- 軽量なイベント処理
- WebSocket連携
- シンプルなインターフェース

**インターフェース**:
```typescript
interface ChatExecutionOptions extends SDKExecutionOptions {
  sessionId: string;
  sdkSessionId?: string; // resume用
}

interface ChatStreamEvent {
  type: 'start' | 'text' | 'tool_use' | 'done' | 'error';
  data: any;
  timestamp: string;
}

interface ChatExecutionResult extends SDKExecutionResult {
  messageId: string;
  content: string;
  sdkSessionId?: string;
}

class ChatSDKClient extends ClaudeSDKBase {
  async execute(
    message: string,
    options: ChatExecutionOptions,
    onEvent: (event: ChatStreamEvent) => void
  ): Promise<ChatExecutionResult>;
}
```

## 実装計画

### Phase 1: 共通基盤の作成 ✅

**目標**: `ClaudeSDKBase` クラスの実装

**タスク**:
- [ ] `backend/src/claude/sdk/base.ts` 作成
- [ ] 共通オプション型定義
- [ ] SDK呼び出しの共通ロジック
- [ ] セッション管理の共通化
- [ ] API Key管理の共通化
- [ ] エラーハンドリングの共通化
- [ ] ユニットテスト作成

**成果物**:
```
backend/src/claude/sdk/
├── base.ts              # ClaudeSDKBase
├── types.ts             # 共通型定義
└── __tests__/
    └── base.test.ts
```

**検証**:
- [ ] 既存の`ClaudeCodeClient`と同等の機能
- [ ] セッション継続が正常動作
- [ ] エラーハンドリングが適切

### Phase 2: チャット実装の移行 🔄

**目標**: `ChatSDKClient` への移行

**タスク**:
- [ ] `backend/src/claude/sdk/chat-client.ts` 作成
- [ ] `ClaudeChatExecutor`を`ChatSDKClient`使用に変更
- [ ] ストリーミング機能の維持
- [ ] WebSocket連携の確認
- [ ] 統合テスト

**成果物**:
```
backend/src/claude/sdk/
├── chat-client.ts       # ChatSDKClient
└── __tests__/
    └── chat-client.test.ts

backend/src/chat/
└── chat-executor.ts     # 更新版
```

**検証**:
- [ ] チャット機能が正常動作
- [ ] ストリーミングのレイテンシが許容範囲
- [ ] セッション継続が正常動作
- [ ] WebSocketイベントが正常配信
- [ ] 既存の統合テストがパス

### Phase 3: タスク実装の移行 🔄

**目標**: `TaskSDKClient` への移行

**タスク**:
- [ ] `backend/src/claude/sdk/task-client.ts` 作成
- [ ] 既存の`ClaudeCodeClient`機能を移植
- [ ] `ClaudeAgentExecutor`を`TaskSDKClient`使用に変更
- [ ] Todo管理、進捗追跡の移行
- [ ] 統合テスト

**成果物**:
```
backend/src/claude/sdk/
├── task-client.ts       # TaskSDKClient
└── __tests__/
    └── task-client.test.ts

backend/src/agents/
└── claude-agent-executor.ts  # 更新版
```

**検証**:
- [ ] タスク実行が正常動作
- [ ] Todo管理が正常動作
- [ ] 進捗追跡が正常動作
- [ ] セッション継続が正常動作
- [ ] 既存の統合テストがパス

### Phase 4: クリーンアップ 🧹

**目標**: 古いコードの削除とドキュメント更新

**タスク**:
- [ ] 重複コードの削除
- [ ] `ClaudeCodeClient`の段階的廃止
- [ ] インポートパスの更新
- [ ] ドキュメント更新
- [ ] 移行ガイド作成

**成果物**:
```
docs/
├── migration-guide.md        # 移行ガイド
└── architecture/
    └── unified-sdk-client.md # アーキテクチャドキュメント
```

**検証**:
- [ ] すべてのテストがパス
- [ ] ビルドが成功
- [ ] パフォーマンスが劣化していない
- [ ] ドキュメントが最新

## 技術的詳細

### セッション管理の統一

**現状**:
- タスク: `resumeSession` オプション
- チャット: `resume` オプション（SDK直接）

**統合後**:
```typescript
interface SessionOptions {
  sessionId?: string;      // アプリケーションレベルのセッションID
  sdkSessionId?: string;   // SDK内部のセッションID (resume用)
}

// 使用例
const options = {
  sessionId: "chat-session-123",
  sdkSessionId: "sdk-abc-def-123"  // 前回の結果から取得
};
```

### API Key管理の統一

**現状**:
- タスク: グローバル設定（`config.claude.apiKey`）
- チャット: `withApiKey()` ヘルパーで一時設定

**統合後**:
```typescript
class ClaudeSDKBase {
  protected withApiKey<T>(fn: () => T): T {
    const originalApiKey = process.env.CLAUDE_API_KEY;
    process.env.CLAUDE_API_KEY = config.claude.apiKey;

    try {
      return fn();
    } finally {
      if (originalApiKey !== undefined) {
        process.env.CLAUDE_API_KEY = originalApiKey;
      } else {
        delete process.env.CLAUDE_API_KEY;
      }
    }
  }
}
```

### イベント処理の統一

**タスク用イベント**:
```typescript
type TaskEvent =
  | { type: 'agent:start'; timestamp: Date }
  | { type: 'agent:progress'; message: string; timestamp: Date }
  | { type: 'agent:completed'; output: SDKMessage[]; todos?: Todo[]; timestamp: Date }
  | { type: 'agent:failed'; error: Error; timestamp: Date };
```

**チャット用イベント**:
```typescript
type ChatEvent =
  | { type: 'start'; data: { sessionId: string; messageId: string }; timestamp: string }
  | { type: 'text'; data: { text: string }; timestamp: string }
  | { type: 'tool_use'; data: { tool: string; toolInput: any }; timestamp: string }
  | { type: 'done'; data: { sessionId: string; messageId: string; sdkSessionId?: string }; timestamp: string }
  | { type: 'error'; data: { error: string }; timestamp: string };
```

**共通基盤のイベント**:
```typescript
type SDKEvent =
  | { type: 'system'; sessionId?: string }
  | { type: 'stream_event'; event: any }
  | { type: 'assistant'; message: SDKMessage }
  | { type: 'result'; sessionId?: string };
```

### エラーハンドリングの統一

```typescript
class ClaudeSDKBase {
  protected handleError(error: unknown, context: string): Error {
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error(`${context} failed`, {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined
    });

    return error instanceof Error ? error : new Error(errorMessage);
  }
}
```

## パフォーマンス考慮事項

### チャットのレイテンシ

**目標**: ストリーミング開始までの時間を最小化

**対策**:
- 共通基盤は最小限のオーバーヘッド
- イベント処理は非同期で効率的に
- 不要な機能はオプショナル化

**測定**:
```typescript
// ベンチマーク
const startTime = Date.now();
await chatClient.execute(message, options, onEvent);
const latency = Date.now() - startTime;
logger.debug('Chat execution latency', { latency });
```

### タスク実行のスループット

**目標**: Todo管理や進捗追跡のオーバーヘッドを最小化

**対策**:
- TaskTrackerは必要な場合のみ初期化
- メッセージ管理は効率的なデータ構造
- 不要なイベント処理をスキップ

## テスト戦略

### ユニットテスト

**ClaudeSDKBase**:
- [ ] セッション管理のテスト
- [ ] API Key管理のテスト
- [ ] エラーハンドリングのテスト
- [ ] AbortControllerのテスト

**TaskSDKClient**:
- [ ] Todo管理のテスト
- [ ] 進捗追跡のテスト
- [ ] イベント処理のテスト

**ChatSDKClient**:
- [ ] ストリーミングのテスト
- [ ] イベント配信のテスト
- [ ] セッション継続のテスト

### 統合テスト

- [ ] タスク実行の統合テスト
- [ ] チャット実行の統合テスト
- [ ] セッション継続の統合テスト
- [ ] WebSocket統合テスト

### パフォーマンステスト

- [ ] チャットレイテンシの測定
- [ ] タスクスループットの測定
- [ ] メモリ使用量の測定

## リスク管理

### リスク1: チャットのレイテンシ増加

**影響**: ユーザー体験の低下

**対策**:
- 共通基盤は最小限のオーバーヘッド
- パフォーマンステストで検証
- 必要に応じて最適化

**軽減策**: Phase 2で早期に検証

### リスク2: 既存機能の破壊

**影響**: タスク実行やチャットが動作しなくなる

**対策**:
- 段階的な移行
- 各フェーズでテスト実行
- ロールバック可能な実装

**軽減策**: 既存のテストを維持

### リスク3: 複雑性の増加

**影響**: 保守性が低下

**対策**:
- 明確なインターフェース設計
- 詳細なドキュメント
- コードレビュー

**軽減策**: 設計レビューを実施

## 成功基準

### 機能面

- [ ] タスク実行が既存と同等に動作
- [ ] チャットが既存と同等に動作
- [ ] セッション継続が正常動作
- [ ] すべてのテストがパス

### 非機能面

- [ ] コード行数が20%以上削減
- [ ] チャットのレイテンシが10%以内の増加
- [ ] タスク実行のスループットが維持
- [ ] ドキュメントが充実

### 保守性

- [ ] 重複コードが解消
- [ ] 一貫性のあるAPI
- [ ] 明確なアーキテクチャ
- [ ] 拡張性の向上

## タイムライン

| フェーズ | 期間 | マイルストーン |
|---------|------|--------------|
| Phase 1 | 1-2日 | 共通基盤完成 |
| Phase 2 | 2-3日 | チャット移行完了 |
| Phase 3 | 2-3日 | タスク移行完了 |
| Phase 4 | 1日 | クリーンアップ完了 |

**合計**: 約6-9日

## 参考資料

- [Claude Code SDK Documentation](https://docs.anthropic.com/ja/docs/claude-code/sdk)
- [Agent SDK Reference](https://docs.claude.com/en/api/agent-sdk/typescript)
- 既存実装:
  - `backend/src/claude/claude-code-client.ts`
  - `backend/src/chat/chat-executor.ts`
  - `backend/src/agents/claude-agent-executor.ts`

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
        Result (content, sdkSessionId, mode: 'resume' | 'new_session')
```

**セッション継続の挙動**:
- `sdkSessionId` がある場合: resume を試行
- resume 失敗時: エラーを返す（履歴フォールバックは削除済み）
- `sdkSessionId` がない場合: 新規セッション開始

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
| 通信方式 | HTTP + SSE/WebSocket混在 | WebSocket専用 |
| 複雑さ | 高（多機能） | 低（シンプル） |
| メッセージ管理 | `TaskTracker`, `MessageTracker` | 最小限 |
| 進捗追跡 | 詳細なフェーズ管理 | text/tool_use イベントのみ |
| 戻り値 | `messages[]`, `todos`, `sessionId` | `content`, `sdkSessionId`, `mode` |
| API Key管理 | グローバル設定 | 一時的設定（`withApiKey`） |
| Resume失敗時 | エラー → 再試行可能 | エラー（履歴フォールバック削除済み） |

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
- SDKイベントのキャプチャと変換（sessionId/session_id 両対応）

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

  // SDKイベントからsessionIdを抽出（sessionId/session_id両対応）
  protected extractSessionId(event: any): string | undefined {
    return event.sessionId ?? event.session_id;
  }
}
```

#### 2. TaskSDKClient（タスク用ラッパー）

**責務**:
- Todo管理（`TaskTracker` を使用）
- 詳細な進捗追跡（`TaskTracker`）
- メッセージ管理（`MessageTracker`）
- バッチイベント処理
- 複雑なオプション管理（hooks, webSearch, mcp等）

**既存機能の扱い**:
- `TaskTracker`: そのまま利用（Todo管理、進捗記録）
- `MessageTracker`: そのまま利用（メッセージ追跡）
- `ProgressEventConverter`: そのまま利用（SDK → AgentEvent変換）
- Hook機能: `buildHooks()` 経由で設定
- WebSearch設定: オプションで有効化
- MCP設定: オプションで設定

**共通基盤に移行するもの**:
- SDK `query()` 呼び出し
- sessionId 抽出ロジック
- API Key管理
- AbortController管理
- 基本的なエラーハンドリング

**TaskSDKClient固有として残すもの**:
- TaskTracker/MessageTracker の初期化と管理
- Progress イベントの変換
- Todo の抽出
- Hook/WebSearch/MCP の設定

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

**セッション継続の挙動**:
- resume成功時: `mode: 'resume'` を返す
- resume失敗時: **エラーをスロー**（履歴フォールバックなし）
- 新規セッション時: `mode: 'new_session'` を返す

**共通基盤に移行するもの**:
- SDK `query()` 呼び出し
- sessionId 抽出ロジック（sessionId/session_id 両対応）
- API Key管理（`withApiKey()` ヘルパー）
- AbortController管理
- 基本的なエラーハンドリング

**ChatSDKClient固有として残すもの**:
- WebSocket向けイベント変換（ChatStreamEvent）
- テキストストリーミングの最適化
- messageId生成

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

### Phase 1: 共通基盤の作成 🚧

**目標**: `ClaudeSDKBase` クラスの実装

**優先度とリスク評価**:
- **優先度**: 高（全体の基盤となる）
- **リスク**: 中
  - 既存実装への影響: なし（新規作成）
  - チャットは現在 resume/new_session で安定動作中
  - Phase 2/3で既存コードを置き換える際にリスクが顕在化
- **推奨アプローチ**: 慎重に設計し、十分なテストを実施

**タスク**:
- [ ] `backend/src/claude/sdk/base.ts` 作成
- [ ] 共通オプション型定義（`types.ts`）
- [ ] SDK呼び出しの共通ロジック
  - [ ] `query()` ラッパー
  - [ ] イベントストリーミング
- [ ] セッション管理の共通化
  - [ ] sessionId/session_id 両対応
  - [ ] resume オプションの処理
- [ ] API Key管理の統一（**withApiKey方式を採用**）
  - [ ] 一時的な環境変数設定
  - [ ] 実行後の復元処理
- [ ] エラーハンドリングの共通化
  - [ ] エラーラッピング
  - [ ] ログ出力
- [ ] イベント正規化の実装（詳細は後述）
- [ ] ユニットテスト作成
  - [ ] sessionId抽出テスト
  - [ ] API Key管理テスト
  - [ ] エラーハンドリングテスト
  - [ ] イベント正規化テスト

**成果物**:
```
backend/src/claude/sdk/
├── base.ts              # ClaudeSDKBase
├── types.ts             # 共通型定義
├── event-normalizer.ts  # イベント正規化
└── __tests__/
    ├── base.test.ts
    └── event-normalizer.test.ts
```

**検証**:
- [ ] sessionId抽出が両形式で動作
- [ ] API Key管理が正常動作（設定・復元）
- [ ] エラーが適切にラッピングされる
- [ ] イベント正規化が正しく動作
- [ ] ユニットテストカバレッジ >90%

**完了基準**:
- [ ] すべてのユニットテストがパス
- [ ] コードレビュー完了
- [ ] ドキュメント作成完了

### Phase 2: チャット実装の移行 🔄

**目標**: `ChatSDKClient` への移行

**タスク**:
- [ ] `backend/src/claude/sdk/chat-client.ts` 作成
- [ ] `ClaudeChatExecutor`を`ChatSDKClient`使用に変更
- [ ] ストリーミング機能の維持
- [ ] WebSocket連携の確認
- [ ] **resume失敗時はエラーをスロー**（履歴フォールバックなし）
- [ ] 統合テスト
- [ ] パフォーマンステスト（レイテンシ測定）

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

**機能検証**:
- [ ] チャット機能が正常動作（基本フロー）
- [ ] resume成功時は正常動作
  - [ ] 目標: resume成功率 >99%
  - [ ] 測定: 100回実行の成功率
  - [ ] 失敗時: Sentry通知 + ログ記録
- [ ] **resume失敗時はエラーが返る**（新規セッションに切り替えない）
  - [ ] エラーメッセージが明確
  - [ ] フロントエンドで適切にハンドリング可能
- [ ] WebSocketイベントが正常配信
  - [ ] 順序保証（text イベントが順番通り）
  - [ ] 欠落なし（完全性）
  - [ ] 重複なし

**パフォーマンス検証**:
- [ ] ストリーミングのレイテンシが許容範囲内
  - [ ] 目標: WebSocket接続～初回textイベント <800ms
  - [ ] 測定方法:
    ```typescript
    const start = Date.now();
    const ws = createChatWebSocket(sessionId, token, {
      onText: (text) => {
        const latency = Date.now() - start;
        metrics.record('chat.first_text.latency', latency);
      }
    });
    ```
  - [ ] 測定条件: 10回実行の平均値と95パーセンタイル
  - [ ] 基準値: 既存実装との比較（平均±10%以内、P95±15%以内）
  - [ ] 警告閾値: 平均 >1000ms または P95 >1500ms
- [ ] スループットの低下なし
  - [ ] 目標: 既存比95%以上
  - [ ] 測定: 同時接続数10でのメッセージ処理時間

**回帰テスト**:
- [ ] 既存の統合テストがパス
- [ ] E2Eテスト（フロントエンド～バックエンド）がパス

**段階的移行戦略**:

**1. Feature Flag の導入**:
```typescript
// config/index.ts
export const config = {
  experimental: {
    useNewChatClient: process.env.USE_NEW_CHAT_CLIENT === 'true'
  }
};

// chat/chat-executor.ts
export function createChatExecutor(executorType: string): IChatExecutor {
  if (config.experimental.useNewChatClient) {
    return new ChatSDKClientExecutor(); // 新実装
  }
  return new ClaudeChatExecutor(); // 既存実装
}
```

**2. 並行稼働期間**:
- Day 1-2: 開発環境でテスト（`USE_NEW_CHAT_CLIENT=true`）
- Day 3-4: ステージング環境で検証
- Day 5: 本番環境で段階的ロールアウト
  - 10% のトラフィックで新実装を試行
  - メトリクス監視（レイテンシ、エラー率）
  - 問題なければ 50% → 100% に拡大

**3. ロールバック手順**:
```bash
# 即座にロールバック（環境変数変更）
export USE_NEW_CHAT_CLIENT=false
pm2 restart cc-anywhere

# または設定ファイル経由
echo 'USE_NEW_CHAT_CLIENT=false' >> .env
pm2 restart cc-anywhere
```

**4. 監視項目**:
- [ ] エラー率: 既存比+5%以内
- [ ] レイテンシ: P50/P95/P99
- [ ] resume成功率: >99%
- [ ] WebSocketエラー: 再接続成功率 >95%

**5. 完了基準**:
- [ ] 本番環境で100%トラフィックが新実装
- [ ] 1週間安定稼働
- [ ] すべての監視項目が基準内
- [ ] ユーザーからの問題報告なし

### Phase 3: タスク実装の移行 🔄

**目標**: `TaskSDKClient` への移行

**タスク**:
- [ ] `backend/src/claude/sdk/task-client.ts` 作成
- [ ] 既存の`ClaudeCodeClient`機能を移植
  - TaskTracker/MessageTracker の統合
  - Hook設定の移行
  - WebSearch/MCP設定の移行
- [ ] `ClaudeAgentExecutor`を`TaskSDKClient`使用に変更
- [ ] Todo管理、進捗追跡の移行
- [ ] 統合テスト
- [ ] パフォーマンステスト（スループット測定）

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
- [ ] Todo管理が正常動作（抽出精度維持）
- [ ] 進捗追跡が正常動作（フェーズ管理）
- [ ] セッション継続が正常動作（resume/新規）
- [ ] Hook実行が正常動作
- [ ] WebSearch/MCP機能が正常動作
- [ ] スループットが維持（目標: 既存比95%以上）
  - 測定: 標準タスク実行時間
  - ツール: ベンチマークスクリプト
- [ ] メモリ使用量が許容範囲（目標: 既存比+10%以内）
- [ ] 既存の統合テストがパス

**移行戦略**:
- 段階的フラグ導入: `USE_NEW_TASK_CLIENT` 環境変数
- 移行期間: 両実装を並行稼働（2-3日）
- ロールバック手順: フラグをfalseに戻す
- 負荷テスト: 本番相当の負荷で検証

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

**SDK sessionId 抽出の実装詳細**:

SDKは以下の異なるイベントでsessionIdを返す可能性があります：
- `event.sessionId` (駝峰式: camelCase)
- `event.session_id` (蛇腹式: snake_case)

共通基盤で両方に対応:
```typescript
protected extractSessionId(event: any): string | undefined {
  // sessionId と session_id 両方をチェック
  return event.sessionId ?? event.session_id;
}
```

**適用箇所**:
- `system` イベント（セッション開始時）
- `result` イベント（タスク完了時）

**既存の修正履歴**:
- `backend/src/chat/chat-executor.ts`: 87-89行目、129-130行目で両対応済み
- この実装を共通基盤に移行することで、一元管理を実現

### API Key管理の統一

**現状**:
- タスク: グローバル設定（`config.claude.apiKey`）
- チャット: `withApiKey()` ヘルパーで一時設定

**採用方針**: **withApiKey方式を正とする**

**理由**:
1. スレッドセーフ: 並行実行時に他の実行に影響しない
2. テスト容易性: テストごとに異なるAPI Keyを使用可能
3. 柔軟性: 将来的に複数のAPI Keyを使い分け可能

**統合後の実装**:
```typescript
abstract class ClaudeSDKBase {
  protected withApiKey<T>(fn: () => T): T {
    const originalApiKey = process.env.CLAUDE_API_KEY;
    process.env.CLAUDE_API_KEY = config.claude.apiKey;

    try {
      return fn();
    } finally {
      // 元の値を復元（undefinedの場合は削除）
      if (originalApiKey !== undefined) {
        process.env.CLAUDE_API_KEY = originalApiKey;
      } else {
        delete process.env.CLAUDE_API_KEY;
      }
    }
  }

  protected async executeQuery(
    options: SDKExecutionOptions,
    onEvent: (event: NormalizedSDKEvent) => void | Promise<void>
  ): Promise<SDKExecutionResult> {
    // API Keyを一時的に設定して実行
    return this.withApiKey(() => {
      return this.executeQueryInternal(options, onEvent);
    });
  }
}
```

**移行影響**:
- タスク実行: グローバル設定 → withApiKey に変更（動作は同じ）
- チャット: 既にwithApiKeyを使用（変更なし）

### イベント変換フロー

**アーキテクチャ図**:
```
                    SDK Event
                        ↓
            ┌───────────┴───────────┐
            │   ClaudeSDKBase       │
            │  - sessionId抽出      │
            │  - イベントキャプチャ  │
            └───────────┬───────────┘
                        │
        ┌───────────────┴───────────────┐
        │                               │
┌───────▼────────┐            ┌────────▼────────┐
│  TaskSDKClient │            │  ChatSDKClient  │
│  - SDK → Task  │            │  - SDK → Chat   │
│  - Progress変換│            │  - Stream最適化 │
└───────┬────────┘            └────────┬────────┘
        │                               │
┌───────▼────────┐            ┌────────▼────────┐
│ AgentEvent     │            │ ChatStreamEvent │
│ (AsyncIterator)│            │ (Callback)      │
└───────┬────────┘            └────────┬────────┘
        │                               │
┌───────▼────────┐            ┌────────▼────────┐
│ HTTP/SSE/WS    │            │  WebSocket      │
└────────────────┘            └─────────────────┘
```

**イベント正規化の詳細**:

#### 共通基盤でのSDKイベント正規化

**目的**: SDKの生イベントを標準化されたフォーマットに変換

**正規化インターフェース**:
```typescript
// 共通基盤が提供する正規化済みイベント
interface NormalizedSDKEvent {
  type: 'session' | 'text_delta' | 'tool_use' | 'result' | 'error';
  timestamp: string; // ISO 8601形式
  data: {
    sessionId?: string;
    text?: string;
    toolName?: string;
    toolInput?: any;
    error?: string;
  };
}
```

**正規化ルール**:

| SDK生イベント | 検出条件 | 正規化後 | payload |
|--------------|---------|---------|---------|
| `system` | `event.type === 'system'` | `session` | `{ sessionId: event.sessionId ?? event.session_id }` |
| `stream_event` | `event.type === 'stream_event'`<br>`event.event?.type === 'content_block_delta'`<br>`event.event?.delta?.type === 'text_delta'` | `text_delta` | `{ text: event.event.delta.text }` |
| `assistant` (text) | `event.type === 'assistant'`<br>`content.type === 'text'` | `text_delta` | `{ text: content.text }` |
| `assistant` (tool_use) | `event.type === 'assistant'`<br>`content.type === 'tool_use'` | `tool_use` | `{ toolName: content.name, toolInput: content.input }` |
| `result` | `event.type === 'result'` | `result` | `{ sessionId: event.sessionId ?? event.session_id }` |
| `error` / Exception | `event.type === 'error'` or catch | `error` | `{ error: errorMessage }` |

**実装例**:
```typescript
class EventNormalizer {
  normalize(sdkEvent: any): NormalizedSDKEvent | null {
    const timestamp = new Date().toISOString();

    // system イベント
    if (sdkEvent.type === 'system') {
      return {
        type: 'session',
        timestamp,
        data: {
          sessionId: sdkEvent.sessionId ?? sdkEvent.session_id
        }
      };
    }

    // stream_event (text_delta)
    if (sdkEvent.type === 'stream_event' &&
        sdkEvent.event?.type === 'content_block_delta' &&
        sdkEvent.event?.delta?.type === 'text_delta') {
      return {
        type: 'text_delta',
        timestamp,
        data: { text: sdkEvent.event.delta.text }
      };
    }

    // assistant (text)
    if (sdkEvent.type === 'assistant' && sdkEvent.message?.content) {
      for (const content of sdkEvent.message.content) {
        if (content.type === 'text' && content.text) {
          return {
            type: 'text_delta',
            timestamp,
            data: { text: content.text }
          };
        }
        if (content.type === 'tool_use') {
          return {
            type: 'tool_use',
            timestamp,
            data: {
              toolName: content.name,
              toolInput: content.input
            }
          };
        }
      }
    }

    // result
    if (sdkEvent.type === 'result') {
      return {
        type: 'result',
        timestamp,
        data: {
          sessionId: sdkEvent.sessionId ?? sdkEvent.session_id
        }
      };
    }

    return null; // 処理不要なイベント
  }
}
```

#### クライアント固有の変換

**TaskSDKClient**:
```typescript
// NormalizedSDKEvent → AgentExecutionEvent
text_delta → agent:progress { message: text }
tool_use   → agent:progress { message: `Using tool: ${toolName}` }
result     → agent:completed { output, sessionId, todos }
error      → agent:failed { error }
```

**ChatSDKClient**:
```typescript
// NormalizedSDKEvent → ChatStreamEvent
text_delta → { type: 'text', data: { text }, timestamp }
tool_use   → { type: 'tool_use', data: { tool: toolName, toolInput }, timestamp }
result     → { type: 'done', data: { sessionId, messageId }, timestamp }
error      → { type: 'error', data: { error }, timestamp }
```

**シーケンス図**:
```
SDK → ClaudeSDKBase.executeQuery()
         ↓
      EventNormalizer.normalize()
         ↓
      NormalizedSDKEvent
         ↓
   ┌─────┴─────┐
   ↓           ↓
TaskSDK     ChatSDK
   ↓           ↓
AgentEvent  ChatEvent
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

**チャットレイテンシ測定**:
- [ ] 目標: WebSocket接続～初回textイベント <800ms
- [ ] 測定方法:
  ```typescript
  const start = Date.now();
  await chatClient.execute(message, options, (event) => {
    if (event.type === 'text') {
      const latency = Date.now() - start;
      logger.info('Chat latency', { latency });
    }
  });
  ```
- [ ] 測定条件: 10回実行の平均値
- [ ] 基準値: 既存実装との比較（±10%以内）

**タスクスループット測定**:
- [ ] 目標: 既存比95%以上のスループット
- [ ] 測定方法:
  ```typescript
  const start = Date.now();
  await taskClient.executeTask(instruction, options);
  const duration = Date.now() - start;
  logger.info('Task execution duration', { duration });
  ```
- [ ] 測定タスク: 標準的な実装タスク（ファイル読み込み+編集）
- [ ] 測定条件: 5回実行の平均値

**メモリ使用量測定**:
- [ ] 目標: 既存比+10%以内
- [ ] 測定方法: `process.memoryUsage()`
- [ ] 測定タイミング: タスク実行前後の差分
- [ ] 測定条件: 3回実行の平均値

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

| フェーズ | 期間 | マイルストーン | 備考 |
|---------|------|--------------|------|
| Phase 1 | 2-3日 | 共通基盤完成 | 設計レビュー含む |
| Phase 2 | 3-5日 | チャット移行完了 | フラグ併用期間含む |
| Phase 3 | 4-6日 | タスク移行完了 | フラグ併用期間含む |
| Phase 4 | 1-2日 | クリーンアップ完了 | ドキュメント更新含む |

**合計**: 約10-16日

**リスク考慮事項**:
- 既存大規模コードの置き換えのため、見積もりに余裕を持たせています
- 各フェーズで段階的フラグ併用期間を設けて、安全に移行します
- 問題発生時のロールバック手順を事前に確立します
- パフォーマンステストで基準値を満たさない場合、最適化期間を追加します

**追加考慮事項**:
- **SDKイベント正規化**: 新規実装のため、想定外のイベント形式に注意
  - 対策: 包括的なユニットテスト + モニタリング
- **E2Eテスト**: フロントエンド～バックエンドの統合テストが必要
  - 追加工数: Phase 2/3 各 +1日
- **回帰テスト**: 既存機能への影響を確認
  - 追加工数: Phase 2/3 各 +0.5日
- **ドキュメント更新**: アーキテクチャドキュメント、API仕様書
  - 追加工数: Phase 4 +0.5日

**並行作業の可能性**:
- Phase 1完了後、Phase 2とPhase 3の準備を並行可能
- ただし、移行作業自体は直列実行（リスク軽減のため）

## 参考資料

- [Claude Code SDK Documentation](https://docs.anthropic.com/ja/docs/claude-code/sdk)
- [Agent SDK Reference](https://docs.claude.com/en/api/agent-sdk/typescript)
- 既存実装:
  - `backend/src/claude/claude-code-client.ts`
  - `backend/src/chat/chat-executor.ts`
  - `backend/src/agents/claude-agent-executor.ts`

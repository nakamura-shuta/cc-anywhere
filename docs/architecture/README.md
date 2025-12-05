# アーキテクチャ概要

## システム構成

CC-Anywhereは、Claude Code SDKを使用してHTTP経由で指示を実行できるサーバーアプリケーションです。

```
┌─────────────┐
│  Frontend   │ SvelteKit + TailwindCSS
│  (Svelte)   │ - タスク管理UI
└──────┬──────┘ - リアルタイム進捗表示
       │        - リポジトリエクスプローラー
       │ HTTP/WebSocket
┌──────┴──────┐
│  Backend    │ Fastify + TypeScript
│  (Node.js)  │ - REST API
└──────┬──────┘ - タスクキュー
       │        - WebSocket配信
       │
┌──────┴──────┐
│   Agents    │ AgentExecutor抽象化
│             │ - ClaudeAgentExecutor
└──────┬──────┘ - CodexAgentExecutor (planned)
       │
┌──────┴──────┐
│   Claude    │ Claude Code SDK / Codex SDK
│    APIs     │ - claude-agent-sdk
└─────────────┘ - @openai/codex-sdk
```

## 主要コンポーネント

### 1. フロントエンド（SvelteKit）

**場所**: `frontend/src/`

**主要機能**:
- タスク作成・管理UI
- リアルタイム進捗表示（WebSocket）
- リポジトリエクスプローラー
- スケジューラー管理
- 設定画面

**技術スタック**:
- SvelteKit 5
- TailwindCSS
- Shadcn-svelte（UIコンポーネント）

### 2. バックエンド（Fastify）

**場所**: `backend/src/`

**主要機能**:
- REST API（`backend/src/server/routes/`）
- WebSocket配信（`backend/src/websocket/`）
- タスクキュー管理（`backend/src/queue/`）
- データベース管理（`backend/src/db/`）

**技術スタック**:
- Fastify（HTTPサーバー）
- SQLite + better-sqlite3
- Winston + pino-pretty（ログ）
- Vitest（テスト）

### 3. Agent Layer

**場所**: `backend/src/agents/`

**設計**:
```typescript
interface IAgentExecutor {
  executeTask(
    request: AgentTaskRequest,
    options: AgentExecutionOptions
  ): AsyncIterator<AgentExecutionEvent>;

  cancelTask(taskId: string): Promise<void>;
  getExecutorType(): ExecutorType;
  isAvailable(): boolean;
}
```

**実装**:
- `ClaudeAgentExecutor` - Claude Agent SDK実装
- `CodexAgentExecutor` - Codex SDK実装
- `BaseExecutorHelper` - 共通タスク管理ロジック（Phase 2で追加）

### 4. 進捗処理

**場所**: `backend/src/services/progress-handler.ts`

**Phase 2で追加された統一進捗ハンドラー**:
- 10種類の進捗イベントを統一処理
- WebSocket配信の自動化
- データベース永続化
- ログメッセージ生成

```typescript
class ProgressHandler {
  async handleProgress(
    progress: { type: string; message: string; data?: any },
    progressData: ProgressData
  ): Promise<string | null>
}
```

**イベントタイプ**:
1. `log` - 一般ログ
2. `tool_usage` - ツール使用状況
3. `progress` - 進捗更新
4. `summary` - サマリー
5. `todo_update` - TODO更新
6. `tool:start` - ツール開始
7. `tool:end` - ツール終了
8. `claude:response` - Claude応答
9. `statistics` - 統計情報
10. `unknown` - 未知のイベント

## リファクタリング履歴

### Phase 1: ヘルパー抽出（2025-01）

**目的**: 共通ロジックの抽出とエラーハンドリングの統一

**実装内容**:
1. **FormattingHelpers** (`backend/src/utils/formatting-helpers.ts`)
   - タスクID生成
   - タイムスタンプフォーマット
   - 期間フォーマット

2. **ErrorHandlers** (`backend/src/utils/error-handlers.ts`)
   - データベースエラーハンドリング
   - ファイルシステムエラーハンドリング
   - 外部APIエラーハンドリング

**影響範囲**:
- task-queue.ts で使用
- 複数のサービスクラスで活用

### Phase 2: 進捗処理とExecutor基盤（2025-01）

**目的**: コード重複の削減とメンテナンス性向上

**実装内容**:
1. **ProgressHandler** (`backend/src/services/progress-handler.ts`)
   - 10種類の進捗イベントを統一処理
   - task-queue.tsから307行の重複コードを抽出
   - 372行の再利用可能なクラス

2. **BaseExecutorHelper** (`backend/src/agents/base-executor-helper.ts`)
   - タスクID生成
   - タスクトラッキング
   - キャンセル処理
   - 166行の共通ロジック

**成果**:
- task-queue.ts: **1209行 → 906行（-303行、-25%削減）**
- テストカバレッジ: 43個の新規テスト追加
- 全テスト合格: 657 unit + 37 integration

**詳細**: [Phase 2完了レポート](../phase2-completion-report.md)

## データフロー

### タスク実行フロー

```
1. API Request
   ↓
2. TaskQueue.addTask()
   ↓
3. TaskQueue.processTask()
   ↓
4. AgentExecutor.executeTask()
   ├─→ Progress Events → ProgressHandler → WebSocket/DB
   │
   ├─→ Tool Executions → ProgressData
   │
   └─→ Conversation History → DB
   ↓
5. TaskRepository.updateResult()
   ↓
6. WebSocket Broadcast (task:completed)
```

### 進捗イベントフロー（Phase 2改善後）

```
AgentExecutor
   │ progress event
   ↓
ProgressHandler.handleProgress()
   ├─→ Update ProgressData
   ├─→ WebSocket Broadcast
   ├─→ Database Persist
   └─→ Generate Log Message
```

**Before Phase 2**: 307行の switch文がtask-queue.tsに存在
**After Phase 2**: ProgressHandler に統一、35行のハンドラー呼び出しのみ

## データベーススキーマ

### tasks テーブル

主要カラム:
- `id` - タスクID（UUID）
- `status` - タスクステータス（pending/running/completed/failed/cancelled）
- `instruction` - 実行指示
- `repository` - リポジトリ名
- `result` - 実行結果（JSON）
- `progressData` - 進捗データ（JSON）
  - `currentTurn`, `toolUsageCount`, `statistics`, `todos`, `toolExecutions`, `claudeResponses`
- `conversationHistory` - 会話履歴（JSON、Phase 1で追加）
- `sdkSessionId` - SDK セッションID
- `workingDirectory` - 作業ディレクトリ
- `createdAt`, `startedAt`, `completedAt` - タイムスタンプ

### schedules テーブル

スケジュール設定:
- `id` - スケジュールID
- `name` - スケジュール名
- `cronExpression` - Cron式
- `instruction` - 実行指示
- `enabled` - 有効/無効

### sdk_sessions テーブル

SDKセッション管理:
- `id` - セッションID
- `status` - セッションステータス
- `workingDirectory` - 作業ディレクトリ
- `lastAccessedAt` - 最終アクセス時刻

## セキュリティ

### パス検証（Phase 1で強化）

**PathValidator** (`backend/src/utils/path-validator.ts`)

検証フロー:
1. 絶対パス化
2. ホワイトリストチェック
3. システムディレクトリチェック
4. 存在確認
5. シンボリックリンク解決

設定:
- `ALLOWED_WORKING_DIRECTORIES` - 許可ディレクトリ
- `STRICT_PATH_VALIDATION` - システムディレクトリ保護
- `REQUIRE_WHITELIST` - ホワイトリスト必須化

詳細: [セキュリティ設定](../configuration/security.md)

### API認証

- APIキー認証（`X-API-Key` ヘッダー）
- WebSocket認証メッセージ

## パフォーマンス最適化

### Phase 2で実現した改善

1. **コード削減による保守性向上**
   - task-queue.ts: 25%削減
   - 重複コード削除

2. **再利用性の向上**
   - ProgressHandler: 複数箇所で利用可能
   - BaseExecutorHelper: 全Executorで共有

3. **テストカバレッジ向上**
   - 43個の新規テスト
   - 100%カバレッジ達成

## テスト戦略

### ユニットテスト

**場所**: `backend/tests/unit/`

**カバレッジ**:
- 657 tests passing
- Phase 1: FormattingHelpers (12 tests), ErrorHandlers (6 tests)
- Phase 2: ProgressHandler (21 tests), BaseExecutorHelper (22 tests)

### 統合テスト

**場所**: `backend/tests/integration/`

**カバレッジ**:
- 37 tests passing
- SDK統合テスト
- エンドポイント統合テスト

### テスト実行

```bash
pnpm run test:unit          # ユニットテストのみ
pnpm run test:integration   # 統合テストのみ
pnpm run type-check         # 型チェック
pnpm run lint               # Lint
```

## 開発ワークフロー

1. **ブランチ戦略**
   - `master` - メインブランチ
   - `feature/*` - 機能追加
   - `refactor/*` - リファクタリング

2. **コミット規約**
   - `feat:` - 新機能
   - `fix:` - バグ修正
   - `refactor:` - リファクタリング
   - `docs:` - ドキュメント更新
   - `test:` - テスト追加/修正

3. **品質保証**
   - 全テスト合格必須
   - 型チェック合格必須
   - Lint警告0エラー必須

## 今後の拡張予定

### Phase 3候補

1. **型定義の統一**
   - 進捗イベント型の統一
   - ProgressData型の最適化

2. **BaseExecutorHelper拡張**
   - タスクタイムアウトサポート
   - タスク優先度キューイング

3. **ProgressHandler拡張**
   - イベントバッチング
   - カスタマイズ可能な永続化戦略

4. **リポジトリ統一**
   - TaskRepositoryAdapterの廃止
   - 完全な非同期化

## 関連ドキュメント

- [Phase 2完了レポート](../phase2-completion-report.md)
- [API リファレンス](../api/README.md)
- [セキュリティ設定](../configuration/security.md)
- [会話履歴機能](../features/conversation-history.md)

# タスクキューアーキテクチャ

## 概要

CC-Anywhereのタスクキューは、p-queueライブラリを基盤として構築された、優先度付きタスク実行システムです。

## アーキテクチャ

### コンポーネント構成

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────────┐
│   API Routes    │────▶│ Task Queue   │────▶│ Task Executor   │
│ /api/queue/*    │     │  (p-queue)   │     │ (Claude Code)   │
└─────────────────┘     └──────────────┘     └─────────────────┘
         │                      │                      │
         ▼                      ▼                      ▼
┌─────────────────┐     ┌──────────────┐     ┌─────────────────┐
│   Task Store    │     │ Event Bus    │     │   Logger        │
│  (In-Memory)    │     │              │     │                 │
└─────────────────┘     └──────────────┘     └─────────────────┘
```

### 主要クラス

#### TaskQueueImpl
- **責任**: タスクのキューイングと実行管理
- **主要機能**:
  - 優先度に基づくタスク実行順序の制御
  - 並行実行数の管理
  - タスクのライフサイクル管理（pending → running → completed/failed）
  - イベント通知（onComplete, onError）

#### TaskExecutorImpl
- **責任**: 個別タスクの実行
- **主要機能**:
  - Claude Code SDKとの統合
  - 作業ディレクトリの設定
  - ツール使用制限（allowedTools）
  - タイムアウト処理

## データフロー

1. **タスク追加**
   ```
   API Request → Queue Routes → TaskQueue.add() → In-Memory Store
   ```

2. **タスク実行**
   ```
   p-queue → TaskQueue.executeTask() → TaskExecutor → Claude Code SDK
   ```

3. **イベント通知**
   ```
   Task Complete/Error → Event Handlers → Logging/Monitoring
   ```

## 優先度システム

タスクは優先度値（数値）に基づいて実行されます：
- 高い数値 = 高い優先度
- デフォルト優先度 = 0
- 同じ優先度の場合は、追加順（FIFO）

```typescript
// 優先度10のタスクが最初に実行される
queue.add({ instruction: "重要なタスク" }, 10);
queue.add({ instruction: "通常のタスク" }, 5);
queue.add({ instruction: "低優先度タスク" }, 1);
```

## 並行実行制御

- デフォルト同時実行数: 2
- 環境変数 `QUEUE_CONCURRENCY` で設定可能
- 実行時に動的変更可能（`PUT /api/queue/concurrency`）

## 状態管理

### タスク状態

```
pending → running → completed
                 ↘
                   failed
                 ↗
        cancelled
```

### キュー統計

- `size`: キュー内の待機タスク数
- `pending`: 待機中のタスク数
- `running`: 実行中のタスク数
- `completed`: 完了したタスク総数
- `failed`: 失敗したタスク総数
- `isPaused`: キューの一時停止状態

## エラーハンドリング

1. **タスクレベルエラー**
   - Claude Code実行エラー
   - タイムアウト
   - 検証エラー

2. **システムレベルエラー**
   - キューオーバーフロー
   - メモリ不足
   - ネットワークエラー

## パフォーマンス考慮事項

1. **メモリ使用量**
   - 現在はインメモリストレージ
   - 大量のタスクには注意が必要
   - 将来的にはRedis/DBへの永続化を検討

2. **スケーラビリティ**
   - 単一プロセス内での実行
   - 水平スケーリングには分散キューが必要

## 実装詳細

### タスクIDの生成
- UUID v4を使用して一意のIDを生成
- 衝突の可能性は実質的にゼロ

### タスクストレージ
- 現在はMapオブジェクトでインメモリ管理
- キーはタスクID、値はQueuedTaskオブジェクト
- サーバー再起動時にデータは失われる

### イベントハンドラー
```typescript
// タスク完了時
queue.onComplete((task) => {
  logger.info({ taskId: task.id }, "Task completed");
});

// エラー発生時
queue.onError((task, error) => {
  logger.error({ taskId: task.id, error }, "Task failed");
});
```

### 同期実行の実装
```typescript
// executeTask内で非同期処理を同期的に待機
const result = await this.executor.execute(task.request);
```

## セキュリティ考慮事項

1. **APIキー認証**
   - すべてのキューエンドポイントで必須
   - ヘッダー `X-API-Key` で検証

2. **ツール制限**
   - `allowedTools` でClaude Codeの権限を制限可能
   - デフォルトは全ツール許可

3. **タイムアウト**
   - 最大600秒（10分）に制限
   - 無限ループや長時間実行を防止

## 今後の拡張予定

1. **永続化層**
   - SQLiteまたはPostgreSQLでのタスク保存
   - サーバー再起動後のタスク復元

2. **分散実行**
   - Redis/BullMQへの移行
   - 複数ワーカーでの処理

3. **高度な機能**
   - タスクの依存関係管理
   - バッチ処理
   - スケジューリング（cron）
   - Webhookによる完了通知
   - タスクの再実行機能
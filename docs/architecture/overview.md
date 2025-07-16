# システムアーキテクチャ概要

CC-Anywhereの全体的なアーキテクチャとコンポーネントの関係を説明します。

## システム構成図

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Web Browser   │     │  CLI Client     │     │  External API   │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                        │
         │          HTTP/WebSocket                        │
         └───────────────────┬────────────────────────────┘
                             │
                    ┌────────┴────────┐
                    │  Fastify Server │
                    │   (Port 5000)   │
                    └────────┬────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
    ┌────┴─────┐      ┌──────┴──────┐    ┌──────┴──────┐
    │   API    │      │  WebSocket  │    │   Static    │
    │  Routes  │      │   Handler   │    │   Files     │
    └────┬─────┘      └──────┬──────┘    └─────────────┘
         │                   │
         └─────────┬─────────┘
                   │
          ┌────────┴────────┐
          │  Task Manager   │
          └────────┬────────┘
                   │
         ┌─────────┴─────────┐
         │                   │
    ┌────┴─────┐      ┌──────┴──────┐
    │  Queue   │      │   Workers   │
    │  System  │      │    Pool     │
    └────┬─────┘      └──────┬──────┘
         │                   │
         └─────────┬─────────┘
                   │
          ┌────────┴────────┐
          │ Claude SDK/API  │
          └────────┬────────┘
                   │
         ┌─────────┴─────────┐
         │                   │
    ┌────┴─────┐      ┌──────┴──────┐
    │ SQLite   │      │   Git       │
    │   DB     │      │  Worktree   │
    └──────────┘      └─────────────┘
```

## コアコンポーネント

### 1. HTTPサーバー (Fastify)

高性能なWebフレームワークFastifyを使用：

- **REST API**: タスクの作成、管理、状態取得
- **WebSocket**: リアルタイムログストリーミング
- **静的ファイル**: Web UI配信
- **ミドルウェア**: 認証、CORS、エラーハンドリング

### 2. タスクマネージャー

タスクのライフサイクル管理：

```typescript
interface TaskManager {
  create(task: TaskRequest): Promise<Task>
  execute(task: Task): Promise<TaskResult>
  cancel(taskId: string): Promise<void>
  getStatus(taskId: string): Promise<TaskStatus>
}
```

### 3. キューシステム

効率的なタスク処理のためのキュー管理：

- **優先度付きキュー**: 重要なタスクを優先実行
- **同時実行制御**: リソース使用の最適化
- **リトライ機能**: 失敗時の自動再試行
- **永続化**: システム再起動後も継続

### 4. ワーカープール

並列タスク実行のためのワーカー管理：

- **プロセス分離**: 各ワーカーは独立プロセス
- **自動スケーリング**: 負荷に応じた調整
- **ヘルスチェック**: 異常ワーカーの自動再起動
- **リソース制限**: メモリ/CPU制限

### 5. Claude統合

Claude Code SDKとの通信レイヤー：

- **Claude Code SDK**: ファイル操作、コード実行、AIタスク実行
- **トークン管理**: 使用量の追跡
- **エラーハンドリング**: レート制限、タイムアウト
- **権限管理**: 実行権限の制御（default, acceptEdits, bypassPermissions, plan）

### 6. データ永続化

SQLiteによるタスク履歴の保存：

```sql
-- タスクテーブル
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  instruction TEXT,
  status TEXT,
  created_at DATETIME,
  completed_at DATETIME,
  result TEXT,
  error TEXT,
  metadata TEXT
);
```

### 7. Git Worktree管理

独立した実行環境の提供：

- **Worktree作成**: タスクごとの隔離環境
- **ブランチ管理**: 自動的なブランチ作成
- **クリーンアップ**: 使用後の自動削除
- **リソース管理**: 最大Worktree数の制限

## データフロー

### タスク実行フロー

1. **リクエスト受信**
   - HTTPリクエストを受信
   - 認証・バリデーション
   - タスクオブジェクト作成

2. **キューイング**
   - タスクをキューに追加
   - 優先度に基づいて並べ替え
   - ワーカーに割り当て

3. **実行**
   - ワーカーがタスクを取得
   - Worktree作成（必要な場合）
   - Claude SDKでタスク実行

4. **結果処理**
   - 実行結果の収集
   - データベースに保存
   - WebSocketで通知

5. **クリーンアップ**
   - Worktreeの削除
   - リソースの解放
   - 次のタスクへ

## スケーラビリティ

### 水平スケーリング

```yaml
# PM2でのクラスタリング
instances: 4
exec_mode: cluster
```

### 垂直スケーリング

```env
# リソース設定
MAX_CONCURRENT_TASKS=20
WORKER_COUNT=8
NODE_OPTIONS=--max-old-space-size=4096
```

## セキュリティ

### 認証・認可

- APIキーベース認証
- JWT対応（将来）
- レート制限

### プロセス分離

- ワーカープロセスの分離
- Worktreeによるファイルシステム分離
- リソース制限

### データ保護

- HTTPS通信（Cloudflare Tunnel経由）
- ログのサニタイゼーション
- 機密情報の暗号化

## モニタリング

### メトリクス

- タスク実行時間
- キュー長
- ワーカー使用率
- エラー率

### ロギング

```typescript
logger.info('Task completed', {
  taskId,
  duration,
  status: 'success'
});
```

### ヘルスチェック

```bash
GET /health
{
  "status": "ok",
  "queue": { "length": 5, "active": 2 },
  "workers": { "total": 4, "active": 2 },
  "uptime": 3600
}
```

## 拡張ポイント

### プラグインシステム

```typescript
interface Plugin {
  name: string
  initialize(app: FastifyInstance): Promise<void>
  beforeTask?(task: Task): Promise<void>
  afterTask?(task: Task, result: any): Promise<void>
}
```

### カスタムワーカー

```typescript
class CustomWorker extends BaseWorker {
  async processTask(task: Task): Promise<Result> {
    // カスタム処理
  }
}
```

### ストレージ抽象化

```typescript
interface Storage {
  save(task: Task): Promise<void>
  load(taskId: string): Promise<Task>
  query(filter: Filter): Promise<Task[]>
}
```

## フロントエンドアーキテクチャ

### モジュール構成

Web UIは以下のモジュールで構成されています：

```
web/
├── css/                      # モジュラーCSS
│   ├── base.css             # CSS変数とリセット
│   ├── components.css       # 再利用可能なUI部品
│   ├── layouts.css          # レイアウトとレスポンシブ
│   ├── index.css            # タスクページ固有
│   └── scheduler.css        # スケジューラーページ固有
├── logger.js                 # フロントエンドロギング
├── error-handler.js          # グローバルエラーハンドリング
├── websocket-manager.js      # WebSocket管理
├── state-manager.js          # グローバル状態管理
├── api.js                    # APIクライアント
├── utils.js                  # ユーティリティ関数
├── app-common.js             # 共通UI機能
├── app.js                    # メインタスクページ
└── scheduler.js              # スケジューラーページ
```

### 主要コンポーネント

1. **WebSocketManager**: 中央集権的なWebSocket接続管理
   - 自動再接続
   - イベントベースの通信
   - 認証とサブスクリプション管理

2. **StateManager**: アプリケーション全体の状態管理
   - タスク情報の一元管理
   - イベント駆動型の状態更新
   - ストリーミングログの管理

3. **ErrorHandler**: 統一されたエラーハンドリング
   - グローバルエラーキャッチ
   - API/WebSocketエラーの処理
   - ユーザーへの通知

4. **Logger**: 構造化されたフロントエンドログ
   - デバッグ情報の記録
   - レベル別ログ出力
   - パフォーマンス計測

## 将来の拡張

- **Kubernetes対応**: コンテナ化とオーケストレーション
- **分散キュー**: Redisベースのキューシステム
- **マルチテナント**: 組織別の分離
- **GraphQL API**: より柔軟なクエリ
- **プラグインマーケットプレイス**: コミュニティ拡張
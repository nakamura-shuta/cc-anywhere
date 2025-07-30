# サーバーセットアップのリファクタリング（2025-07-28）

## 概要

`createApp`関数の肥大化問題を解決するため、責務別に関数を分割しました。これにより、保守性、テスタビリティ、可読性が向上しました。

## 変更前の問題点

- `createApp`関数が323行に及ぶ巨大な関数
- 複数の責務が混在（ワーカーモード設定、WebSocket設定、ミドルウェア登録、ルート登録、グレースフルシャットダウン等）
- テスタビリティが低い
- 責務の境界が不明確

## リファクタリング後の構造

### ディレクトリ構造
```
backend/src/server/
├── app.ts              # メインのcreateApp関数（86行に削減）
└── setup/              # 分割された関数群
    ├── index.ts        # エクスポート集約
    ├── worker-mode.ts  # ワーカーモード設定
    ├── websocket.ts    # WebSocket設定
    ├── middleware.ts   # ミドルウェア登録
    ├── routes.ts       # ルート登録
    ├── graceful-shutdown.ts  # グレースフルシャットダウン
    ├── decorators.ts   # Fastifyデコレーター
    ├── scheduler.ts    # スケジューラー設定
    └── services.ts     # 共有サービス初期化
```

### 各関数の責務

#### 1. setupWorkerMode (worker-mode.ts)
- **責務**: ワーカーモードの設定とタスクキューの初期化
- **行数**: 93行
- **主な処理**:
  - inline/standalone/managedモードに応じたタスクキューの設定
  - managedモードの場合はWorkerManagerの初期化と起動
  - タスクイベントハンドラーの設定

#### 2. configureWebSocket (websocket.ts)
- **責務**: WebSocketサーバーの設定とタスクキューとの統合
- **行数**: 92行
- **主な処理**:
  - WebSocketサーバーの初期化
  - タスク完了/エラーイベントとWebSocketブロードキャストの連携
  - ログストリーミングの設定

#### 3. registerMiddleware (middleware.ts)
- **責務**: 各種ミドルウェアの登録
- **行数**: 36行
- **主な処理**:
  - helmet, cors, sensibleの登録
  - 静的ファイルサービングの設定
  - エラーハンドラーの登録

#### 4. registerRoutes (routes.ts)
- **責務**: APIルートの登録
- **行数**: 39行
- **主な処理**:
  - 各種APIルートの登録
  - managedモードの場合のみworkerRoutesを登録

#### 5. setupGracefulShutdown (graceful-shutdown.ts)
- **責務**: グレースフルシャットダウンの設定
- **行数**: 80行
- **主な処理**:
  - シグナルハンドラーの設定
  - 各コンポーネントの適切な終了処理
  - タスクの完了待機

#### 6. decorateApp (decorators.ts)
- **責務**: Fastifyアプリケーションへのデコレーター設定
- **行数**: 36行
- **主な処理**:
  - 各サービスをアプリケーションインスタンスにデコレート

#### 7. setupScheduler (scheduler.ts)
- **責務**: スケジューラーサービスの設定
- **行数**: 17行
- **主な処理**:
  - スケジューラーの実行ハンドラー設定

#### 8. initializeServices (services.ts)
- **責務**: 共有サービスの初期化
- **行数**: 14行
- **主な処理**:
  - データベース、リポジトリ、スケジューラーサービスの初期化

## リファクタリング後のcreateApp関数

```typescript
export async function createApp(opts: AppOptions = {}): Promise<FastifyInstance> {
  // Create Fastify instance with logger configuration
  const loggerOptions = /* ... */;
  const app = fastify({ logger: opts.logger ?? loggerOptions, ...opts });
  
  // Determine worker mode
  const workerMode = opts.workerMode ?? config.worker.mode;

  // 1. Set up worker mode and task queue
  const { taskQueue, workerManager } = await setupWorkerMode(app, workerMode);

  // 2. Initialize shared services
  const services = initializeServices();

  // 3. Decorate app with services
  decorateApp(app, { taskQueue, workerManager, ...services });

  // 4. Set up scheduler with task queue integration
  setupScheduler(services.schedulerService, taskQueue);

  // 5. Configure WebSocket server
  const wsServer = await configureWebSocket(app, taskQueue);

  // 6. Register middleware
  await registerMiddleware(app);

  // 7. Register routes
  await registerRoutes(app, workerMode);

  // 8. Set up graceful shutdown
  setupGracefulShutdown({
    app,
    taskQueue,
    workerManager,
    wsServer,
    schedulerService: services.schedulerService,
    workerMode,
  });

  // 9. Start scheduler service
  services.schedulerService.start();
  logger.info("Scheduler service started");

  return app;
}
```

## 成果

### 定量的な改善
- **createApp関数**: 323行 → 86行（73%削減）
- **ファイル数**: 1ファイル → 9ファイル（責務別に分割）
- **テスト**: 全ユニットテスト・統合テストが成功

### 定性的な改善
1. **保守性の向上**: 各関数の責務が明確になり、変更が容易に
2. **テスタビリティの向上**: 各関数を独立してテスト可能
3. **可読性の向上**: 関数が小さくなり、理解しやすい
4. **再利用性の向上**: 各設定関数を独立して使用可能

## 今後の拡張ポイント

1. **設定の外部化**: 各setupファイルの設定をさらに外部化可能
2. **プラグイン化**: 各機能をFastifyプラグインとして実装可能
3. **動的ロード**: 必要な機能のみを動的にロード可能
4. **テストの追加**: 各分割関数の単体テストを追加可能

## 移行時の注意点

- すべての既存テストが成功することを確認済み
- APIの互換性は完全に維持
- 内部実装の変更のみで、外部インターフェースに変更なし
# CC-Anywhere プロジェクト概要

## プロジェクト説明

CC-Anywhere (Claude Code Anywhere)は、Claude Code SDKをHTTPサーバー経由で利用可能にするAPIサーバーアプリケーションです。外部からHTTPリクエストを受け取り、Claude Code SDKを通じて様々なタスクを実行し、結果を返すサービスとして機能します。

## 主な特徴

- **Claude Code SDK統合**: AI駆動のコード生成・編集タスクをHTTP API経由で実行
- **非同期タスク実行**: 長時間実行タスクのサポート
- **リアルタイム通信**: WebSocketによるタスクの進捗・ログのストリーミング
- **柔軟な実行環境**: Git worktreeによる独立したタスク実行環境
- **タスク管理**: キュー管理、バッチ実行、スケジュール実行のサポート
- **セッション管理**: 複数ターンの会話をサポート
- **拡張性**: スラッシュコマンド、プリセット、MCPサーバー統合

## 技術スタック

- **言語**: TypeScript/Node.js
- **HTTPフレームワーク**: Fastify (高性能Webサーバー)
- **AI統合**: 
  - `@anthropic-ai/claude-code` (Claude Code SDK)
  - `@anthropic-ai/sdk` (Claude API)
- **データベース**: SQLite (Better SQLite3)
- **リアルタイム通信**: WebSocket (ws)
- **テスト**: Vitest
- **ログ**: Winston + pino-pretty
- **プロセス管理**: PM2対応

## ディレクトリ構造

```
cc-anywhere/
├── src/                      # ソースコード
│   ├── index.ts             # アプリケーションエントリポイント
│   ├── server/              # HTTPサーバー関連
│   │   ├── app.ts          # Fastifyアプリケーション設定
│   │   ├── routes/         # APIルート定義
│   │   │   ├── tasks.ts    # タスク実行API
│   │   │   ├── queue.ts    # キュー管理API
│   │   │   ├── batch-tasks.ts # バッチタスクAPI
│   │   │   ├── sessions.ts # セッション管理API
│   │   │   └── ...
│   │   └── plugins/        # Fastifyプラグイン
│   ├── claude/             # Claude SDK統合
│   │   ├── claude-code-client.ts # Claude Code SDKクライアント
│   │   ├── executor.ts     # タスク実行エンジン
│   │   └── types.ts        # 型定義
│   ├── services/           # ビジネスロジック
│   │   ├── task-tracker.ts # タスク進捗追跡
│   │   ├── scheduler-service.ts # スケジューラー
│   │   ├── session-manager.ts # セッション管理
│   │   └── worktree/       # Git worktree管理
│   ├── queue/              # タスクキュー実装
│   ├── websocket/          # WebSocketサーバー
│   ├── repositories/       # データアクセス層
│   ├── db/                 # データベース関連
│   ├── config/             # 設定管理
│   ├── types/              # 共通型定義
│   └── utils/              # ユーティリティ
├── tests/                  # テストコード
├── web/                    # Web UI (静的ファイル)
├── docs/                   # ドキュメント
├── scripts/                # 運用スクリプト
└── config/                 # 設定ファイル
```

## 主要コンポーネント

### 1. HTTPサーバー (src/server/app.ts)

Fastifyベースの高性能HTTPサーバーで、以下の機能を提供：
- CORS、ヘルメット、エラーハンドリングなどのミドルウェア
- RESTful APIエンドポイント
- 静的ファイルサービング (Web UI)
- WebSocketサーバー統合

### 2. タスク実行エンジン (src/claude/executor.ts)

Claude Code SDKとの統合を管理し、以下の機能を実装：
- タスクリクエストの前処理（スラッシュコマンド）
- Git worktreeによる独立実行環境
- タイムアウト管理とキャンセル機能
- 進捗レポートとログストリーミング
- リトライ処理
- TODO追跡機能

### 3. タスクキュー (src/queue/)

非同期タスク実行のためのキューシステム：
- 並行実行数の制御
- タスクの優先度管理
- タスク状態の追跡
- イベント駆動アーキテクチャ

## API概要

### タスク実行
- `POST /api/tasks` - 新規タスクの作成・実行
- `GET /api/tasks/:id` - タスク状態の取得
- `GET /api/tasks/:id/logs` - タスクログのストリーミング
- `DELETE /api/tasks/:id` - タスクのキャンセル

### セッション管理
- `POST /api/sessions` - 新規セッションの作成
- `POST /api/sessions/:id/messages` - セッションへのメッセージ送信
- `GET /api/sessions/:id` - セッション情報の取得

### キュー管理
- `GET /api/queue` - キュー状態の取得
- `POST /api/queue/pause` - キューの一時停止
- `POST /api/queue/resume` - キューの再開

### その他
- `GET /health` - ヘルスチェック
- `GET /api/schedules` - スケジュール管理
- `GET /api/repositories` - リポジトリ管理
- WebSocket接続: `/ws` - リアルタイム通信

## 実行モード

1. **インラインモード** (デフォルト): メインプロセスでタスクを実行
2. **スタンドアロンモード**: タスクを外部ワーカーで実行
3. **マネージドモード**: 子プロセスワーカーを自動管理

## セキュリティ

- APIキー認証 (オプション)
- CORS設定
- Helmet.jsによるセキュリティヘッダー
- 入力検証とサニタイゼーション

## 拡張機能

- **スラッシュコマンド**: カスタムコマンドによるタスクの前処理
- **プリセット**: 事前定義されたタスクテンプレート
- **MCPサーバー**: Model Context Protocol対応
- **外部アクセス**: Cloudflareトンネル/ngrok統合

## 開発・運用

- `npm run dev` - 開発サーバー起動
- `npm run build` - TypeScriptビルド
- `npm start` - プロダクション起動
- PM2対応による本番環境での堅牢な運用

## ライセンス

MITライセンス
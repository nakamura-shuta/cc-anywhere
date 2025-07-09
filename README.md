# CC-Anywhere

Claude Code SDKを使用してHTTP経由で指示できるアプリです。

## 概要

CC-Anywhereは、HTTPリクエストを通じてClaude Code SDKと対話し、様々なタスクを実行できるAPIサーバーです。

### 主な機能

- 🚀 Claude Code SDKをHTTP API経由で利用
- 📱 モバイル対応Web UI
- 🔄 非同期タスク実行とキュー管理
- 📦 複数リポジトリへの一括実行
- 🌿 Git Worktree統合（独立した作業環境）
- 💬 スラッシュコマンドサポート
- 🌐 Cloudflare Tunnel統合
- 🔐 APIキー認証
- 📊 リアルタイムログ（WebSocket）
- 🔁 自動リトライ機能

## セットアップ

### 前提条件

- Node.js 20以上
- Claude API キー

### インストール

```bash
# リポジトリのクローン
git clone https://github.com/nakamura-shuta/cc-anywhere
cd cc-anywhere

# 依存関係のインストール
npm install

# 環境変数の設定
cp .env.example .env
# .envファイルを編集してCLAUDE_API_KEYを設定
```

### 環境変数

`.env`ファイルに以下の環境変数を設定してください：

```env
# 必須
CLAUDE_API_KEY=your-claude-api-key

# API認証
# APIキーを設定すると認証が有効になります。
API_KEY=your-secret-api-key

# サーバー設定
PORT=5000
NODE_ENV=development

# ログ設定
LOG_LEVEL=debug

# タスク実行設定
TASK_TIMEOUT_MS=300000
MAX_CONCURRENT_TASKS=10
USE_CLAUDE_CODE_SDK=true
QUEUE_CONCURRENCY=2

# データベース（SQLite）
DB_PATH=./data/cc-anywhere.db

# ワーカー設定
WORKER_MODE=inline  # inline, standalone, managed
WORKER_COUNT=1      # managed モードでのワーカー数
```

## 使用方法

### リポジトリ設定

Web UIで使用する(Claude Codeの実行対象）ローカルリポジトリを設定します：

```bash
# サンプルから設定ファイルを作成
cp config/repositories.json.example config/repositories.json

# リポジトリ情報を編集
```

`config/repositories.json`の例：
```json
{
  "repositories": [
    {
      "name": "my-project",
      "path": "/path/to/my-project"
    },
    {
      "name": "another-project",
      "path": "/path/to/another-project"
    }
  ]
}
```

### 開発サーバーの起動

```bash
npm run dev
```

サーバーはデフォルトで `http://localhost:5000` で起動します。

### Web UI について

cc-anywhere には2つのWeb UIバージョンがあります：

- **標準版** (`/index.html`) - フル機能版（デフォルト）
  - Claude Code SDKの全オプション設定
  - プリセット保存・管理機能
  - 詳細な実行設定
- **シンプル版** (`/index-simple.html`) - 基本機能のみ

Web UIにアクセス：
```
http://localhost:5000/?apiKey=your-secret-api-key
```

シンプル版を使用する場合：
```
http://localhost:5000/index-simple.html?apiKey=your-secret-api-key
```

別のポートで起動する場合：
```bash
PORT=5001 npm run dev
```

### ワーカーシステム

CC-Anywhereは3つのワーカーモードをサポートします：

- **Inline Mode (デフォルト)** - APIサーバーと同じプロセスでタスクを処理
- **Standalone Mode** - APIサーバーとワーカーを別プロセスで実行
- **Managed Mode** - APIサーバーが自動的にワーカープロセスを管理

詳細は[ワーカーシステムドキュメント](docs/architecture/worker-system.md)を参照してください。

### テストの実行

```bash
# 全テスト
npm test

# ユニットテストのみ
npm run test:unit
```

### その他のコマンド

```bash
# Lintチェック
npm run lint

# Lintエラーの自動修正
npm run lint:fix

# 型チェック
npm run type-check

# ビルド
npm run build

# クリーンビルド
npm run clean && npm run build
```

## バッチタスク

複数のリポジトリに対して同じタスクを並列実行する機能です。

### APIでの使用

```bash
# 複数リポジトリでテストを実行
curl -X POST http://localhost:5000/api/batch/tasks \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "instruction": "npm test",
    "repositories": [
      {"name": "app1", "path": "/path/to/app1"},
      {"name": "app2", "path": "/path/to/app2"},
      {"name": "app3", "path": "/path/to/app3"}
    ],
    "options": {
      "timeout": 300000,
      "allowedTools": ["Bash", "Read", "Write"]
    }
  }'
```

### Web UIでの使用

1. 複数のリポジトリを選択（Ctrl/Cmdキーを押しながらクリック）
2. プロンプトを入力
3. 「タスクを実行」をクリック

選択された各リポジトリに対して独立したタスクが作成され、並列で実行されます。

### バッチタスクのステータス確認

```bash
# グループIDを使用してバッチタスクのステータスを確認
curl -X GET http://localhost:5000/api/batch/tasks/{groupId}/status \
  -H "X-API-Key: your-api-key"
```

レスポンス例：
```json
{
  "groupId": "group_123",
  "summary": {
    "total": 3,
    "pending": 1,
    "running": 1,
    "completed": 1,
    "failed": 0
  },
  "tasks": [
    {
      "taskId": "task1",
      "repository": "app1",
      "status": "completed",
      "duration": 5000
    },
    // ...
  ]
}
```

## スラッシュコマンド

CC-Anywhereは、`/project:` および `/user:` プレフィックスを使用したカスタムスラッシュコマンドをサポートしています。

### 使用方法

- `/project:<command>` - プロジェクトのリポジトリ内の `.claude/commands/` ディレクトリからコマンドを実行
- `/user:<command>` - ユーザーのホームディレクトリの `~/.claude/commands/` からコマンドを実行

### 例

```bash
# プロジェクト固有のコマンドを実行
curl -X POST http://localhost:5000/api/tasks \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "instruction": "/project:analyze src",
    "context": {
      "workingDirectory": "/path/to/project"
    }
  }'

# ユーザー固有のコマンドを実行
curl -X POST http://localhost:5000/api/tasks \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "instruction": "/user:daily-report"
  }'
```

詳細は[スラッシュコマンドドキュメント](docs/features/slash-commands.md)を参照してください。

## Git Worktree統合

独立した作業環境でタスクを実行できます。メインのリポジトリに影響を与えずに安全にタスクを実行可能です。

### 基本的な使い方

```bash
# APIでWorktreeを使用
curl -X POST http://localhost:5000/api/tasks \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "instruction": "npm test を実行",
    "context": {
      "workingDirectory": "/path/to/repo"
    },
    "options": {
      "useWorktree": true
    }
  }'
```

### Web UIでの使用

タスク作成フォームで「Git Worktreeを使用」にチェックを入れるだけです。

### 動作の仕組み

- **現在のブランチ**から新しいWorktreeブランチを作成
- 独立した作業ディレクトリでタスクを実行
- タスク完了後、自動的にクリーンアップ（設定により保持も可能）

詳細は[Git Worktreeドキュメント](docs/features/git-worktree.md)を参照してください。

## API認証

`.env`ファイルに`API_KEY`を設定すると、すべてのAPIエンドポイントで認証が必要になります。

### 認証方法

1. **HTTPヘッダー**（推奨 - API呼び出し用）
   ```bash
   curl -H "X-API-Key: your-secret-api-key" http://localhost:5000/api/tasks
   ```

2. **クエリパラメータ**（Web UIやブラウザアクセス用）
   ```bash
   curl "http://localhost:5000/api/tasks?apiKey=your-secret-api-key"
   ```

## 外部アクセス（Cloudflare Tunnel）

開発中にローカルサーバーを外部からアクセス可能にするため、Cloudflare Tunnel統合を提供しています。

### 自動セットアップ

```bash
# Cloudflare Tunnelの自動セットアップ
npm run tunnel:setup

# セットアップ完了後、サーバー起動時に自動的にトンネルが開始されます
npm run dev
```

### 手動設定

`.env`ファイルで以下を設定：

```bash
ENABLE_CLOUDFLARE_TUNNEL=true
CLOUDFLARE_TUNNEL_NAME=cc-anywhere-dev
SHOW_QR_CODE=true  # QRコード表示（オプション）
```

サーバー起動時に自動的にトンネルが開始され、外部アクセス用のURLとQRコードが表示されます。

## クイックスタート

### 即座にタスクを実行

```bash
# タスクの作成（同期実行）
# API認証が無効の場合（API_KEY未設定）
curl -X POST http://localhost:5000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "instruction": "Write a hello world function"
  }'

# API認証が有効の場合（API_KEY設定済み）
curl -X POST http://localhost:5000/api/tasks \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "instruction": "Write a hello world function"
  }'

# 作業ディレクトリとツール制限を指定
curl -X POST http://localhost:5000/api/tasks \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "instruction": "List TypeScript files",
    "context": {
      "workingDirectory": "/path/to/project"
    },
    "options": {
      "allowedTools": ["Read", "Glob"]
    }
  }'
```

### タスクキューを使用

```bash
# キューにタスクを追加（優先度付き）
curl -X POST http://localhost:5000/api/queue/tasks \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "instruction": "Refactor authentication module",
    "priority": 10
  }'

# キューの状態を確認
curl -X GET http://localhost:5000/api/queue/stats \

# タスク履歴を取得
curl -X GET http://localhost:5000/api/history/tasks \

# フィルタリングとページネーション
curl -X GET "http://localhost:5000/api/history/tasks?status=completed&limit=10&offset=0" \
```


## ライセンス

MIT License

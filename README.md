# CC-Anywhere

Claude Code SDKを使用してHTTP経由で指示できるアプリです。

## 概要

CC-Anywhereは、HTTPリクエストを通じてClaude Code SDKと対話し、様々なタスクを実行できるAPIサーバーです。

### 主な機能

- 🚀 Claude Code SDK (v1.0.51+) をHTTP API経由で利用
- 📱 モバイル対応Web UI（レスポンシブデザイン）
- 🔄 非同期タスク実行とキュー管理
- 📦 複数リポジトリへの一括実行
- 🌿 Git Worktree統合（独立した作業環境）
- 💬 スラッシュコマンドサポート
- 🌐 Cloudflare Tunnel統合
- 🔐 APIキー認証
- ⏰ スケジュール実行（Cron式対応）
- 🎯 権限モード制御（default, acceptEdits, bypassPermissions, plan）
- 💾 設定プリセット管理

## クイックスタート

### 即座にタスクを実行

```bash
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
```

## セットアップ

### 前提条件

- Node.js 20以上
- npm 10以上
- Claude API キー（Claude Code SDK用）

### インストール

```bash
# リポジトリのクローン
git clone https://github.com/your-username/cc-anywhere
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
QUEUE_CONCURRENCY=2

# データベース（SQLite）
DB_PATH=./data/cc-anywhere.db

# Git Worktree設定
ENABLE_WORKTREE=true
WORKTREE_AUTO_CLEANUP=true
WORKTREE_CLEANUP_DELAY=10000
MAX_WORKTREES=20
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

cc-anywhere のWeb UIは以下の機能を提供します：

- **タスク実行画面** (`/index.html`) - メイン画面
  - Claude Code SDKの全オプション設定（maxTurns, permissionMode, allowedTools等）
  - プリセット保存・管理機能（システム/ユーザープリセット）
  - タスク一覧とリアルタイム更新
  - ページネーション機能（10/20/50/100件表示）
  - Git Worktree設定
- **スケジューラー画面** (`/scheduler.html`) - スケジュール管理
  - Cron式による定期実行設定（5フィールド形式）
  - ワンタイム実行の設定
  - タイムゾーン対応
  - スケジュール一覧と管理
  - 実行履歴の確認

Web UIにアクセス：
```
http://localhost:5000/?apiKey=your-secret-api-key
```

別のポートで起動する場合：
```bash
PORT=5001 npm run dev
```

### ワーカーシステム

CC-Anywhereは3つのワーカーモードをサポートします：
- **inline** (デフォルト) - APIサーバーと同じプロセスで実行
- **standalone** - 別プロセスで実行
- **managed** - 自動的にワーカープロセスを管理

環境変数で`WORKER_MODE`と`WORKER_COUNT`を設定します。詳細は`.env.example`を参照してください。

### テストの実行

```bash
# ユニットテストを実行
npm run test:unit

# 統合テストを実行
npm run test:integration

# watchモードでテスト（開発時）
npm run test:watch
```

**注意**: `npm test`は誤ってwatchモードで実行されることを防ぐため、エラーメッセージを表示します。常に特定のテストコマンドを使用してください。

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

複数のリポジトリに対して同じタスクを並列実行する機能です。Web UIで複数リポジトリを選択するか、APIで直接実行します。詳細は[バッチタスクドキュメント](docs/features/batch-tasks.md)を参照してください。

## スラッシュコマンド

`/project:` および `/user:` プレフィックスを使用したカスタムスラッシュコマンドをサポートしています。詳細は[スラッシュコマンドドキュメント](docs/features/slash-commands.md)を参照してください。

## Git Worktree統合

独立した作業環境でタスクを実行できます。Web UIで「Git Worktreeを使用」にチェックを入れるか、APIで`useWorktree: true`を指定します。詳細は[Git Worktreeドキュメント](docs/features/git-worktree.md)を参照してください。

## スケジューラー機能

定期的または特定の時刻にタスクを自動実行できます。Web UIの`/scheduler.html`から設定するか、APIで直接作成します。Cron式（例: `0 2 * * *`で毎日午前2時）やワンタイム実行をサポート。詳細は[スケジューラードキュメント](docs/features/scheduler.md)を参照してください。

## API認証

`.env`ファイルに`API_KEY`を設定すると認証が有効になります。HTTPヘッダー（`X-API-Key`）またはクエリパラメータ（`?apiKey=`）で認証します。詳細は[APIリファレンス](docs/api/api-reference.md)を参照してください。

## 外部アクセス（Cloudflare Tunnel）

開発中にローカルサーバーを外部からアクセス可能にできます。`npm run tunnel:setup`で自動セットアップ。詳細は[外部アクセスドキュメント](docs/features/external-access.md)を参照してください。

## 詳細ドキュメント

- [APIリファレンス](docs/api/api-reference.md) - すべてのAPIエンドポイントの詳細
- [バッチタスク](docs/features/batch-tasks.md) - 複数リポジトリへの一括実行
- [スラッシュコマンド](docs/features/slash-commands.md) - カスタムコマンドの作成と使用
- [Git Worktree](docs/features/git-worktree.md) - 独立した作業環境での実行
- [スケジューラー](docs/features/scheduler.md) - 定期実行とCron式の使用
- [外部アクセス](docs/features/external-access.md) - Cloudflare Tunnelの設定
- [変更履歴](docs/CHANGELOG.md) - 最新の機能と更新

## ライセンス

MIT License

# CC-Anywhere

Claude Code SDKを使用してHTTP経由で指示を実行できるサーバーアプリケーションです。

## 主な機能

- 🚀 **Claude Code SDK 1.0.64** - 最新版のSDKをHTTP API経由で利用（Anthropic API/Amazon Bedrock対応）
- 📱 **レスポンシブWeb UI** - モバイル・デスクトップ対応の使いやすいインターフェース
- 🔄 **リアルタイム更新** - WebSocketによるタスク状況のリアルタイム表示
- 🔐 **API認証** - APIキーによる安全なアクセス制御
- ⏰ **スケジューラー** - Cron式による定期実行機能
- 🎯 **柔軟な実行モード** - default, acceptEdits, bypassPermissions, plan
- 📦 **バッチ実行** - 複数リポジトリへの一括タスク実行
- 🌿 **Git Worktree対応** - 独立した作業環境でのタスク実行

## セットアップ

### 必要な環境

- Node.js 20以上
- npm 10以上
- Claude API キー（[Anthropic Console](https://console.anthropic.com/)で取得）またはAmazon Bedrock（AWS認証情報）

### インストール手順

```bash
# 1. リポジトリのクローン
git clone https://github.com/your-username/cc-anywhere
cd cc-anywhere

# 2. 環境変数の設定
cp .env.example .env
# .envファイルを編集してCLAUDE_API_KEYを設定

# 3. ビルドと起動
./scripts/build-all.sh
./scripts/start-production.sh
```

アクセス: http://localhost:5000

## 環境変数

プロジェクトルートの`.env`ファイルで設定します。

### 必須設定

```env
# Claude API キー（Anthropic APIを使用する場合）
CLAUDE_API_KEY=your-claude-api-key

# または Amazon Bedrockを使用する場合
FORCE_CLAUDE_MODE=bedrock
AWS_REGION=us-east-1               # Bedrockが利用可能なリージョン
# AWS認証情報は環境変数またはIAMロールで提供
```

### オプション設定

```env
# API認証設定
API_KEY=your-secret-api-key        # 設定するとすべてのAPIエンドポイントで認証が必要
                                   # 未設定の場合は認証なしでアクセス可能

# QRコード表示設定
SHOW_QR_CODE=true                  # トンネルURL用のQRコード表示を有効化
QR_AUTH_ENABLED=true               # QRコード表示機能の有効化（認証機能ではありません）

# サーバー設定
PORT=5000                          # ポート番号（デフォルト: 5000）
NODE_ENV=production                # 実行環境

# Git Worktree設定
ENABLE_WORKTREE=true               # Git worktreeを使用した独立環境での実行
WORKTREE_BASE_PATH=.worktrees     # Worktreeの保存先ディレクトリ

# その他の設定は .env.example を参照
```

## 使い方

### 1. リポジトリの設定

対象となるローカルリポジトリを設定：

```bash
cp backend/config/repositories.json.example backend/config/repositories.json
# repositories.jsonを編集してリポジトリパスを設定
```

### 2. Web UIからタスクを実行

ブラウザで http://localhost:5000 にアクセスして：

1. **リポジトリを選択** - 実行対象のリポジトリを選択
2. **指示を入力** - Claude Codeに実行させたい内容を記述
3. **実行** - タスクを開始

### 3. APIから直接実行

```bash
# API_KEYが設定されている場合
curl -X POST http://localhost:5000/api/tasks \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "instruction": "package.jsonの依存関係を最新版に更新して",
    "repositoryName": "my-project"
  }'
```

### サーバー管理コマンド

```bash
# 本番環境で起動
./scripts/start-production.sh

# 開発環境で起動（ホットリロード有効）
./scripts/start-dev.sh

# すべて停止
./scripts/stop-all.sh

# ログ確認
./backend/scripts/pm2-manager.sh logs
```

## 開発者向け情報

### プロジェクト構造

```
cc-anywhere/
├── backend/      # APIサーバー（TypeScript + Fastify）
├── frontend/     # Web UI（SvelteKit）
├── docs/         # ドキュメント
└── scripts/      # ビルド・管理スクリプト
```

### 開発コマンド

```bash
# テスト実行
npm run test:unit         # ユニットテスト
npm run test:integration  # 統合テスト

# コード品質チェック
npm run lint              # Lintチェック
npm run lint:fix          # 自動修正
npm run type-check        # 型チェック
```

### その他機能

- **バッチ実行** - 複数リポジトリへの一括タスク実行
- **スケジューラー** - Cron式による定期実行（`/scheduler`）
- **Git Worktree** - 独立した作業環境でのタスク実行
- **外部アクセス** - Cloudflare Tunnel/ngrokによるリモートアクセス
- **カスタムコマンド** - `/project:`や`/user:`プレフィックスによるカスタムスラッシュコマンドの疑似実行

### 認証とセキュリティ

- **API認証**: `API_KEY`環境変数を設定すると、すべてのAPIエンドポイントで認証が必要になります
  - HTTPヘッダー: `X-API-Key: your-api-key`
- **QRコード表示**: トンネルURL用のQRコードを表示（`SHOW_QR_CODE=true`で有効化）

### 詳細ドキュメント

- [APIリファレンス](docs/api/api-reference.md)
- [機能ドキュメント](docs/features/)
- [変更履歴](docs/CHANGELOG.md)

## ライセンス

MIT License

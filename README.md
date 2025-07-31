# CC-Anywhere

Claude Code SDKを使用してHTTP経由で指示を実行できるサーバーアプリケーションです。

## 主な機能

- 🚀 **Claude Code SDK 1.0.64** - 最新版のSDKをHTTP API経由で利用
- 📱 **レスポンシブWeb UI** - モバイル・デスクトップ対応の使いやすいインターフェース
- 🔄 **リアルタイム更新** - WebSocketによるタスク状況のリアルタイム表示
- 🔐 **QR認証** - モバイルからの簡単アクセス（環境変数で制御）
- ⏰ **スケジューラー** - Cron式による定期実行機能
- 🎯 **柔軟な実行モード** - default, acceptEdits, bypassPermissions, plan
- 📦 **バッチ実行** - 複数リポジトリへの一括タスク実行
- 🌿 **Git Worktree対応** - 独立した作業環境でのタスク実行

## セットアップ

### 必要な環境

- Node.js 20以上
- npm 10以上
- Claude API キー（[Anthropic Console](https://console.anthropic.com/)で取得）

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
# Claude API キー
CLAUDE_API_KEY=your-claude-api-key
```

### オプション設定

```env
# APIアクセス制御
API_KEY=your-secret-api-key        # 設定するとAPI認証が有効化

# QR認証（モバイルアクセス用）
QR_AUTH_ENABLED=true               # QR認証を有効化
QR_AUTH_SECRET=your-qr-secret      # QR認証用シークレット

# サーバー設定
PORT=5000                          # ポート番号（デフォルト: 5000）
NODE_ENV=production                # 実行環境

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
curl -X POST http://localhost:5000/api/tasks \
  -H "Content-Type: application/json" \
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
├── shared/       # 共通型定義
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

### 高度な機能

- **バッチ実行** - 複数リポジトリへの一括タスク実行
- **スケジューラー** - Cron式による定期実行（`/scheduler.html`から設定）
- **Git Worktree** - 独立した作業環境でのタスク実行
- **外部アクセス** - Cloudflare Tunnelによるリモートアクセス
- **カスタムコマンド** - `/project:`や`/user:`プレフィックスによる拡張

### 詳細ドキュメント

- [APIリファレンス](docs/api/api-reference.md)
- [機能ドキュメント](docs/features/)
- [変更履歴](docs/CHANGELOG.md)

## ライセンス

MIT License

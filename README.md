# CC-Anywhere

Claude Code SDKを使用してHTTP経由で指示を実行できるサーバーアプリケーションです。

## クイックスタート（5分で動作確認）

```bash
# 1. クローン
git clone https://github.com/your-username/cc-anywhere
cd cc-anywhere

# 2. 依存関係インストール
npm install

# 3. 最低限の環境変数設定
echo "CLAUDE_API_KEY=your-api-key-here" > .env

# 4. 作業ディレクトリ設定（例：ホームディレクトリ）
echo '[{"name":"Home","path":"'$HOME'"}]' > backend/config/repositories.json

# 5. 起動
npm run dev

# ブラウザで http://localhost:4444 を開く
```

以上で動作確認できます。タスク作成画面で「Home」を選択し、簡単な指示（例：「READMEファイルを作成して」）を入力して実行してみてください。

## 主な機能

- 🚀 **Claude Code SDK 1.0.83** - 最新版のSDKをHTTP API経由で利用（Anthropic API/Amazon Bedrock対応）
- 📱 **レスポンシブWeb UI** - モバイル・デスクトップ対応の使いやすいインターフェース
- 🔄 **リアルタイム更新** - WebSocketによるタスク状況のリアルタイム表示
- 🔐 **API認証** - APIキーによる安全なアクセス制御
- ⏰ **スケジューラー** - Cron式による定期実行機能
- 🎯 **柔軟な実行モード** - default, acceptEdits, bypassPermissions, plan
- 📦 **バッチ実行** - 複数リポジトリへの一括タスク実行
- 🌿 **Git Worktree対応** - 独立した作業環境でのタスク実行
- 📂 **リポジトリエクスプローラー** - ファイルツリー表示とリアルタイム変更通知
- 📚 **OpenAPI/Swagger** - 対話的APIドキュメント（http://localhost:5000/api/docs）
- 💬 **セッション継続** - sdkSessionIdを使用した会話の継続が可能

## セットアップ

### 必要な環境

- Node.js 20以上
- npm 10以上
- pm2（プロセス管理用、`npm install -g pm2` でインストール）
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

## リモートアクセス設定

ローカルで動作しているCC-Anywhereをインターネット経由でアクセス可能にする方法です。

### ngrokを使用する方法

ngrokは開発環境で手軽にトンネルを作成できるツールです。

#### 1. ngrokのインストール

```bash
# macOS (Homebrew)
brew install ngrok

# Linux
curl -s https://ngrok-agent.s3.amazonaws.com/ngrok.asc | sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null && echo "deb https://ngrok-agent.s3.amazonaws.com buster main" | sudo tee /etc/apt/sources.list.d/ngrok.list && sudo apt update && sudo apt install ngrok

# または https://ngrok.com/download から直接ダウンロード
```

#### 2. ngrokアカウントの設定（初回のみ）

```bash
# https://dashboard.ngrok.com/signup でアカウント作成
# Authtokenを取得して設定
ngrok config add-authtoken YOUR_AUTH_TOKEN
```

#### 3. トンネル起動

```bash
# CC-Anywhereを起動
npm run dev

# 別ターミナルでngrokトンネルを起動
ngrok http 5000

# 表示されたURL（https://xxxxx.ngrok.io）でアクセス可能
```

#### 4. 環境変数で自動起動（オプション）

```env
# .envファイルに追加
ENABLE_NGROK=true
NGROK_AUTH_TOKEN=your_auth_token  # 設定済みの場合は不要
SHOW_QR_CODE=true                  # QRコード表示
```

### Cloudflare Tunnelを使用する方法

Cloudflare Tunnelは本番環境向けの安定したトンネルサービスです。CC-Anywhereには自動セットアップスクリプトが用意されています。

#### 簡単セットアップ（推奨）

```bash
# 自動セットアップスクリプトを実行
./scripts/setup-cloudflare-tunnel.sh

# 以下の情報を入力:
# - Cloudflare Email
# - Cloudflare API Key（Global API Key）
# - Cloudflare Account ID
# - トンネル名（任意）
# - ドメイン設定（オプション）
```

このスクリプトが自動的に:
- ✅ Cloudflareトンネルを作成
- ✅ 認証トークンを生成
- ✅ `.env`ファイルに設定を保存
- ✅ DNSレコードを設定（オプション）

#### 起動方法

```bash
# 自動セットアップ完了後、サーバーを起動するだけ
./scripts/start-clamshell.sh

# または開発環境で
npm run dev

# トンネルは自動的に起動され、URLが表示されます
```

#### 手動セットアップ（上級者向け）

手動でセットアップしたい場合は、以下の手順を実行:

1. **cloudflaredのインストール**
```bash
# macOS
brew install cloudflared

# Linux
wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared-linux-amd64.deb
```

2. **Cloudflareでトンネルを作成**
```bash
cloudflared tunnel login
cloudflared tunnel create cc-anywhere
```

3. **`.env`に設定を追加**
```env
TUNNEL_TYPE=cloudflare
CLOUDFLARE_TUNNEL_TOKEN=<生成されたトークン>
CLOUDFLARE_TUNNEL_NAME=cc-anywhere
```

4. **起動**
```bash
npm run dev  # トンネルは自動的に起動
```

### セキュリティに関する注意事項

リモートアクセスを設定する際は、必ず以下のセキュリティ対策を実施してください：

1. **API認証を有効化**
   ```env
   API_KEY=strong-random-api-key-here  # 必ず設定
   ```

2. **HTTPSの使用**
   - ngrok、Cloudflare Tunnelはどちらも自動的にHTTPS化されます

3. **アクセス制限**
   - Cloudflare Tunnelの場合、Cloudflare Access機能で追加の認証を設定可能
   - ngrokの場合、有料プランでIP制限やBasic認証を設定可能

4. **本番環境での推奨事項**
   - Cloudflare Tunnelの使用を推奨（より安定・セキュア）
   - 定期的なAPI_KEYの更新
   - アクセスログの監視

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

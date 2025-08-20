# CC-Anywhere

Claude Codeをどこからでも使えるようにするサーバーアプリケーションです。

## 特徴

CC-Anywhereは、Claude Code SDKをHTTP API経由で利用できるようにするサーバーです。ローカルのコードベースに対してAIが自動的にコード生成・編集・テスト実行などを行います。

**主な用途:**
- コードの自動生成と編集
- 依存関係の更新
- テストの作成と実行
- リファクタリング
- ドキュメント生成
- 定期的なメンテナンスタスク（スケジューラー機能）

**特徴:**
- Web UIとAPIの両方から利用可能
- リアルタイムで実行状況を確認
- 複数のリポジトリを管理
- インターネット経由でのリモートアクセス（ngrok/Cloudflare Tunnel）
- CLIからセッションを継続して作業可能

## Quick Start


```bash
# クローンして移動
git clone https://github.com/nakamura-shuta/cc-anywhere
cd cc-anywhere

# セットアップ（依存関係インストール）
npm install

# 環境変数ファイルをコピーして編集
cp .env.example .env
# .envファイルを編集してCLAUDE_API_KEYを設定

# 起動
npm run dev
```

ブラウザで http://localhost:5000 を開いて使用開始。初回起動時に作業ディレクトリを選択します。

## 主な機能

**基本機能**
- Claude Code SDK 1.0.83（最新版）をHTTP API経由で利用
- Web UIとREST APIの両方から操作可能
- WebSocketによるリアルタイムログ表示
- 複数リポジトリの管理と切り替え

**実行モード**
- default: 通常の対話的実行
- acceptEdits: 編集を自動承認
- bypassPermissions: すべての操作を自動承認
- plan: 実行計画のみ作成

**高度な機能**
- スケジューラー: Cron式による定期実行
- バッチ実行: 複数リポジトリへの一括タスク実行
- Git Worktree: 独立した作業環境での安全な実行
- セッション継続: 前回の会話コンテキストを引き継いで実行(CLIのセッションも指定可能)

## 必要な環境

- Node.js v20〜
- npm 10〜
- Claude API キー（[Anthropic Console](https://console.anthropic.com/)で取得）

## セットアップ

### 開発環境

```bash
git clone https://github.com/nakamura-shuta/cc-anywhere
cd cc-anywhere
npm install
cp .env.example .env
# .envファイルを編集してCLAUDE_API_KEYを設定
npm run dev
```

### 本番環境

```bash
# pm2をインストール（未インストールの場合）
npm install -g pm2

# ビルドして起動
./scripts/build-all.sh
./scripts/start-production.sh
```

## 環境変数の設定

`.env`ファイルで設定します（`.env.example`をコピーして編集）。

**必須:**
```env
# Anthropic APIの場合
CLAUDE_API_KEY=your-claude-api-key

# Amazon Bedrockの場合
FORCE_CLAUDE_MODE=bedrock
AWS_REGION=us-east-1
```

**よく使う設定:**
```env
API_KEY=your-secret-key     # APIアクセス制限（推奨）
PORT=5000                   # ポート番号
ENABLE_WORKTREE=true        # Git worktree使用
```

詳細は[.env.example](.env.example)を参照。

## 使い方

### Web UIで使う

1. ブラウザで http://localhost:5000 を開く
2. 作業したいリポジトリを選択
3. 指示を入力（例：「READMEを改善して」「テストを追加して」）
4. 実行ボタンをクリック

### APIで使う

```bash
curl -X POST http://localhost:5000/api/tasks \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "instruction": "依存関係を更新して",
    "repositoryName": "my-project"
  }'
```

### リポジトリ設定

初回起動時にWeb UIから設定するか、手動で設定：

```bash
cp backend/config/repositories.json.example backend/config/repositories.json
# repositories.jsonを編集
```

## リモートアクセス設定

ローカルで動作しているCC-Anywhereをインターネット経由でアクセス可能にする方法です。

### ngrok（開発環境向け）

最も簡単な方法です。一時的なURLでアクセス可能になります。

```bash
# 1. ngrokをインストール
brew install ngrok  # macOS
# または https://ngrok.com/download から直接ダウンロード

# 2. アカウント設定（初回のみ）
# https://dashboard.ngrok.com/signup でアカウント作成後
ngrok config add-authtoken YOUR_AUTH_TOKEN

# 3. .envに設定を追加
echo "ENABLE_NGROK=true" >> .env

# 4. 起動（トンネルも自動起動）
npm run dev
# URLとQRコードが表示されます
```

### Cloudflare Tunnel（本番環境向け）

安定した固定URLでアクセス可能になります。

```bash
# 自動セットアップスクリプトを実行
./scripts/setup-cloudflare-tunnel.sh

# 画面の指示に従って以下を入力:
# - Cloudflare Email
# - API Key（Cloudflareダッシュボードから取得）
# - Account ID
# - 独自ドメイン（オプション）

# セットアップ完了後、起動
npm run dev
# 固定URLが表示されます
```

詳細な手動セットアップ手順は[ドキュメント](docs/features/cloudflare-tunnel.md)を参照。

### セキュリティ

リモートアクセス時は必ず:
- `API_KEY`環境変数を設定してAPIアクセスを制限
- 本番環境ではCloudflare Tunnelを推奨
- 定期的にAPI_KEYを更新

## その他の機能

- **スケジューラー**: Cron式による定期実行
- **バッチ実行**: 複数リポジトリへの一括タスク実行
- **Git Worktree**: 安全な独立環境での実行
- **API ドキュメント**: http://localhost:5000/api/docs でOpenAPIドキュメント

## 開発者向け

```bash
# テスト
npm run test:unit
npm run test:integration

# コード品質
npm run lint
npm run type-check

# サーバー管理
./scripts/start-production.sh  # 本番起動
./scripts/stop-all.sh          # 停止
./backend/scripts/pm2-manager.sh logs  # ログ確認
```

詳細は[ドキュメント](docs/)を参照。

## ライセンス

MIT License

# インストールガイド

CC-Anywhereの詳細なインストール手順を説明します。

## システム要件

### 必須要件

- **Node.js**: 18.0以上（推奨: 20.x）
- **npm**: 8.0以上
- **Git**: 2.0以上
- **OS**: macOS, Linux, Windows (WSL2推奨)

### 推奨要件

- **メモリ**: 2GB以上
- **ディスク**: 1GB以上の空き容量
- **CPU**: 2コア以上

## インストール手順

### 1. Node.jsのインストール

#### macOS (Homebrew使用)

```bash
# nodenvのインストール（推奨）
brew install nodenv
nodenv init
echo 'eval "$(nodenv init -)"' >> ~/.zshrc
source ~/.zshrc

# Node.js 20のインストール
nodenv install 20.19.0
nodenv global 20.19.0
```

#### Ubuntu/Debian

```bash
# NodeSourceリポジトリの追加
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 2. CC-Anywhereのインストール

```bash
# リポジトリのクローン
git clone https://github.com/your-org/cc-anywhere.git
cd cc-anywhere

# 依存関係のインストール
npm install

# ビルド
npm run build
```

### 3. 必要なツールのインストール

#### PM2（プロセスマネージャー）

```bash
npm install -g pm2

# nodenv使用時はrehashが必要
nodenv rehash
```

#### Cloudflared（外部アクセス用）

```bash
# macOS
brew install cloudflare/cloudflare/cloudflared

# Linux (amd64)
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o cloudflared
chmod +x cloudflared
sudo mv cloudflared /usr/local/bin/
```

### 4. 初期設定

```bash
# 設定ファイルの作成
cp .env.example .env

# 必要に応じてリポジトリ設定を作成
mkdir -p config
echo '{"repositories":[]}' > config/repositories.json

# データディレクトリの作成
mkdir -p data logs .worktrees
```

### 5. Claude API Keyの設定

1. [Anthropic Console](https://console.anthropic.com/)にアクセス
2. API Keysセクションで新しいキーを作成
3. `.env`ファイルに設定：

```bash
# エディタで.envを開く
vim .env

# CLAUDE_API_KEYを設定
CLAUDE_API_KEY=sk-ant-api03-your-key-here
```

## 動作確認

### 開発モードで起動

```bash
npm run dev
```

以下のようなメッセージが表示されれば成功：

```
Server is running at http://0.0.0.0:5000
Health check available at http://0.0.0.0:5000/health
```

### ヘルスチェック

```bash
curl http://localhost:5000/health
```

レスポンス：
```json
{
  "status": "ok",
  "version": "0.1.0",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## トラブルシューティング

### npm installでエラーが出る

```bash
# キャッシュをクリア
npm cache clean --force

# node_modulesを削除して再インストール
rm -rf node_modules package-lock.json
npm install
```

### ビルドエラー

```bash
# TypeScriptのバージョン確認
npx tsc --version

# 型定義の再インストール
npm install --save-dev @types/node
```

### 権限エラー

```bash
# npmのグローバルディレクトリの権限を修正
sudo chown -R $(whoami) $(npm config get prefix)/{lib/node_modules,bin,share}
```

## アップグレード

```bash
# 最新版の取得
git pull origin main

# 依存関係の更新
npm install

# 再ビルド
npm run build

# PM2使用時は再起動
pm2 restart cc-anywhere
```

## アンインストール

```bash
# PM2からの削除
pm2 delete cc-anywhere
pm2 save

# ディレクトリの削除
cd ..
rm -rf cc-anywhere
```

## 次のステップ

- [クイックスタート](./quickstart.md) - 基本的な使い方
- [設定ガイド](./configuration.md) - 詳細な設定オプション
- [PM2運用ガイド](../operations/pm2-setup.md) - 本番環境での運用
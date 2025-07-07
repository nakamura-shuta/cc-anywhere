# クイックスタートガイド

CC-Anywhereを5分で始めるためのガイドです。

## 前提条件

- Node.js 18以上
- npm または yarn
- Claude API Key（[取得方法](https://console.anthropic.com/)）

## 1. インストール

```bash
# リポジトリのクローン
git clone https://github.com/your-org/cc-anywhere.git
cd cc-anywhere

# 依存関係のインストール
npm install
```

## 2. 環境設定

```bash
# 環境設定ファイルのコピー
cp .env.example .env
```

`.env`ファイルを編集して、必須項目を設定：

```env
# Claude API設定（必須）
CLAUDE_API_KEY=sk-ant-api03-...

# API認証（推奨）
API_KEY=your-secret-api-key

# ポート設定（デフォルト: 5000）
PORT=5000
```

## 3. 起動

### 開発環境

```bash
npm run dev
```

### 本番環境（PM2使用）

```bash
# 簡単セットアップ
./scripts/quick-start.sh

# または手動で
npm install -g pm2
npm run build
pm2 start ecosystem.config.js
```

## 4. 動作確認

### Web UI

ブラウザで `http://localhost:5000` にアクセス

### API経由

```bash
# タスクの作成
curl -X POST http://localhost:5000/api/tasks \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-secret-api-key" \
  -d '{
    "instruction": "Hello Worldと出力してください",
    "context": {
      "workingDirectory": "."
    }
  }'

# レスポンス例
{
  "taskId": "task-123abc",
  "status": "running",
  "createdAt": "2024-01-01T00:00:00Z"
}
```

### タスクの状態確認

```bash
# タスクの詳細取得
curl -H "X-API-Key: your-secret-api-key" \
  http://localhost:5000/api/tasks/task-123abc
```

## 5. 外部アクセス（オプション）

Cloudflare Tunnelを使用して外部からアクセス可能にする：

```bash
# cloudflaredのインストール（macOS）
brew install cloudflare/cloudflare/cloudflared

# .envに設定を追加
echo "TUNNEL_TYPE=cloudflare" >> .env
echo "SHOW_QR_CODE=true" >> .env

# 再起動
npm run dev
```

## 次のステップ

- [詳細な設定ガイド](./configuration.md)
- [APIリファレンス](../api/api-reference.md)
- [主要機能の紹介](../features/)

## トラブルシューティング

### ポートが使用中の場合

```bash
# 使用中のポートを確認
lsof -i :5000

# .envでポートを変更
PORT=5001
```

### PM2でログが見たい場合

```bash
# リアルタイムログ
pm2 logs cc-anywhere

# 詳細な状態確認
pm2 monit
```
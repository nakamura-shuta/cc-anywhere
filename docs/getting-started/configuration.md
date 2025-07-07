# 設定ガイド

CC-Anywhereの詳細な設定オプションについて説明します。

## 環境変数

すべての設定は`.env`ファイルで管理されます。

### 必須設定

```env
# Claude API Key（必須）
CLAUDE_API_KEY=sk-ant-api03-...
```

### サーバー設定

```env
# ポート番号（デフォルト: 5000）
PORT=5000

# ホスト（デフォルト: 0.0.0.0）
HOST=0.0.0.0

# 環境（development/production）
NODE_ENV=production

# ログレベル（error/warn/info/debug）
LOG_LEVEL=info
```

### セキュリティ

```env
# API認証キー（強く推奨）
API_KEY=your-secure-api-key

# CORS設定（カンマ区切り）
CORS_ORIGIN=http://localhost:3000,https://example.com
```

### タスク実行

```env
# タスクタイムアウト（ミリ秒、デフォルト: 600000 = 10分）
TASK_TIMEOUT_MS=600000

# 最大同時実行タスク数
MAX_CONCURRENT_TASKS=10

# Claude Code SDK使用（常にtrue推奨）
USE_CLAUDE_CODE_SDK=true
```

### Git Worktree機能

```env
# Worktree機能の有効化
ENABLE_WORKTREE=true

# Worktreeのベースディレクトリ
WORKTREE_BASE_PATH=.worktrees

# 最大Worktree数
MAX_WORKTREES=5

# 自動クリーンアップ
WORKTREE_AUTO_CLEANUP=true

# クリーンアップ遅延（ミリ秒）
WORKTREE_CLEANUP_DELAY=300000

# Worktree名のプレフィックス
WORKTREE_PREFIX=cc-anywhere
```

### 外部アクセス

```env
# トンネルタイプ（none/ngrok/cloudflare）
TUNNEL_TYPE=cloudflare

# Cloudflare Tunnelトークン（永続トンネル用）
CLOUDFLARE_TUNNEL_TOKEN=

# QRコード表示
SHOW_QR_CODE=true
```

### データベース

```env
# SQLiteデータベースパス
DB_PATH=./data/cc-anywhere.db
```

### ワーカー設定

```env
# キュー同時実行数
QUEUE_CONCURRENCY=2

# ワーカーモード（inline/standalone/managed）
WORKER_MODE=inline

# ワーカー数
WORKER_COUNT=1
```

### WebSocket

```env
# WebSocket有効化
WEBSOCKET_ENABLED=true

# ハートビート間隔（ミリ秒）
WEBSOCKET_HEARTBEAT_INTERVAL=30000

# ハートビートタイムアウト（ミリ秒）
WEBSOCKET_HEARTBEAT_TIMEOUT=60000

# 認証タイムアウト（ミリ秒）
WEBSOCKET_AUTH_TIMEOUT=10000
```

## 設定例

### 開発環境（.env.development）

```env
NODE_ENV=development
PORT=5000
LOG_LEVEL=debug
CLAUDE_API_KEY=sk-ant-api03-...
API_KEY=dev-api-key
TUNNEL_TYPE=none
```

### 本番環境（.env.production）

```env
NODE_ENV=production
PORT=5000
LOG_LEVEL=info
CLAUDE_API_KEY=sk-ant-api03-...
API_KEY=secure-production-key
TUNNEL_TYPE=cloudflare
CLOUDFLARE_TUNNEL_TOKEN=your-tunnel-token
ENABLE_WORKTREE=true
MAX_CONCURRENT_TASKS=20
```

## PM2設定

`ecosystem.config.js`でPM2の詳細設定が可能：

```javascript
module.exports = {
  apps: [{
    name: 'cc-anywhere',
    script: './dist/index.js',
    instances: 1,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production'
    },
    // その他の設定...
  }]
}
```

## リポジトリ設定

`config/repositories.json`でリポジトリを設定：

```json
{
  "repositories": [
    {
      "name": "my-project",
      "path": "/path/to/my-project"
    }
  ]
}
```

## 設定の優先順位

1. 環境変数
2. `.env`ファイル
3. デフォルト値

## トラブルシューティング

### 設定が反映されない

```bash
# PM2の場合は再起動が必要
pm2 restart cc-anywhere

# または
pm2 reload ecosystem.config.js
```

### 環境変数の確認

```bash
# 現在の設定を確認
npm run dev
# 起動時にログに設定情報が表示される
```
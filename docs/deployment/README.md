# デプロイメントガイド

CC-Anywhereの本番環境へのデプロイと運用について説明します。

## 🚀 デプロイ方法

### 統合ビルド

フロントエンドとバックエンドを一度にビルド:

```bash
./scripts/build-all.sh
```

このスクリプトは以下を実行:
1. フロントエンドのビルド（静的ファイル生成）
2. バックエンドのビルド（TypeScriptコンパイル）
3. フロントエンドを`backend/web`に統合

### ディレクトリ構造

ビルド後の構造:
```
backend/
├── dist/           # バックエンドのビルド成果物
│   └── index.js    # エントリーポイント
└── web/            # フロントエンドのビルド成果物
    └── index.html  # SPAエントリーポイント
```

## 🏭 本番環境

### PM2による起動

```bash
# 簡単な方法
./scripts/start-production.sh

# 手動で起動
cd backend
pm2 start ecosystem.config.js --env production
```

### PM2管理コマンド

```bash
# ステータス確認
pm2 status

# ログ確認
pm2 logs cc-anywhere-backend

# 再起動
pm2 restart cc-anywhere-backend

# リロード（ゼロダウンタイム）
pm2 reload cc-anywhere-backend

# 停止
pm2 stop cc-anywhere-backend
```

### 自動起動設定

システム起動時に自動的に開始:

```bash
pm2 save
pm2 startup
# 表示されたコマンドを実行
```

## 🖥 クラムシェルモード

MacBookを閉じてもサーバーが動作し続けるモード。

### 簡単な起動方法

```bash
./scripts/start-clamshell.sh
```

このスクリプトは以下を実行:
- ビルドの確認と実行
- PM2でアプリケーションを起動
- スリープ防止（caffeinate）を有効化
- 自動起動の設定

### スリープ防止の仕組み

起動スクリプトは自動的に `caffeinate` コマンドを実行:
```bash
caffeinate -disu &
```

オプションの意味:
- `-d`: ディスプレイスリープを防ぐ
- `-i`: システムアイドルスリープを防ぐ
- `-s`: システムスリープを防ぐ
- `-u`: ユーザーがアクティブであるかのように振る舞う

### 管理コマンド

専用の管理スクリプトを使用:
```bash
# ヘルプを表示
./scripts/pm2-manager.sh

# ステータス確認
./scripts/pm2-manager.sh status

# ログ表示
./scripts/pm2-manager.sh logs

# 再起動
./scripts/pm2-manager.sh restart

# 停止
./scripts/pm2-manager.sh stop
```

### 動作確認

1. **プロセスの確認**
   ```bash
   # PM2プロセス
   pm2 status cc-anywhere
   
   # caffeinateプロセス
   ps aux | grep caffeinate
   ```

2. **動作テスト**
   - MacBookを閉じる
   - 外部からアクセス（ngrok URL経由など）
   - 正常にレスポンスが返ることを確認

## 🌐 外部アクセス設定

### ngrok（簡単）

```env
TUNNEL_TYPE=ngrok
ENABLE_NGROK=true
SHOW_QR_CODE=true
```

### Cloudflare Tunnel（高度）

```bash
# トンネル作成
cloudflared tunnel create cc-anywhere

# .env設定
TUNNEL_TYPE=cloudflare
CLOUDFLARE_TUNNEL_TOKEN=your-token
```

## 🔒 セキュリティ

### QR認証

```env
QR_AUTH_ENABLED=true
QR_AUTH_TOKEN=your-secret-token
```

### APIキー認証

```env
API_KEY=your-api-key
```

### リバースプロキシ（Nginx）

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 📊 パフォーマンスチューニング

### PM2クラスターモード

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    instances: 'max',        // CPUコア数分起動
    exec_mode: 'cluster',
    max_memory_restart: '2G'
  }]
};
```

### 環境変数

```env
# 同時実行数
MAX_CONCURRENT_TASKS=10
QUEUE_CONCURRENCY=5

# ログレベル
LOG_LEVEL=warn  # 本番環境では最小限に

# タイムアウト
TASK_TIMEOUT_MS=600000  # 10分
```

## 📦 デプロイチェックリスト

- [ ] `.env`ファイルの設定確認
- [ ] ビルド完了（`./scripts/build-all.sh`）
- [ ] PM2の起動確認
- [ ] ヘルスチェック（`curl http://localhost:5000/health`）
- [ ] ログ確認（`pm2 logs`）
- [ ] 外部アクセス確認（該当する場合）
- [ ] バックアップ設定

## 🔄 更新手順

```bash
# 1. 最新コードを取得
git pull origin main

# 2. 依存関係を更新
npm install

# 3. ビルド
./scripts/build-all.sh

# 4. PM2でリロード（ゼロダウンタイム）
pm2 reload cc-anywhere-backend
```

## 🛠 メンテナンス

### ログローテーション

```bash
# PM2ログローテーション設定
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 100M
pm2 set pm2-logrotate:retain 7
```

### データベースクリーンアップ

```bash
# 7日以前のタスクを削除
sqlite3 backend/data/cc-anywhere.db \
  "DELETE FROM tasks WHERE created_at < datetime('now', '-7 days');"
```

### ディスク容量確認

```bash
# 使用量確認
df -h
du -sh backend/data/ backend/logs/ backend/.worktrees/

# クリーンアップ
pm2 flush  # ログクリア
git worktree prune  # 不要なworktree削除
```
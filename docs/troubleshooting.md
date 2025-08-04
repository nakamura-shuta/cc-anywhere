# トラブルシューティング

CC-Anywhereの一般的な問題と解決方法です。

## 🚨 起動時の問題

### ポートが使用中

```bash
# エラー: Error: listen EADDRINUSE :::5000

# 解決方法
lsof -i :5000           # 使用中のプロセスを確認
kill -9 <PID>           # プロセスを終了
# または
PORT=5001 npm run dev   # 別のポートを使用
```

### PM2が見つからない

```bash
# グローバルインストール
npm install -g pm2

# nodenv使用時
nodenv rehash
```

### ビルドエラー

```bash
# クリーンインストール
rm -rf node_modules package-lock.json
npm install

# dist/index.jsが見つからない
./scripts/build-all.sh
```

## 🔐 認証エラー

### Claude APIエラー

```bash
# 401 Unauthorized
# .envファイルを確認
CLAUDE_API_KEY=sk-ant-api03-...  # 正しい形式か確認

# 再起動
pm2 restart cc-anywhere-backend
```

### 認証エラー

```bash
# アクセスできない場合
# .envファイルを確認
API_KEY=hello
QR_AUTH_ENABLED=true  # QRコード表示（オプション）

# URLに?api_key=helloを付ける
```

## 🌐 接続の問題

### WebSocketが接続できない

```bash
# .envで有効化を確認
WEBSOCKET_ENABLED=true

# ブラウザコンソールでエラー確認
# ハートビートを送信しているか確認（30秒ごと）
```

### 外部アクセスできない

```bash
# ngrokが起動しない
which ngrok  # インストール確認
brew install ngrok  # macOS

# Cloudflare Tunnelが動かない
cloudflared tunnel list  # トンネル確認
```

## 💾 データベース・ストレージ

### ディスク容量不足

```bash
# 容量確認
df -h
du -sh backend/data/ backend/logs/ backend/.worktrees/

# クリーンアップ
pm2 flush  # ログクリア
git worktree prune  # worktree削除
```

### データベースエラー

```bash
# 古いタスクを削除
sqlite3 backend/data/cc-anywhere.db \
  "DELETE FROM tasks WHERE created_at < datetime('now', '-7 days');"
```

## 🎯 タスク実行の問題

### タスクタイムアウト

```env
# .envでタイムアウトを延長
TASK_TIMEOUT_MS=1800000  # 30分

# または個別タスクで指定
{
  "options": { "timeout": 1800000 }
}
```

### メモリ不足

```javascript
// ecosystem.config.js
max_memory_restart: '2G',
node_args: '--max-old-space-size=2048'

// 再起動
pm2 reload ecosystem.config.js
```

### キューが詰まる

```bash
# キュー状態確認
curl http://localhost:5000/api/queue/stats

# 同時実行数を増やす
curl -X PUT http://localhost:5000/api/queue/concurrency \
  -d '{"concurrency": 5}'
```

## 🔧 開発環境の問題

### フロントエンドのビルドエラー

```bash
cd frontend
rm -rf .svelte-kit build node_modules
npm install
npm run build
```

### 型エラー

```bash
# バックエンド
cd backend && npm run type-check

# フロントエンド
cd frontend && npm run check
```

### APIが404エラー

```bash
# フロントエンドが別ポートで動いている場合
# 開発: frontend:4444, backend:5000
# 本番: 統合されて5000のみ

# 統合ビルドを確認
./scripts/build-all.sh
```

## 📊 パフォーマンス

### 実行が遅い

```env
# 同時実行数を調整
MAX_CONCURRENT_TASKS=5
QUEUE_CONCURRENCY=2

# ログレベルを下げる
LOG_LEVEL=warn
```

### ログローテーション

```bash
# PM2ログローテーション設定
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 100M
pm2 set pm2-logrotate:retain 7
```

## 🆘 デバッグ方法

### ログ確認

```bash
# PM2ログ
pm2 logs cc-anywhere-backend --lines 100

# エラーログのみ
pm2 logs cc-anywhere-backend --err

# アプリケーションログ
tail -f backend/logs/*.log
```

### 詳細デバッグ

```env
# .envでデバッグモード
LOG_LEVEL=debug
NODE_ENV=development
```

### ヘルスチェック

```bash
# API確認
curl http://localhost:5000/health

# PM2状態
pm2 status

# システムリソース
pm2 monit
```

## ❓ よくある質問

**Q: APIキーを忘れた**
```bash
grep API_KEY .env
```

**Q: どのポートで動いているか分からない**
```bash
lsof -i :5000
pm2 status
```

**Q: 更新が反映されない**
```bash
# フルリビルド
./scripts/build-all.sh
pm2 restart cc-anywhere-backend
```

それでも解決しない場合は、GitHubのIssuesで報告してください。
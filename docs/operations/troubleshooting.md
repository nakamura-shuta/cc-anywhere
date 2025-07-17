# トラブルシューティングガイド

CC-Anywhereの一般的な問題と解決方法を説明します。

## 起動時の問題

### ポートが使用中

**症状**: `Error: listen EADDRINUSE: address already in use :::5000`

**解決方法**:

```bash
# 使用中のプロセスを確認
lsof -i :5000

# プロセスを終了
kill -9 <PID>

# または別のポートを使用
PORT=5001 npm run dev
```

### PM2が見つからない

**症状**: `pm2: command not found`

**解決方法**:

```bash
# グローバルインストール
npm install -g pm2

# nodenv使用時
nodenv rehash

# それでも見つからない場合
export PATH="$HOME/.nodenv/versions/$(nodenv version-name)/bin:$PATH"
```

### ビルドエラー

**症状**: `tsc: command not found` または型エラー

**解決方法**:

```bash
# クリーンインストール
rm -rf node_modules package-lock.json
npm install

# 明示的にビルド
npx tsc
```

## 実行時の問題

### Claude APIエラー

**症状**: `401 Unauthorized` または `Invalid API Key`

**解決方法**:

1. APIキーを確認:
   ```bash
   grep CLAUDE_API_KEY .env
   ```

2. APIキーの形式を確認（`sk-ant-api03-`で始まる）

3. 環境変数を再読み込み:
   ```bash
   pm2 restart cc-anywhere
   ```

### タスクタイムアウト

**症状**: タスクが10分で強制終了される

**解決方法**:

```env
# .envでタイムアウトを延長
TASK_TIMEOUT_MS=1800000  # 30分
```

または個別のタスクで指定：

```json
{
  "instruction": "長時間タスク",
  "options": {
    "timeout": 1800000
  }
}
```

### メモリ不足

**症状**: `JavaScript heap out of memory`

**解決方法**:

1. PM2の設定を調整:
   ```javascript
   // ecosystem.config.js
   max_memory_restart: '2G',
   node_args: '--max-old-space-size=2048'
   ```

2. 再起動:
   ```bash
   pm2 reload ecosystem.config.js
   ```

## 接続の問題

### WebSocketが接続できない

**症状**: リアルタイムログが表示されない

**解決方法**:

1. WebSocketが有効か確認:
   ```env
   WEBSOCKET_ENABLED=true
   ```

2. ファイアウォール/プロキシ設定を確認

3. ブラウザのコンソールでエラーを確認

### WebSocketハートビートエラー

**症状**: 
- 「WebSocket connection timeout」エラー
- 接続が30-60秒後に切断される
- 「heartbeat timeout」ログ

**解決方法**:

1. クライアント側でハートビートを実装しているか確認:
   ```javascript
   // 30秒ごとにpingを送信する必要があります
   setInterval(() => {
     ws.send(JSON.stringify({
       type: 'ping',
       payload: { timestamp: Date.now() }
     }));
   }, 30000);
   ```

2. ネットワークの遅延を確認:
   ```bash
   # サーバーへのping確認
   ping -c 10 your-server.com
   ```

3. WebSocketの設定を確認:
   ```env
   WEBSOCKET_HEARTBEAT_INTERVAL=30000  # 30秒
   WEBSOCKET_HEARTBEAT_TIMEOUT=60000   # 60秒
   ```

**注意**: クライアントは必ず30秒ごとにpingメッセージを送信する必要があります。これは接続維持のための必須機能です。

### Cloudflare Tunnelが起動しない

**症状**: URLが表示されない

**解決方法**:

```bash
# cloudflaredの確認
which cloudflared

# インストール
brew install cloudflare/cloudflare/cloudflared

# 手動テスト
cloudflared tunnel --url http://localhost:5000
```

## Git Worktree問題

### Worktreeが作成できない

**症状**: `fatal: not a git repository`

**解決方法**:

```bash
# Gitリポジトリか確認
git status

# リポジトリでない場合は初期化
git init
git add .
git commit -m "Initial commit"
```

### Worktreeが削除されない

**症状**: `.worktrees`ディレクトリが肥大化

**解決方法**:

```bash
# 手動クリーンアップ
git worktree prune
rm -rf .worktrees/cc-anywhere-*

# 自動クリーンアップを有効化
echo "WORKTREE_AUTO_CLEANUP=true" >> .env
```

## パフォーマンス問題

### タスクの実行が遅い

**対策**:

1. 同時実行数を調整:
   ```env
   MAX_CONCURRENT_TASKS=5
   QUEUE_CONCURRENCY=2
   ```

2. ワーカー数を増やす:
   ```env
   WORKER_COUNT=4
   ```

3. 不要なログを無効化:
   ```env
   LOG_LEVEL=warn
   ```

### ディスク容量不足

**確認方法**:

```bash
# 全体の使用量
df -h

# CC-Anywhere関連
du -sh data/ logs/ .worktrees/
```

**対策**:

```bash
# ログのクリア
pm2 flush cc-anywhere

# 古いデータベースレコードの削除
sqlite3 data/cc-anywhere.db "DELETE FROM tasks WHERE created_at < datetime('now', '-7 days');"

# Worktreeのクリーンアップ
git worktree prune
```

## デバッグ方法

### ログの確認

```bash
# PM2ログ
pm2 logs cc-anywhere --lines 100

# エラーログのみ
pm2 logs cc-anywhere --err

# 特定のキーワードで検索
pm2 logs cc-anywhere | grep -i error
```

### 詳細なデバッグ

```env
# .envでデバッグモード
LOG_LEVEL=debug
NODE_ENV=development
```

### ヘルスチェック

```bash
# APIヘルスチェック
curl http://localhost:5000/health

# PM2ステータス
pm2 status

# システムリソース
pm2 monit
```

## よくある質問

### Q: タスクがキューに溜まる

A: ワーカー設定を確認：

```bash
# キューの状態を確認
curl http://localhost:5000/api/queue/status

# 同時実行数を増やす
curl -X PUT http://localhost:5000/api/queue/concurrency \
  -H "Content-Type: application/json" \
  -d '{"concurrency": 5}'
```

### Q: APIキーを忘れた

A: `.env`ファイルを確認：

```bash
grep API_KEY .env
```

### Q: ログファイルが大きすぎる

A: PM2のログローテーション設定：

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 100M
pm2 set pm2-logrotate:retain 7
```

## サポート

問題が解決しない場合：

1. [GitHub Issues](https://github.com/your-org/cc-anywhere/issues)で報告
2. ログを添付（機密情報は除外）
3. 環境情報を含める（OS、Node.jsバージョンなど）
# CC-Anywhere トラブルシューティングガイド

## 本番環境で `/tasks` ページがエラーになる

### 症状
- 開発環境（`./scripts/start-dev.sh`）では正常に動作
- 本番環境（`./scripts/start-production.sh`）で `/tasks` にアクセスすると500エラー
- エラーメッセージ: `"タスクの読み込みに失敗しました"`

### 原因
1. SvelteKitのSPAモードでのクライアントサイドルーティングの問題
2. 環境変数の不一致
3. ビルド時の設定問題

### 解決方法

#### 1. クリーンビルドを実行
```bash
# すべてのプロセスを停止
./scripts/stop-all.sh

# キャッシュとビルドを削除
rm -rf frontend/build backend/web backend/dist
rm -rf frontend/.svelte-kit backend/.tsbuildinfo

# 統合ビルドを実行
./scripts/build-all.sh
```

#### 2. 環境変数の確認
```bash
# .envファイルを確認
cat .env

# 以下が設定されているか確認:
# - CLAUDE_API_KEY
# - PORT=5000
# - CORS_ORIGIN=*
```

#### 3. PM2のログを確認
```bash
# PM2を起動
./scripts/start-production.sh

# 別ターミナルでログを確認
pm2 logs cc-anywhere-backend --lines 100
```

#### 4. ブラウザのコンソールを確認
1. Chrome/Firefoxの開発者ツールを開く（F12）
2. Consoleタブでエラーを確認
3. Networkタブで失敗したリクエストを確認

### 一時的な回避策

開発環境を使用する:
```bash
./scripts/start-dev.sh
```

これにより:
- バックエンド: http://localhost:5000
- フロントエンド: http://localhost:4444（こちらを使用）

### よくある問題と解決策

#### API接続エラー
```
Failed to load tasks: NetworkError
```

解決:
1. バックエンドが起動しているか確認: `pm2 status`
2. CORS設定を確認: `CORS_ORIGIN=*` in `.env`
3. API URLを確認: フロントエンドが正しいポートを使用しているか

#### ビルドエラー
```
Error: Cannot find module './dist/index.js'
```

解決:
```bash
cd backend
npm run build
```

#### ポート競合
```
Error: listen EADDRINUSE :::5000
```

解決:
```bash
# 使用中のプロセスを確認
lsof -i :5000

# プロセスを停止
./scripts/stop-all.sh
```

## デバッグモード

詳細なログを有効にする:

1. `.env`を編集:
   ```
   LOG_LEVEL=debug
   NODE_ENV=development
   ```

2. PM2を再起動:
   ```bash
   pm2 restart cc-anywhere-backend
   ```

## サポート

問題が解決しない場合:
1. GitHubのIssuesに報告
2. ログファイルを添付:
   - `backend/logs/pm2-error.log`
   - `backend/logs/pm2-out.log`
   - ブラウザのコンソールログ
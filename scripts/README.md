# CC-Anywhere スクリプト集

このディレクトリには、CC-Anywhereのビルド、デプロイ、起動を簡単にするためのスクリプトが含まれています。

## スクリプト一覧

| スクリプト | 用途 | 説明 |
|------------|------|------|
| `build-all.sh` | ビルド | フロントエンド・バックエンドの統合ビルド |
| `start-dev.sh` | 開発 | 開発サーバーの起動（ホットリロード付き） |
| `start-production.sh` | 本番 | PM2を使用した本番サーバーの起動 |
| `stop-all.sh` | 停止 | 全てのサーバープロセスを停止 |

## 統合スクリプト

### `build-all.sh`
フロントエンドとバックエンドを統合ビルドし、本番環境用のアプリケーションを準備します。

```bash
./scripts/build-all.sh
```

**実行内容:**
1. 依存関係のインストール確認
2. フロントエンドのビルド（SvelteKit → `frontend/build`）
3. バックエンドのビルド（TypeScript → `backend/dist`）
4. フロントエンドを`backend/web`ディレクトリに統合
5. PM2 ecosystem設定ファイルの確認

**使用タイミング:**
- 本番環境へのデプロイ前
- クリーンビルドが必要な時
- 初回セットアップ時

### `start-production.sh`
PM2を使用して本番環境でサーバーを起動します。

```bash
./scripts/start-production.sh
```

**特徴:**
- PM2プロセスマネージャーで管理
- 自動再起動設定（クラッシュ時）
- システム起動時の自動起動設定
- プロダクション最適化
- ログローテーション対応

**事前準備:**
1. `pnpm run build`または`./scripts/build-all.sh`でビルド済みであること
2. `.env`ファイルに必要な環境変数が設定されていること
3. PM2がインストールされていること（`pnpm install -g pm2`）

### `start-dev.sh`
開発環境でフロントエンドとバックエンドを同時起動します。

```bash
./scripts/start-dev.sh
```

**特徴:**
- ホットリロード有効（ファイル変更を自動検知）
- tmuxがある場合は複数ウィンドウで起動
- デバッグモード有効
- フロントエンド: http://localhost:4444
- バックエンド: http://localhost:5000

**tmux使用時のキー操作:**
- `Ctrl+B, 0-2`: ウィンドウ切り替え
- `Ctrl+B, d`: デタッチ（バックグラウンド実行）
- `tmux attach -t cc-anywhere-dev`: 再アタッチ

### `stop-all.sh`
すべてのCC-Anywhereプロセスを確実に停止します。

```bash
./scripts/stop-all.sh
```

**停止対象:**
- PM2で管理されているプロセス
- ポート5000を使用しているプロセス
- 開発サーバー（concurrently、vite、tsx）
- tmuxセッション
- caffeinate（スリープ防止）
- その他のcc-anywhere関連プロセス

**実行後の確認:**
- 停止したプロセス数を表示
- ポート5000の解放状態を確認
- 残存プロセスがある場合は警告表示

## フロントエンドとバックエンドの分離デプロイ

フロントエンドとバックエンドを別々のプロセスやサーバーでホストする場合：

### 1. バックエンドのみ起動
```bash
cd backend
pm2 start ecosystem.config.js --env production
```

### 2. フロントエンドの静的ホスティング
```bash
cd frontend
pnpm run build
pnpm dlx serve build -p 4444 -s
```

### 3. Nginxリバースプロキシ設定例
```nginx
server {
    listen 80;
    server_name your-domain.com;

    # フロントエンド
    location / {
        proxy_pass http://localhost:4444;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # API
    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket
    location /ws {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

## バックエンドスクリプト

バックエンド固有のスクリプトは`backend/scripts/`にあります:

- `build-frontend.sh` - フロントエンドをビルドしてバックエンドに統合
- `start-clamshell.sh` - クラムシェルモード起動（MacBook用、スリープ防止付き）
- `pm2-manager.sh` - PM2管理コマンド（start/stop/restart/logs等）
- `tunnel-manager.sh` - トンネル（ngrok/Cloudflare）管理
- `stop-all.sh` - 全サーバープロセスの停止（backend/scripts/内にも配置）
- `quick-start.sh` - クイックスタート用スクリプト

## 使用例

### 初回セットアップ

```bash
# 1. 環境設定
# .envファイルを作成（必要な環境変数は README.md 参照）
cat > .env << EOF
CLAUDE_API_KEY=your-api-key-here
PORT=5000
API_KEY=your-cc-anywhere-api-key
EOF

# 2. 依存関係のインストール
pnpm install

# 3. ビルド
./scripts/build-all.sh

# 4. 起動
./scripts/start-production.sh
```

### 開発時

```bash
# 開発環境で起動
./scripts/start-dev.sh

# 別ターミナルで
# - バックエンド: http://localhost:5000
# - フロントエンド: http://localhost:4444
```

### デプロイ時

```bash
# 1. 最新コードを取得
git pull

# 2. クリーンビルド
./scripts/stop-all.sh
./scripts/build-all.sh

# 3. 本番起動
./scripts/start-production.sh
```

### トラブルシューティング

```bash
# すべて停止
./scripts/stop-all.sh

# ポート確認
lsof -i :5000

# ログ確認
pm2 logs cc-anywhere-backend

# PM2状態確認
pm2 status
```

## 権限設定

スクリプトに実行権限がない場合:

```bash
chmod +x scripts/*.sh
chmod +x backend/scripts/*.sh
```

## 注意事項

- PM2がインストールされていない場合は`pnpm install -g pm2`でインストール
- tmuxがあるとより便利に開発できます（`brew install tmux`でインストール可能）
- 本番環境では必ず`.env`ファイルを適切に設定してください
- ポート5000が既に使用されている場合は、`stop-all.sh`を実行してから起動してください
- 初回起動時は必ず`pnpm install`で依存関係をインストールしてください

## よくある問題と解決方法

### ポート5000が使用中
```bash
./scripts/stop-all.sh
# または
lsof -i :5000  # プロセスを確認
kill -9 <PID>  # プロセスを強制終了
```

### PM2が見つからない
```bash
pnpm install -g pm2
```

### ビルドエラー
```bash
# クリーンビルド
rm -rf backend/dist backend/web frontend/build
pnpm install
./scripts/build-all.sh
```
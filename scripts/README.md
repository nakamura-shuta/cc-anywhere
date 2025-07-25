# CC-Anywhere スクリプト集

このディレクトリには、CC-Anywhereのビルド、デプロイ、起動を簡単にするためのスクリプトが含まれています。

## 統合スクリプト

### `build-all.sh`
フロントエンドとバックエンドを統合ビルドします。

```bash
./scripts/build-all.sh
```

実行内容:
1. フロントエンドのビルド（`frontend/build`）
2. バックエンドのビルド（`backend/dist`）
3. フロントエンドをバックエンドの`web`ディレクトリに統合

### `start-production.sh`
PM2を使用して本番環境でサーバーを起動します。

```bash
./scripts/start-production.sh
```

特徴:
- PM2プロセスマネージャーで管理
- 自動再起動設定
- プロダクション最適化

### `start-dev.sh`
開発環境でフロントエンドとバックエンドを同時起動します。

```bash
./scripts/start-dev.sh
```

特徴:
- ホットリロード有効
- tmuxがある場合は複数ウィンドウで起動
- デバッグモード

### `stop-all.sh`
すべてのCC-Anywhereプロセスを停止します。

```bash
./scripts/stop-all.sh
```

停止対象:
- PM2プロセス
- 開発サーバー
- tmuxセッション
- caffeinate（スリープ防止）

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
npm run build
npx serve build -p 4444 -s
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
- `start-clamshell.sh` - クラムシェルモード起動（MacBook用）
- `pm2-manager.sh` - PM2管理コマンド
- `tunnel-manager.sh` - トンネル（ngrok/Cloudflare）管理

## 使用例

### 初回セットアップ

```bash
# 1. 環境設定
cd backend
cp .env.example .env
# .envを編集してCLAUDE_API_KEYを設定

# 2. ビルド
./scripts/build-all.sh

# 3. 起動
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

- PM2がインストールされていない場合は`npm install -g pm2`でインストール
- tmuxがあるとより便利に開発できます
- 本番環境では必ず`.env`ファイルを適切に設定してください
# CC-Anywhere デプロイメントガイド

このドキュメントでは、CC-Anywhereのビルド、デプロイ、起動方法について説明します。

## 目次

1. [前提条件](#前提条件)
2. [クイックスタート](#クイックスタート)
3. [ビルド方法](#ビルド方法)
4. [デプロイ方法](#デプロイ方法)
5. [起動方法](#起動方法)
6. [停止方法](#停止方法)
7. [トラブルシューティング](#トラブルシューティング)

## 前提条件

### 必要なソフトウェア

- **Node.js**: v18.0.0以上
- **npm**: v8.0.0以上
- **PM2**: グローバルインストール推奨
  ```bash
  npm install -g pm2
  ```

### 環境設定

1. バックエンドの環境変数を設定:
   ```bash
   cd backend
   cp .env.example .env
   # .envファイルを編集してCLAUDE_API_KEYを設定
   ```

## クイックスタート

最も簡単な起動方法:

```bash
# 1. 統合ビルド
./scripts/build-all.sh

# 2. 本番環境で起動
./scripts/start-production.sh
```

## ビルド方法

### 統合ビルド（推奨）

フロントエンドとバックエンドを一度にビルド:

```bash
./scripts/build-all.sh
```

このスクリプトは以下を実行します:
1. フロントエンドのビルド（静的ファイル生成）
2. バックエンドのビルド（TypeScriptコンパイル）
3. フロントエンドをバックエンドの`web`ディレクトリに統合

### 個別ビルド

#### フロントエンドのみ:
```bash
cd frontend
npm run build
```

#### バックエンドのみ:
```bash
cd backend
npm run build
```

#### フロントエンドをバックエンドに統合:
```bash
./backend/scripts/build-frontend.sh
```

## デプロイ方法

### ローカルデプロイ

ビルド後、以下のファイル構造になっていることを確認:

```
backend/
├── dist/           # バックエンドのビルド成果物
│   └── index.js    # エントリーポイント
└── web/            # フロントエンドのビルド成果物
    └── index.html  # SPAエントリーポイント
```

### 本番サーバーへのデプロイ

1. 必要なファイルをサーバーにアップロード:
   ```bash
   backend/
   ├── dist/
   ├── web/
   ├── package.json
   ├── package-lock.json
   ├── ecosystem.config.js
   └── .env
   ```

2. サーバーで依存関係をインストール:
   ```bash
   cd backend
   npm ci --production
   ```

3. PM2で起動:
   ```bash
   pm2 start ecosystem.config.js --env production
   ```

## 起動方法

### 本番環境

PM2を使用した本番環境での起動:

```bash
./scripts/start-production.sh
```

または手動で:

```bash
cd backend
pm2 start ecosystem.config.js --env production
```

### 開発環境

フロントエンドとバックエンドを別々に起動（ホットリロード有効）:

```bash
./scripts/start-dev.sh
```

tmuxがインストールされている場合は、自動的に複数のウィンドウで起動されます。

### クラムシェルモード

MacBookを閉じてもサーバーが動作し続けるモード:

```bash
./backend/scripts/start-clamshell.sh
```

外部アクセス方法を選択できます:
- ngrok（簡単・デフォルト）
- Cloudflare Tunnel（高度）
- なし（ローカルのみ）

## 停止方法

### すべてのプロセスを停止

```bash
./scripts/stop-all.sh
```

### PM2プロセスのみ停止

```bash
pm2 stop cc-anywhere-backend
pm2 delete cc-anywhere-backend
```

### 開発サーバーの停止

- tmuxセッション内: `Ctrl-C`
- 別ターミナルから: `./scripts/stop-all.sh`

## プロセス管理

### PM2コマンド

```bash
# ステータス確認
pm2 status

# ログ確認
pm2 logs cc-anywhere-backend

# リアルタイムログ
pm2 logs cc-anywhere-backend -f

# 再起動
pm2 restart cc-anywhere-backend

# リロード（ゼロダウンタイム）
pm2 reload cc-anywhere-backend

# モニタリング
pm2 monit
```

### 自動起動設定

システム起動時に自動的にCC-Anywhereを起動:

```bash
# 現在の状態を保存
pm2 save

# 自動起動スクリプトを生成
pm2 startup
# 表示されたコマンドを実行
```

## 環境変数

### 重要な環境変数

| 変数名 | 説明 | デフォルト値 |
|--------|------|-------------|
| `PORT` | サーバーポート | 5000 |
| `HOST` | バインドアドレス | 0.0.0.0 |
| `CLAUDE_API_KEY` | Claude APIキー | (必須) |
| `CORS_ORIGIN` | CORS許可オリジン | * |
| `LOG_LEVEL` | ログレベル | info |
| `TUNNEL_TYPE` | トンネルタイプ | none |

### トンネル設定

外部アクセスを有効にする場合:

```bash
# ngrokを使用
TUNNEL_TYPE=ngrok
ENABLE_NGROK=true

# Cloudflare Tunnelを使用
TUNNEL_TYPE=cloudflare
CLOUDFLARE_TUNNEL_TOKEN=your-token-here
```

## トラブルシューティング

### ビルドエラー

1. **node_modulesの問題**:
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

2. **TypeScriptビルドエラー**:
   ```bash
   cd backend
   rm -rf dist .tsbuildinfo
   npm run build
   ```

### 起動エラー

1. **ポートが使用中**:
   ```bash
   # ポート使用状況確認
   lsof -i :5000
   
   # プロセスを停止
   ./scripts/stop-all.sh
   ```

2. **PM2が見つからない**:
   ```bash
   npm install -g pm2
   # nodenvユーザーの場合
   nodenv rehash
   ```

3. **dist/index.jsが見つからない**:
   ```bash
   ./scripts/build-all.sh
   ```

### ログの確認

```bash
# PM2ログ
pm2 logs cc-anywhere-backend --lines 100

# アプリケーションログ
tail -f backend/logs/*.log

# エラーログのみ
pm2 logs cc-anywhere-backend --err
```

### メモリ不足

PM2の設定でメモリ制限を調整:

```javascript
// backend/ecosystem.config.js
max_memory_restart: '2G',  // 2GBに増やす
```

## パフォーマンスチューニング

### PM2クラスターモード

複数のCPUコアを活用:

```javascript
// backend/ecosystem.config.js
instances: 'max',  // または具体的な数値
exec_mode: 'cluster',
```

### 環境別の最適化

- **開発環境**: ホットリロード、詳細ログ
- **本番環境**: 最小ログ、圧縮、キャッシュ

## セキュリティ

### 本番環境のチェックリスト

- [ ] `.env`ファイルの権限を制限（600）
- [ ] API_KEYを設定して認証を有効化
- [ ] HTTPSを使用（リバースプロキシ経由）
- [ ] ファイアウォールで不要なポートを閉じる
- [ ] 定期的な依存関係の更新

### 推奨されるリバースプロキシ設定

Nginx例:
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

## まとめ

CC-Anywhereは柔軟なデプロイオプションを提供しています:

- **開発**: `./scripts/start-dev.sh`で即座に開始
- **本番**: `./scripts/start-production.sh`でPM2管理
- **モバイル**: クラムシェルモードで外部アクセス可能

問題が発生した場合は、ログを確認し、必要に応じて`./scripts/stop-all.sh`で完全リセットしてください。
#!/bin/bash
# CC-Anywhere 本番環境起動スクリプト（分離版）
# フロントエンドとバックエンドを別々のプロセスで起動

set -e

# 色付き出力用
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# スクリプトのディレクトリを取得
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"
FRONTEND_DIR="$PROJECT_DIR/frontend"
BACKEND_DIR="$PROJECT_DIR/backend"

echo -e "${BLUE}╔══════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║    CC-Anywhere 本番環境起動（分離版）        ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════╝${NC}"
echo ""

# 1. 環境確認
echo -e "${YELLOW}1. 環境を確認中...${NC}"

# Node.jsバージョン確認
NODE_VERSION=$(node --version)
echo -e "   Node.js: ${GREEN}${NODE_VERSION}${NC}"

# PM2確認
if ! command -v pm2 &> /dev/null; then
    echo -e "${RED}エラー: PM2がインストールされていません${NC}"
    echo "以下のコマンドでインストールしてください:"
    echo "  npm install -g pm2"
    exit 1
fi

# Serveパッケージ確認（フロントエンド配信用）
if ! command -v serve &> /dev/null; then
    echo -e "${YELLOW}serveをインストール中...${NC}"
    npm install -g serve
fi

echo -e "${GREEN}✓ 環境確認完了${NC}"
echo ""

# 2. ビルド確認
echo -e "${YELLOW}2. ビルドを確認中...${NC}"

# バックエンドのビルド確認
if [ ! -d "$BACKEND_DIR/dist" ]; then
    echo -e "${YELLOW}バックエンドをビルド中...${NC}"
    cd "$BACKEND_DIR" && npm run build
fi

# フロントエンドのビルド確認
if [ ! -d "$FRONTEND_DIR/build" ]; then
    echo -e "${YELLOW}フロントエンドをビルド中...${NC}"
    cd "$FRONTEND_DIR" && npm run build
fi

echo -e "${GREEN}✓ ビルド確認完了${NC}"
echo ""

# 3. 既存のプロセスを停止
echo -e "${YELLOW}3. 既存のプロセスを停止中...${NC}"

# PM2プロセスを停止
pm2 stop cc-anywhere-backend 2>/dev/null || true
pm2 delete cc-anywhere-backend 2>/dev/null || true
pm2 stop cc-anywhere-frontend 2>/dev/null || true
pm2 delete cc-anywhere-frontend 2>/dev/null || true

echo -e "${GREEN}✓ クリーンアップ完了${NC}"
echo ""

# 4. バックエンドを起動
echo -e "${YELLOW}4. バックエンドを起動中...${NC}"

cd "$BACKEND_DIR"

# PM2でバックエンドを起動
pm2 start ecosystem.config.js --env production

echo -e "${GREEN}✓ バックエンド起動完了${NC}"
echo ""

# 5. フロントエンドを起動
echo -e "${YELLOW}5. フロントエンドを起動中...${NC}"

cd "$FRONTEND_DIR"

# PM2でフロントエンドを起動（serveを使用）
pm2 start serve --name cc-anywhere-frontend -- build -p 4444 -s

echo -e "${GREEN}✓ フロントエンド起動完了${NC}"
echo ""

# 6. 自動起動設定
echo -e "${YELLOW}6. 自動起動設定中...${NC}"
pm2 save
pm2 startup 2>/dev/null || echo -e "${YELLOW}※ pm2 startupコマンドを手動で実行してください${NC}"

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║       本番環境起動完了（分離版）！           ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════╝${NC}"
echo ""

echo -e "${BLUE}アクセスURL:${NC}"
echo "  フロントエンド: http://localhost:4444"
echo "  バックエンドAPI: http://localhost:5000"
echo ""

echo -e "${YELLOW}注意事項:${NC}"
echo "  - フロントエンドとバックエンドが別々のポートで動作"
echo "  - CORS設定が必要（backend/.envで設定済み）"
echo "  - フロントエンドからのAPIリクエストはCORS経由"
echo ""

echo -e "${YELLOW}管理コマンド:${NC}"
echo "  ステータス確認:  pm2 status"
echo "  バックエンドログ: pm2 logs cc-anywhere-backend"
echo "  フロントエンドログ: pm2 logs cc-anywhere-frontend"
echo "  全停止:          pm2 stop all"
echo ""

# Nginxリバースプロキシの設定例を表示
echo -e "${MAGENTA}Nginxリバースプロキシ設定例:${NC}"
cat << 'EOF'
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
EOF
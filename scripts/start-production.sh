#!/bin/bash
# CC-Anywhere 本番環境起動スクリプト
# PM2を使用した本番環境での起動
# 
# 使用方法:
#   ./start-production.sh          # 統合モード（デフォルト）
#   ./start-production.sh separate # 分離モード

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
BACKEND_DIR="$PROJECT_DIR/backend"
ROOT_DIR="$PROJECT_DIR"

echo -e "${BLUE}╔══════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║       CC-Anywhere 本番環境起動               ║${NC}"
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
    echo "  pnpm install -g pm2"
    exit 1
fi
PM2_VERSION=$(pm2 --version)
echo -e "   PM2: ${GREEN}v${PM2_VERSION}${NC}"

# .envファイル確認
if [ ! -f "$ROOT_DIR/.env" ]; then
    echo -e "${RED}エラー: .envファイルが見つかりません${NC}"
    echo ".env.example をコピーして設定してください"
    exit 1
fi

# ビルド確認
if [ ! -d "$BACKEND_DIR/dist" ]; then
    echo -e "${YELLOW}ビルドが必要です。ビルドを実行しますか？ [Y/n]${NC}"
    read -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]] || [[ -z $REPLY ]]; then
        "$SCRIPT_DIR/build-all.sh"
    else
        echo -e "${RED}ビルドがキャンセルされました${NC}"
        exit 1
    fi
fi

echo -e "${GREEN}✓ 環境確認完了${NC}"
echo ""

# 2. 既存のプロセスを停止
echo -e "${YELLOW}2. 既存のプロセスを停止中...${NC}"

# PM2でcc-anywhereを停止
pm2 stop cc-anywhere-backend 2>/dev/null || true
pm2 delete cc-anywhere-backend 2>/dev/null || true

# 開発モードのプロセスも停止
pkill -f "tsx watch" 2>/dev/null || true
pkill -f "pnpm.*dev" 2>/dev/null || true

echo -e "${GREEN}✓ クリーンアップ完了${NC}"
echo ""

# 3. PM2で起動
echo -e "${YELLOW}3. PM2で本番環境を起動中...${NC}"

cd "$BACKEND_DIR"

# PM2起動設定を確認
if [ ! -f "ecosystem.config.js" ]; then
    echo -e "${RED}エラー: ecosystem.config.jsが見つかりません${NC}"
    exit 1
fi

# PM2で起動（本番環境）
pm2 start ecosystem.config.js --env production

# PM2の自動起動設定
echo -e "${YELLOW}4. 自動起動設定中...${NC}"
pm2 save
pm2 startup 2>/dev/null || echo -e "${YELLOW}※ pm2 startupコマンドを手動で実行してください${NC}"

echo -e "${GREEN}✓ 起動完了${NC}"
echo ""

# 4. アクセス情報を表示
echo -e "${GREEN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║          本番環境起動完了！                  ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════╝${NC}"
echo ""

# ポート情報を取得
PORT=$(grep "^PORT=" "$ROOT_DIR/.env" | cut -d'=' -f2 || echo "5000")

echo -e "${BLUE}アクセスURL:${NC}"
echo "  http://localhost:${PORT}"
echo ""

# 外部アクセス設定確認
if grep -q "TUNNEL_TYPE=ngrok" "$ROOT_DIR/.env" 2>/dev/null; then
    echo -e "${MAGENTA}外部アクセス: ngrok有効${NC}"
    echo "  ※ 数秒後に外部URLが表示されます"
elif grep -q "TUNNEL_TYPE=cloudflare" "$ROOT_DIR/.env" 2>/dev/null; then
    echo -e "${MAGENTA}外部アクセス: Cloudflare Tunnel有効${NC}"
fi

echo ""
echo -e "${YELLOW}管理コマンド:${NC}"
echo "  ステータス確認:  pm2 status"
echo "  ログ確認:        pm2 logs cc-anywhere-backend"
echo "  リアルタイムログ: pm2 logs cc-anywhere-backend -f"
echo "  停止:            pm2 stop cc-anywhere-backend"
echo "  再起動:          pm2 restart cc-anywhere-backend"
echo "  モニタリング:    pm2 monit"
echo ""

# ログの最初の部分を表示
echo -e "${BLUE}起動ログ（最初の50行）:${NC}"
sleep 3
pm2 logs cc-anywhere-backend --lines 50 --nostream
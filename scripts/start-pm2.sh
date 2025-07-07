#!/bin/bash
# CC-Anywhere PM2起動スクリプト - クラムシェルモード対応

set -e

# 色付き出力用
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# スクリプトのディレクトリを取得
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"

echo -e "${BLUE}=== CC-Anywhere PM2 Setup ===${NC}"
echo ""

# プロジェクトディレクトリに移動
cd "$PROJECT_DIR"

# 環境チェック
echo -e "${YELLOW}環境をチェック中...${NC}"

# PM2がインストールされているか確認
if ! command -v pm2 &> /dev/null; then
    echo -e "${RED}PM2がインストールされていません${NC}"
    echo "インストール: npm install -g pm2"
    
    # nodenvを使用している場合の追加手順
    if command -v nodenv &> /dev/null; then
        echo ""
        echo "nodenvを使用している場合:"
        echo "  npm install -g pm2"
        echo "  nodenv rehash"
    fi
    exit 1
fi

# Node.jsが利用可能か確認
if ! command -v node &> /dev/null; then
    echo -e "${RED}Node.jsがインストールされていません${NC}"
    exit 1
fi

# ビルドが必要か確認
if [ ! -d "dist" ]; then
    echo -e "${YELLOW}ビルドファイルが見つかりません。ビルド中...${NC}"
    npm run build
fi

# .envファイルの存在確認
if [ ! -f ".env" ]; then
    echo -e "${RED}.envファイルが見つかりません${NC}"
    echo ".env.exampleから.envを作成してください"
    exit 1
fi

# PM2でアプリケーションを起動
echo -e "${GREEN}PM2でCC-Anywhereを起動中...${NC}"

# 既存のプロセスを停止（存在する場合）
pm2 stop cc-anywhere 2>/dev/null || true
pm2 delete cc-anywhere 2>/dev/null || true

# PM2で起動
pm2 start dist/index.js \
    --name "cc-anywhere" \
    --watch false \
    --time \
    --log-date-format "YYYY-MM-DD HH:mm:ss" \
    --merge-logs \
    --max-memory-restart 1G

# PM2の自動起動設定
echo -e "${YELLOW}PM2の自動起動を設定中...${NC}"
pm2 save
pm2 startup 2>/dev/null || echo -e "${YELLOW}pm2 startupコマンドを手動で実行してください${NC}"

# スリープ防止を開始（macOSの場合）
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo -e "${GREEN}macOSのスリープを防止中...${NC}"
    # システムスリープとディスプレイスリープの両方を防止
    caffeinate -disu &
    CAFFEINATE_PID=$!
    echo "Caffeinate PID: $CAFFEINATE_PID"
    
    # caffeinate PIDを保存
    echo $CAFFEINATE_PID > "$PROJECT_DIR/.caffeinate.pid"
    
    echo -e "${BLUE}ヒント: MacBookを閉じても動作し続けます${NC}"
fi

# ngrokの確認（内蔵されている場合）
if grep -q "ENABLE_NGROK=true" .env; then
    echo -e "${GREEN}ngrokは内蔵機能で有効になっています${NC}"
fi

# ステータス表示
echo ""
echo -e "${GREEN}=== 起動完了 ===${NC}"
echo ""

# PM2のステータスを表示
pm2 status cc-anywhere

echo ""
echo -e "${BLUE}便利なコマンド:${NC}"
echo "  ログを確認:      pm2 logs cc-anywhere"
echo "  ステータス確認:  pm2 status cc-anywhere"
echo "  再起動:          pm2 restart cc-anywhere"
echo "  停止:            pm2 stop cc-anywhere"
echo "  モニタリング:    pm2 monit"

# アプリケーションのURLを表示
PORT=$(grep "^PORT=" .env | cut -d'=' -f2 || echo "5000")
echo ""
echo -e "${GREEN}アプリケーションURL:${NC}"
echo "  ローカル: http://localhost:$PORT"

# ngrok URLとQRコードを表示
echo ""
echo -e "${YELLOW}ngrok URLを確認中...${NC}"
sleep 5

# より多くの行を表示してQRコードを完全に表示
echo -e "${BLUE}=== アプリケーションログ ===${NC}"
pm2 logs cc-anywhere --lines 50 --nostream | grep -A 50 -B 5 "ngrok\|QR\|https://" || true

echo ""
echo -e "${GREEN}ヒント:${NC}"
echo "  完全なログを見る: pm2 logs cc-anywhere --lines 100"
echo "  リアルタイムログ: pm2 logs cc-anywhere"
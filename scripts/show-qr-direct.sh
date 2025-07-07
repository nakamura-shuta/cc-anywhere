#!/bin/bash
# CC-Anywhere QRコード直接表示スクリプト（PM2のタイムスタンプを回避）

set -e

# 色付き出力用
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# スクリプトのディレクトリを取得
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"

# 保存されたQRコードファイルを直接表示
if [ -f "$PROJECT_DIR/data/last-qr.txt" ] && [ -f "$PROJECT_DIR/data/last-access-info.json" ]; then
    # アクセス情報を読み込む
    if command -v jq >/dev/null 2>&1; then
        URL=$(jq -r '.url' "$PROJECT_DIR/data/last-access-info.json" 2>/dev/null || echo "")
        TYPE=$(jq -r '.type' "$PROJECT_DIR/data/last-access-info.json" 2>/dev/null || echo "")
        API_KEY=$(jq -r '.apiKey // "未設定"' "$PROJECT_DIR/data/last-access-info.json" 2>/dev/null || echo "未設定")
        WEB_UI_URL=$(jq -r '.webUIUrl // ""' "$PROJECT_DIR/data/last-access-info.json" 2>/dev/null || echo "")
    fi
    
    # 情報表示
    echo -e "${BLUE}╔══════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║        CC-Anywhere 外部アクセス情報          ║${NC}"
    echo -e "${BLUE}╚══════════════════════════════════════════════╝${NC}"
    echo ""
    echo "========================================" 
    echo "🌐 External Access Information ($TYPE)"
    echo "========================================"
    echo ""
    echo "📡 $TYPE URL: $URL"
    echo "🔒 API Key: $API_KEY"
    
    if [ "$API_KEY" != "未設定" ] && [ -n "$WEB_UI_URL" ]; then
        echo ""
        echo "🌍 Web UI Access:"
        echo "   $WEB_UI_URL"
        echo ""
        echo "📱 API Access:"
        echo "   curl -H \"X-API-Key: $API_KEY\" $URL/api/tasks"
    fi
    
    echo ""
    echo "📱 Scan QR code with your phone:"
    echo ""
    
    # QRコードを直接表示（タイムスタンプなし）
    cat "$PROJECT_DIR/data/last-qr.txt"
    
    echo ""
    echo "========================================"
else
    echo -e "${RED}QRコード情報が見つかりません${NC}"
    echo ""
    echo "サーバーを起動してください:"
    echo "  ./scripts/start-clamshell.sh"
fi
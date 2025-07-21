#!/bin/bash
# CC-Anywhere QRコード完全表示スクリプト

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

# タイトル表示
echo -e "${BLUE}╔══════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║        CC-Anywhere 外部アクセス情報          ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════╝${NC}"
echo ""

# 保存されたアクセス情報を読み込む
if [ -f "$PROJECT_DIR/data/last-access-info.json" ]; then
    # jqがインストールされているか確認
    if command -v jq >/dev/null 2>&1; then
        URL=$(jq -r '.url' "$PROJECT_DIR/data/last-access-info.json" 2>/dev/null || echo "")
        TYPE=$(jq -r '.type' "$PROJECT_DIR/data/last-access-info.json" 2>/dev/null || echo "")
        API_KEY=$(jq -r '.apiKey // "未設定"' "$PROJECT_DIR/data/last-access-info.json" 2>/dev/null || echo "未設定")
        WEB_UI_URL=$(jq -r '.webUIUrl // ""' "$PROJECT_DIR/data/last-access-info.json" 2>/dev/null || echo "")
        TIMESTAMP=$(jq -r '.timestamp' "$PROJECT_DIR/data/last-access-info.json" 2>/dev/null || echo "")
    else
        # jqがない場合は簡易的な解析
        URL=$(grep -o '"url":"[^"]*"' "$PROJECT_DIR/data/last-access-info.json" | cut -d'"' -f4)
        TYPE=$(grep -o '"type":"[^"]*"' "$PROJECT_DIR/data/last-access-info.json" | cut -d'"' -f4)
        API_KEY=$(grep -o '"apiKey":"[^"]*"' "$PROJECT_DIR/data/last-access-info.json" | cut -d'"' -f4 || echo "未設定")
    fi
    
    if [ -n "$URL" ]; then
        echo -e "${CYAN}最新のアクセス情報:${NC}"
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
        else
            echo ""
            echo "⚠️  Warning: API authentication is disabled!"
            echo ""
            echo "🌍 Web UI Access:"
            echo "   $URL/"
            echo ""
            echo "📱 API Access:"
            echo "   curl $URL/api/tasks"
        fi
        
        # 保存されたQRコードを表示
        if [ -f "$PROJECT_DIR/data/last-qr.txt" ]; then
            echo ""
            echo "📱 Scan QR code with your phone:"
            echo ""
            cat "$PROJECT_DIR/data/last-qr.txt"
        fi
        
        echo ""
        echo "========================================"
        
        if [ -n "$TIMESTAMP" ]; then
            echo ""
            echo -e "${YELLOW}最終更新: $TIMESTAMP${NC}"
        fi
    else
        echo -e "${RED}保存されたアクセス情報が見つかりません${NC}"
    fi
else
    echo -e "${RED}アクセス情報ファイルが見つかりません${NC}"
    echo ""
    
    # サーバーが動作している場合は、ログから取得を試みる
    if curl -s http://localhost:5000/health > /dev/null 2>&1; then
        echo -e "${YELLOW}サーバーログから情報を取得します...${NC}"
        echo ""
        
        # server.logから最新のExternal Access Informationを探す
        if [ -f "$PROJECT_DIR/server.log" ]; then
            awk '
                /External Access Information/ {
                    found=1
                    buffer=""
                }
                found {
                    buffer = buffer "\n" $0
                    if (/^=======================================$/ && buffer ~ /QR/) {
                        print buffer
                        exit
                    }
                }
            ' "$PROJECT_DIR/server.log" | tail -n 100
        else
            echo -e "${RED}サーバーログが見つかりません${NC}"
        fi
    else
        echo -e "${YELLOW}CC-Anywhereが起動していません${NC}"
        echo "起動: npm run dev"
    fi
fi

echo ""
echo -e "${GREEN}追加のコマンド:${NC}"
echo "  URL再表示:     ./scripts/tunnel-manager.sh show"
echo "  状態確認:      ./scripts/tunnel-manager.sh status"
echo "  リアルタイムログ: tail -f server.log"
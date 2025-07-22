#!/bin/bash
# フロントエンドビルド＆デプロイスクリプト
# フロントエンドをビルドしてバックエンドのwebディレクトリに配置

set -e

# 色付き出力用
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# スクリプトのディレクトリを取得
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
# backendディレクトリを取得
BACKEND_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"
# プロジェクトルートディレクトリを取得
PROJECT_DIR="$( cd "$BACKEND_DIR/.." && pwd )"
# frontendディレクトリ
FRONTEND_DIR="$PROJECT_DIR/frontend"

echo -e "${BLUE}╔══════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║      フロントエンドビルド＆デプロイ          ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════╝${NC}"
echo ""

# 1. フロントエンドディレクトリの確認
if [ ! -d "$FRONTEND_DIR" ]; then
    echo -e "${RED}エラー: フロントエンドディレクトリが見つかりません${NC}"
    echo "場所: $FRONTEND_DIR"
    exit 1
fi

# 2. フロントエンドのビルド
echo -e "${YELLOW}1. フロントエンドをビルド中...${NC}"
cd "$FRONTEND_DIR"

# node_modulesが存在しない場合はインストール
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}   依存関係をインストール中...${NC}"
    npm install
fi

# ビルド実行
npm run build

if [ ! -d "build" ]; then
    echo -e "${RED}エラー: ビルドディレクトリが作成されませんでした${NC}"
    exit 1
fi

echo -e "${GREEN}✓ ビルド完了${NC}"

# 3. バックエンドのwebディレクトリを準備
echo -e "${YELLOW}2. バックエンドのwebディレクトリを準備中...${NC}"

# 既存のwebディレクトリを削除（存在する場合）
if [ -d "$BACKEND_DIR/web" ]; then
    echo "   既存のwebディレクトリを削除中..."
    rm -rf "$BACKEND_DIR/web"
fi

# 4. ビルド結果をコピー
echo -e "${YELLOW}3. ビルド結果をバックエンドにコピー中...${NC}"
cp -r "$FRONTEND_DIR/build" "$BACKEND_DIR/web"

# 5. 確認
if [ -d "$BACKEND_DIR/web" ]; then
    echo -e "${GREEN}✓ デプロイ完了${NC}"
    echo ""
    echo -e "${GREEN}フロントエンドが以下にデプロイされました:${NC}"
    echo "  $BACKEND_DIR/web"
    echo ""
    
    # ファイル数を表示
    FILE_COUNT=$(find "$BACKEND_DIR/web" -type f | wc -l | tr -d ' ')
    echo -e "${BLUE}デプロイされたファイル数: $FILE_COUNT${NC}"
else
    echo -e "${RED}エラー: デプロイに失敗しました${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║           ビルド＆デプロイ完了！             ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}次のステップ:${NC}"
echo "1. バックエンドサーバーを起動:"
echo "   ./backend/scripts/start-clamshell.sh"
echo ""
echo "2. ブラウザでアクセス:"
echo "   http://localhost:5000"
echo ""
echo -e "${BLUE}※ フロントエンドとAPIが統合されて配信されます${NC}"
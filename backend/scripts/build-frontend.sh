#!/bin/bash
# フロントエンドをバックエンドに統合するスクリプト
# build-all.shから抜粋

set -e

# 色付き出力用
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# スクリプトのディレクトリを取得
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
BACKEND_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"
PROJECT_DIR="$( cd "$BACKEND_DIR/.." && pwd )"
FRONTEND_DIR="$PROJECT_DIR/frontend"

echo -e "${YELLOW}フロントエンドをバックエンドに統合中...${NC}"

# 既存のwebディレクトリを削除
if [ -d "$BACKEND_DIR/web" ]; then
    echo "   既存のwebディレクトリを削除中..."
    rm -rf "$BACKEND_DIR/web"
fi

# フロントエンドビルドをコピー
echo "   フロントエンドをコピー中..."
cp -r "$FRONTEND_DIR/build" "$BACKEND_DIR/web"

# 確認
if [ -d "$BACKEND_DIR/web" ]; then
    FILE_COUNT=$(find "$BACKEND_DIR/web" -type f | wc -l | tr -d ' ')
    echo -e "${GREEN}✓ 統合完了（${FILE_COUNT}ファイル）${NC}"
else
    echo -e "${RED}エラー: 統合に失敗しました${NC}"
    exit 1
fi
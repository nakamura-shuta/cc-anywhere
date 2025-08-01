#!/bin/bash
# CC-Anywhere 統合ビルドスクリプト
# フロントエンドとバックエンドの両方をビルドして統合

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
FRONTEND_DIR="$PROJECT_DIR/frontend"
BACKEND_DIR="$PROJECT_DIR/backend"

echo -e "${BLUE}╔══════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║        CC-Anywhere 統合ビルド                ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════╝${NC}"
echo ""

# 1. フロントエンドのビルド
echo -e "${YELLOW}1. フロントエンドのビルド${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if [ ! -d "$FRONTEND_DIR" ]; then
    echo -e "${RED}エラー: フロントエンドディレクトリが見つかりません${NC}"
    echo "場所: $FRONTEND_DIR"
    exit 1
fi

cd "$FRONTEND_DIR"

# node_modulesが存在しない場合はインストール
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}   依存関係をインストール中...${NC}"
    npm install
fi

# ビルドディレクトリをクリーンアップ
if [ -d "build" ]; then
    echo "   既存のビルドを削除中..."
    rm -rf build
fi

# フロントエンドをビルド
echo "   ビルド実行中..."
npm run build

if [ ! -d "build" ]; then
    echo -e "${RED}エラー: フロントエンドのビルドに失敗しました${NC}"
    exit 1
fi

echo -e "${GREEN}✓ フロントエンドビルド完了${NC}"
echo ""

# 2. バックエンドのビルド
echo -e "${YELLOW}2. バックエンドのビルド${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

cd "$BACKEND_DIR"

# node_modulesが存在しない場合はインストール
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}   依存関係をインストール中...${NC}"
    npm install
fi

# ビルドディレクトリとキャッシュをクリーンアップ
if [ -d "dist" ]; then
    echo "   既存のビルドを削除中..."
    rm -rf dist
fi
if [ -f ".tsbuildinfo" ]; then
    rm -f .tsbuildinfo
fi

# バックエンドをビルド
echo "   ビルド実行中..."
npm run build

if [ ! -d "dist" ]; then
    echo -e "${RED}エラー: バックエンドのビルドに失敗しました${NC}"
    exit 1
fi

echo -e "${GREEN}✓ バックエンドビルド完了${NC}"
echo ""

# 3. フロントエンドをバックエンドに統合
echo -e "${YELLOW}3. フロントエンドをバックエンドに統合${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

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

echo ""

# 4. ビルド結果の確認
echo -e "${YELLOW}4. ビルド結果の確認${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# バックエンドの確認
if [ -f "$BACKEND_DIR/dist/index.js" ]; then
    echo -e "${GREEN}✓ バックエンド: dist/index.js${NC}"
else
    echo -e "${RED}✗ バックエンド: dist/index.js が見つかりません${NC}"
    exit 1
fi

# フロントエンドの確認
if [ -f "$BACKEND_DIR/web/index.html" ]; then
    echo -e "${GREEN}✓ フロントエンド: web/index.html${NC}"
else
    echo -e "${RED}✗ フロントエンド: web/index.html が見つかりません${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║           ビルド完了！                       ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}次のステップ:${NC}"
echo "1. 開発環境で起動:"
echo "   cd backend && npm run dev"
echo ""
echo "2. 本番環境で起動:"
echo "   ./scripts/start-production.sh"
echo ""
echo "3. クラムシェルモードで起動:"
echo "   ./scripts/start-clamshell.sh"
echo ""
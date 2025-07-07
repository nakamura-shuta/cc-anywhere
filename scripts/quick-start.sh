#!/bin/bash
# CC-Anywhere クイックスタート（PM2 + クラムシェルモード）

set -e

# 色付き出力
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=== CC-Anywhere クイックスタート ===${NC}"
echo ""

# 依存関係チェック
echo -e "${YELLOW}1. 環境をチェック中...${NC}"

# Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.jsがインストールされていません"
    exit 1
fi
echo "✅ Node.js $(node --version)"

# npm
if ! command -v npm &> /dev/null; then
    echo "❌ npmがインストールされていません"
    exit 1
fi
echo "✅ npm $(npm --version)"

# PM2
if ! command -v pm2 &> /dev/null; then
    echo "❌ PM2がインストールされていません"
    echo "インストール中..."
    npm install -g pm2
    
    # nodenvを使用している場合はrehash
    if command -v nodenv &> /dev/null; then
        echo "nodenvを検出しました。rehash中..."
        # ロックファイルが存在する場合は削除
        [ -f "$HOME/.nodenv/shims/.nodenv-shim" ] && rm -f "$HOME/.nodenv/shims/.nodenv-shim"
        nodenv rehash
    fi
    
    # 再度チェック
    if ! command -v pm2 &> /dev/null; then
        echo "⚠️  PM2のインストールに成功しましたが、シェルの再読み込みが必要です"
        echo "以下のコマンドを実行してください:"
        echo ""
        echo "  exec \$SHELL -l"
        echo "  ./scripts/quick-start.sh"
        echo ""
        exit 1
    fi
fi
echo "✅ PM2 $(pm2 --version)"

# 依存関係インストール
echo ""
echo -e "${YELLOW}2. 依存関係をインストール中...${NC}"
npm install

# .envファイルチェック
if [ ! -f .env ]; then
    echo ""
    echo -e "${YELLOW}3. 環境設定ファイルを作成中...${NC}"
    cp .env.example .env
    echo "⚠️  .envファイルを編集してAPIキーを設定してください"
fi

# ビルド
echo ""
echo -e "${YELLOW}4. アプリケーションをビルド中...${NC}"
npm run build

# PM2で起動
echo ""
echo -e "${YELLOW}5. PM2で起動中...${NC}"
./scripts/start-pm2.sh

echo ""
echo -e "${GREEN}=== セットアップ完了！ ===${NC}"
echo ""
echo -e "${BLUE}次のステップ:${NC}"
echo "1. .envファイルを編集してCLAUDE_API_KEYを設定"
echo "2. ブラウザで http://localhost:5000 にアクセス"
echo "3. MacBookを閉じてもアプリは動作し続けます！"
echo ""
echo -e "${BLUE}管理コマンド:${NC}"
echo "  状態確認: ./scripts/pm2-manager.sh status"
echo "  ログ確認: ./scripts/pm2-manager.sh logs"
echo "  停止:     ./scripts/pm2-manager.sh stop"
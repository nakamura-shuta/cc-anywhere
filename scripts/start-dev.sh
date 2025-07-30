#!/bin/bash
# CC-Anywhere 開発環境起動スクリプト
# フロントエンドとバックエンドを同時に起動（開発モード）

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
ROOT_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"
PROJECT_DIR="$ROOT_DIR"
FRONTEND_DIR="$PROJECT_DIR/frontend"
BACKEND_DIR="$PROJECT_DIR/backend"

echo -e "${BLUE}╔══════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║       CC-Anywhere 開発環境起動               ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════╝${NC}"
echo ""

# 1. 依存関係の確認
echo -e "${YELLOW}1. 依存関係を確認中...${NC}"

# バックエンドの依存関係
if [ ! -d "$BACKEND_DIR/node_modules" ]; then
    echo -e "${YELLOW}   バックエンドの依存関係をインストール中...${NC}"
    cd "$BACKEND_DIR" && npm install
fi

# フロントエンドの依存関係
if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
    echo -e "${YELLOW}   フロントエンドの依存関係をインストール中...${NC}"
    cd "$FRONTEND_DIR" && npm install
fi

# .envファイル確認
if [ ! -f "$ROOT_DIR/.env" ]; then
    echo -e "${RED}エラー: .envファイルが見つかりません${NC}"
    if [ -f "$ROOT_DIR/.env.example" ]; then
        echo -e "${YELLOW}.env.exampleから作成します${NC}"
        cp "$ROOT_DIR/.env.example" "$ROOT_DIR/.env"
        echo -e "${YELLOW}※ .envファイルを編集してCLAUDE_API_KEYを設定してください${NC}"
    else
        exit 1
    fi
fi

echo -e "${GREEN}✓ 依存関係確認完了${NC}"
echo ""

# 2. 既存のプロセスを停止
echo -e "${YELLOW}2. 既存のプロセスを停止中...${NC}"

# バックエンドのプロセスを停止
pkill -f "tsx watch" 2>/dev/null || true
pkill -f "npm run dev.*backend" 2>/dev/null || true
pm2 stop cc-anywhere-backend 2>/dev/null || true
pm2 delete cc-anywhere-backend 2>/dev/null || true

# フロントエンドのプロセスを停止
pkill -f "vite" 2>/dev/null || true
pkill -f "npm run dev.*frontend" 2>/dev/null || true

echo -e "${GREEN}✓ クリーンアップ完了${NC}"
echo ""

# 3. tmuxセッションの作成または再利用
echo -e "${YELLOW}3. 開発環境を起動中...${NC}"

# tmuxがインストールされているか確認
if command -v tmux &> /dev/null; then
    # tmuxセッション名
    SESSION_NAME="cc-anywhere"
    
    # 既存のセッションを削除
    tmux kill-session -t $SESSION_NAME 2>/dev/null || true
    
    # 新しいセッションを作成
    tmux new-session -d -s $SESSION_NAME -n backend
    
    # バックエンドを起動
    tmux send-keys -t $SESSION_NAME:backend "cd $BACKEND_DIR" C-m
    tmux send-keys -t $SESSION_NAME:backend "npm run dev" C-m
    
    # フロントエンド用の新しいウィンドウを作成
    tmux new-window -t $SESSION_NAME -n frontend
    tmux send-keys -t $SESSION_NAME:frontend "cd $FRONTEND_DIR" C-m
    tmux send-keys -t $SESSION_NAME:frontend "npm run dev" C-m
    
    # ログ用の新しいウィンドウを作成
    tmux new-window -t $SESSION_NAME -n logs
    tmux send-keys -t $SESSION_NAME:logs "cd $BACKEND_DIR" C-m
    tmux send-keys -t $SESSION_NAME:logs "tail -f logs/*.log 2>/dev/null || echo 'ログファイルを待機中...'" C-m
    
    echo -e "${GREEN}✓ tmuxセッション起動完了${NC}"
    echo ""
    echo -e "${BLUE}tmuxセッションに接続:${NC}"
    echo "  tmux attach -t cc-anywhere"
    echo ""
    echo -e "${BLUE}ウィンドウの切り替え:${NC}"
    echo "  Ctrl-b 0: バックエンド"
    echo "  Ctrl-b 1: フロントエンド"
    echo "  Ctrl-b 2: ログ"
    echo ""
else
    # tmuxがない場合は通常の方法で起動
    echo -e "${YELLOW}tmuxがインストールされていません。通常モードで起動します。${NC}"
    echo -e "${YELLOW}※ 別々のターミナルで以下のコマンドを実行してください:${NC}"
    echo ""
    echo "ターミナル1（バックエンド）:"
    echo "  cd $BACKEND_DIR && npm run dev"
    echo ""
    echo "ターミナル2（フロントエンド）:"
    echo "  cd $FRONTEND_DIR && npm run dev"
    echo ""
    
    # バックエンドのみ起動
    echo -e "${BLUE}バックエンドを起動しています...${NC}"
    cd "$BACKEND_DIR"
    npm run dev
fi

# 4. アクセス情報
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║          開発環境起動完了！                  ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}アクセスURL:${NC}"
echo "  バックエンドAPI: http://localhost:5000"
echo "  フロントエンド:  http://localhost:4444"
echo ""
echo -e "${YELLOW}注意事項:${NC}"
echo "  - フロントエンドは独立したdevサーバーで動作します"
echo "  - APIリクエストは自動的にバックエンドにプロキシされます"
echo "  - ホットリロードが有効です"
echo ""
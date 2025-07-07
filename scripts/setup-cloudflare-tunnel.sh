#!/bin/bash
# Cloudflare Tunnel 自動セットアップスクリプト

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

echo -e "${BLUE}╔══════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Cloudflare Tunnel 自動セットアップ         ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════╝${NC}"
echo ""

# 必要な情報を収集
echo -e "${YELLOW}Cloudflare APIの認証情報が必要です:${NC}"
echo ""
echo "1. https://dash.cloudflare.com/profile/api-tokens"
echo "2. 「Create Token」をクリック"
echo "3. 「Custom token」を選択"
echo "4. 権限を設定:"
echo "   - Account > Cloudflare Tunnel:Edit"
echo "   - Zone > Zone:Read"
echo "   - Zone > DNS:Edit (オプション)"
echo ""

# API認証情報の入力
read -p "Cloudflare Email: " CF_EMAIL
read -s -p "Cloudflare API Key (Global API Key): " CF_API_KEY
echo ""
read -p "Cloudflare Account ID: " CF_ACCOUNT_ID

# アカウントIDの取得方法を説明
if [ -z "$CF_ACCOUNT_ID" ]; then
    echo ""
    echo -e "${YELLOW}アカウントIDの確認方法:${NC}"
    echo "1. https://dash.cloudflare.com"
    echo "2. 右側のサイドバーでアカウントIDを確認"
    echo ""
    read -p "Cloudflare Account ID: " CF_ACCOUNT_ID
fi

# トンネル名の設定
TUNNEL_NAME="cc-anywhere-$(date +%s)"
read -p "トンネル名 (デフォルト: $TUNNEL_NAME): " custom_name
if [ -n "$custom_name" ]; then
    TUNNEL_NAME="$custom_name"
fi

echo ""
echo -e "${GREEN}設定内容:${NC}"
echo "  Email: $CF_EMAIL"
echo "  Account ID: $CF_ACCOUNT_ID"
echo "  Tunnel Name: $TUNNEL_NAME"
echo ""

# API呼び出し関数
call_cf_api() {
    local method=$1
    local endpoint=$2
    local data=$3
    
    if [ -z "$data" ]; then
        curl -s -X "$method" \
            "https://api.cloudflare.com/client/v4/$endpoint" \
            -H "X-Auth-Email: $CF_EMAIL" \
            -H "X-Auth-Key: $CF_API_KEY" \
            -H "Content-Type: application/json"
    else
        curl -s -X "$method" \
            "https://api.cloudflare.com/client/v4/$endpoint" \
            -H "X-Auth-Email: $CF_EMAIL" \
            -H "X-Auth-Key: $CF_API_KEY" \
            -H "Content-Type: application/json" \
            -d "$data"
    fi
}

# 1. 既存のトンネルをチェック
echo -e "${YELLOW}既存のトンネルを確認中...${NC}"
TUNNELS_RESPONSE=$(call_cf_api GET "accounts/$CF_ACCOUNT_ID/tunnels")
EXISTING_TUNNEL=$(echo "$TUNNELS_RESPONSE" | jq -r ".result[] | select(.name == \"$TUNNEL_NAME\") | .id" | head -1)

if [ -n "$EXISTING_TUNNEL" ]; then
    echo -e "${YELLOW}同名のトンネルが存在します。削除しますか？${NC}"
    read -p "削除して新規作成 [y/N]: " delete_existing
    if [ "$delete_existing" = "y" ]; then
        echo "既存のトンネルを削除中..."
        call_cf_api DELETE "accounts/$CF_ACCOUNT_ID/tunnels/$EXISTING_TUNNEL" > /dev/null
        sleep 2
    else
        TUNNEL_NAME="$TUNNEL_NAME-$(date +%s)"
        echo -e "${GREEN}新しい名前を使用: $TUNNEL_NAME${NC}"
    fi
fi

# 2. 新しいトンネルを作成
echo -e "${YELLOW}新しいトンネルを作成中...${NC}"
TUNNEL_SECRET=$(openssl rand -base64 32)
CREATE_RESPONSE=$(call_cf_api POST "accounts/$CF_ACCOUNT_ID/tunnels" "{
    \"name\": \"$TUNNEL_NAME\",
    \"tunnel_secret\": \"$TUNNEL_SECRET\"
}")

TUNNEL_ID=$(echo "$CREATE_RESPONSE" | jq -r '.result.id')
TUNNEL_TOKEN=$(echo "$CREATE_RESPONSE" | jq -r '.result.token')

if [ "$TUNNEL_ID" = "null" ] || [ -z "$TUNNEL_ID" ]; then
    echo -e "${RED}トンネルの作成に失敗しました${NC}"
    echo "レスポンス: $CREATE_RESPONSE"
    exit 1
fi

echo -e "${GREEN}✓ トンネル作成成功${NC}"
echo "  Tunnel ID: $TUNNEL_ID"

# 3. トンネル認証情報を生成
echo -e "${YELLOW}認証トークンを生成中...${NC}"

# トークンの構造を作成
TOKEN_PAYLOAD=$(echo -n "{
    \"a\": \"$CF_ACCOUNT_ID\",
    \"t\": \"$TUNNEL_ID\",
    \"s\": \"$TUNNEL_SECRET\"
}" | base64 | tr -d '\n' | tr '+/' '-_' | tr -d '=')

echo -e "${GREEN}✓ トークン生成成功${NC}"

# 4. .envファイルに設定を保存
cd "$PROJECT_DIR"
echo -e "${YELLOW}.envファイルを更新中...${NC}"

# TUNNEL_TYPEをcloudflareに設定
if grep -q "TUNNEL_TYPE=" .env 2>/dev/null; then
    sed -i '' 's/TUNNEL_TYPE=.*/TUNNEL_TYPE=cloudflare/g' .env
else
    echo "TUNNEL_TYPE=cloudflare" >> .env
fi

# CLOUDFLARE_TUNNEL_TOKENを設定
if grep -q "CLOUDFLARE_TUNNEL_TOKEN=" .env 2>/dev/null; then
    sed -i '' "s/CLOUDFLARE_TUNNEL_TOKEN=.*/CLOUDFLARE_TUNNEL_TOKEN=$TOKEN_PAYLOAD/g" .env
else
    echo "CLOUDFLARE_TUNNEL_TOKEN=$TOKEN_PAYLOAD" >> .env
fi

# CLOUDFLARE_TUNNEL_NAMEを設定
if grep -q "CLOUDFLARE_TUNNEL_NAME=" .env 2>/dev/null; then
    sed -i '' "s/CLOUDFLARE_TUNNEL_NAME=.*/CLOUDFLARE_TUNNEL_NAME=$TUNNEL_NAME/g" .env
else
    echo "CLOUDFLARE_TUNNEL_NAME=$TUNNEL_NAME" >> .env
fi

# ENABLE_NGROKをfalseに設定
if grep -q "ENABLE_NGROK=" .env 2>/dev/null; then
    sed -i '' 's/ENABLE_NGROK=.*/ENABLE_NGROK=false/g' .env
fi

echo -e "${GREEN}✓ .envファイル更新完了${NC}"

# 5. ドメイン設定（オプション）
echo ""
echo -e "${YELLOW}ドメイン設定（オプション）${NC}"
echo "Cloudflareで管理しているドメインを使用しますか？"
echo "（スキップする場合は、*.trycloudflare.comの一時ドメインが使用されます）"
read -p "ドメインを設定 [y/N]: " setup_domain

if [ "$setup_domain" = "y" ]; then
    # ゾーン一覧を取得
    echo -e "${YELLOW}利用可能なドメインを取得中...${NC}"
    ZONES_RESPONSE=$(call_cf_api GET "zones")
    echo ""
    echo "利用可能なドメイン:"
    echo "$ZONES_RESPONSE" | jq -r '.result[] | "\(.name) (ID: \(.id))"'
    echo ""
    
    read -p "使用するドメイン名: " DOMAIN
    ZONE_ID=$(echo "$ZONES_RESPONSE" | jq -r ".result[] | select(.name == \"$DOMAIN\") | .id")
    
    if [ -n "$ZONE_ID" ]; then
        read -p "サブドメイン (例: cc-anywhere): " SUBDOMAIN
        SUBDOMAIN=${SUBDOMAIN:-cc-anywhere}
        
        # DNSレコードを作成
        echo -e "${YELLOW}DNSレコードを作成中...${NC}"
        DNS_RESPONSE=$(call_cf_api POST "zones/$ZONE_ID/dns_records" "{
            \"type\": \"CNAME\",
            \"name\": \"$SUBDOMAIN\",
            \"content\": \"$TUNNEL_ID.cfargotunnel.com\",
            \"proxied\": true
        }")
        
        if echo "$DNS_RESPONSE" | jq -e '.success' > /dev/null; then
            echo -e "${GREEN}✓ DNSレコード作成成功${NC}"
            echo "  URL: https://$SUBDOMAIN.$DOMAIN"
            
            # .envに保存
            echo "CLOUDFLARE_TUNNEL_HOSTNAME=$SUBDOMAIN.$DOMAIN" >> .env
        else
            echo -e "${RED}DNSレコード作成失敗${NC}"
            echo "$DNS_RESPONSE" | jq .
        fi
    fi
fi

# 6. 設定完了
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║        セットアップ完了！                    ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════╝${NC}"
echo ""

echo -e "${CYAN}次のステップ:${NC}"
echo "1. サーバーを起動:"
echo "   ./scripts/start-clamshell.sh"
echo ""
echo "2. トンネルの状態を確認:"
echo "   ./scripts/tunnel-manager.sh status"
echo ""

if [ "$setup_domain" != "y" ]; then
    echo -e "${YELLOW}注意:${NC}"
    echo "ドメインを設定していない場合、起動時に一時的なURLが割り当てられます"
    echo "このURLはサーバー再起動ごとに変わります"
fi

# 認証情報をクリーンアップ（セキュリティのため）
unset CF_EMAIL CF_API_KEY CF_ACCOUNT_ID TUNNEL_SECRET
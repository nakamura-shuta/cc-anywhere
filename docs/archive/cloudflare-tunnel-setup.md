# Cloudflare Tunnel セットアップガイド

CC-AnywhereをCloudflare Tunnelで外部公開する方法を説明します。

## なぜCloudflare Tunnel？

- **無料**: 基本的な使用は無料
- **セキュア**: エンドツーエンドの暗号化
- **安定**: ngrokよりも安定した接続
- **企業向け**: 社内ポリシーに適合しやすい
- **カスタムドメイン**: 独自ドメインも使用可能

## 前提条件

1. Cloudflareアカウント（無料）
2. cloudflaredのインストール

## cloudflaredのインストール

### macOS (Homebrew)
```bash
brew install cloudflare/cloudflare/cloudflared
```

### macOS (手動)
```bash
# Apple Silicon (M1/M2)
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-arm64 -o cloudflared
chmod +x cloudflared
sudo mv cloudflared /usr/local/bin/

# Intel Mac
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-amd64 -o cloudflared
chmod +x cloudflared
sudo mv cloudflared /usr/local/bin/
```

### 確認
```bash
cloudflared --version
```

## セットアップ方法

### 方法1: クイックトンネル（最も簡単）

1. `.env`ファイルを編集：
```bash
# Tunnel設定
TUNNEL_TYPE=cloudflare
SHOW_QR_CODE=true
```

2. アプリケーションを起動：
```bash
npm run dev
# または
./scripts/start-pm2.sh
```

これで自動的にCloudflare Tunnelが起動し、URLが表示されます。

### 方法2: 永続的なトンネル（推奨）

より安定した接続のために、永続的なトンネルを作成：

1. Cloudflareにログイン：
```bash
cloudflared tunnel login
```
ブラウザが開くので、Cloudflareアカウントでログインします。

2. トンネルを作成：
```bash
cloudflared tunnel create cc-anywhere
```

3. 認証情報を確認：
```bash
cloudflared tunnel list
```

4. トンネルのトークンを取得：
```bash
cloudflared tunnel token cc-anywhere
```

5. `.env`ファイルにトークンを設定：
```bash
# Tunnel設定
TUNNEL_TYPE=cloudflare
CLOUDFLARE_TUNNEL_TOKEN=your-tunnel-token-here
SHOW_QR_CODE=true
```

6. アプリケーションを起動：
```bash
npm run dev
```

### 方法3: カスタムドメイン（上級者向け）

独自ドメインを使用する場合：

1. Cloudflareダッシュボードでドメインを追加
2. DNSレコードを設定
3. トンネルルーティングを設定

詳細は[Cloudflare公式ドキュメント](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/)を参照。

## 接続確認

起動後、以下のような表示が出ます：

```
========================================
🌐 External Access Information (cloudflare)
========================================

📡 Cloudflare URL: https://example.trycloudflare.com
🔒 API Key: your-api-key

🌍 Web UI Access:
   https://example.trycloudflare.com/?apiKey=your-api-key

📱 API Access:
   curl -H "X-API-Key: your-api-key" https://example.trycloudflare.com/api/tasks
========================================
```

## トラブルシューティング

### cloudflaredが見つからない
```bash
# PATHを確認
echo $PATH

# 手動でPATHに追加
export PATH="/usr/local/bin:$PATH"
```

### トンネルが起動しない
```bash
# ログを確認
pm2 logs cc-anywhere

# cloudflaredを直接実行してテスト
cloudflared tunnel --url http://localhost:5000
```

### 認証エラー
```bash
# 再ログイン
cloudflared tunnel logout
cloudflared tunnel login
```

## セキュリティ設定

### アクセス制御

Cloudflare Access（Zero Trust）を使用して、アクセス制御を設定できます：

1. Cloudflareダッシュボード → Zero Trust
2. Access → Applications → Create Application
3. アクセスポリシーを設定（例：メールドメイン制限）

### ファイアウォール

Cloudflare WAFを使用して、悪意のあるトラフィックをブロック：

1. Security → WAF
2. ルールを作成

## PM2での自動起動

PM2起動スクリプトは自動的にCloudflare Tunnelを検出して使用します：

```bash
./scripts/start-pm2.sh
```

## ngrokからの移行

1. `.env`ファイルを更新：
```bash
# 変更前
ENABLE_NGROK=true

# 変更後
TUNNEL_TYPE=cloudflare
ENABLE_NGROK=false
```

2. アプリケーションを再起動

## 参考リンク

- [Cloudflare Tunnel公式ドキュメント](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/)
- [cloudflared GitHub](https://github.com/cloudflare/cloudflared)
- [Cloudflare Zero Trust](https://www.cloudflare.com/zero-trust/)
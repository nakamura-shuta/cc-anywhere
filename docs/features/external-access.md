# 外部アクセス機能

CC-Anywhereを外部ネットワークからアクセス可能にする方法を説明します。

## 概要

CC-Anywhereは以下の2つの方法で外部アクセスを提供します：

1. **Cloudflare Tunnel**（推奨） - セキュアで安定した接続
2. **ngrok** - 簡単な一時的アクセス

## Cloudflare Tunnel（推奨）

### メリット

- ✅ 無料で無制限使用
- ✅ 安定した接続
- ✅ カスタムドメイン対応
- ✅ エンタープライズ対応
- ✅ Zero Trust統合可能

### セットアップ

#### 1. cloudflaredのインストール

```bash
# macOS
brew install cloudflare/cloudflare/cloudflared

# Linux
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o cloudflared
chmod +x cloudflared
sudo mv cloudflared /usr/local/bin/
```

#### 2. 設定

`.env`ファイルに追加：

```env
# Cloudflare Tunnelを使用
TUNNEL_TYPE=cloudflare
SHOW_QR_CODE=true
```

#### 3. 起動

```bash
npm run dev
# または
./scripts/start-pm2.sh
```

自動的にトンネルが作成され、URLが表示されます：

```
========================================
🌐 External Access Information (cloudflare)
========================================

📡 Cloudflare URL: https://example.trycloudflare.com
🔒 API Key: your-api-key

🌍 Web UI Access:
   https://example.trycloudflare.com/?apiKey=your-api-key
```

### 永続的なトンネル（上級者向け）

固定URLが必要な場合：

```bash
# Cloudflareにログイン
cloudflared tunnel login

# トンネル作成
cloudflared tunnel create cc-anywhere

# トークン取得
cloudflared tunnel token cc-anywhere
```

`.env`に設定：

```env
CLOUDFLARE_TUNNEL_TOKEN=your-tunnel-token
```

## ngrok（簡易アクセス）

### セットアップ

`.env`ファイル：

```env
TUNNEL_TYPE=ngrok
# または後方互換性のため
ENABLE_NGROK=true
```

### 使用方法

```bash
npm run dev
```

URLが自動的に表示されます。

## セキュリティ設定

### API認証（必須）

外部公開時は必ずAPI認証を有効にしてください：

```env
API_KEY=secure-random-key-here
```

### Cloudflare Access（推奨）

Cloudflare Zero Trustでアクセス制御：

1. Cloudflareダッシュボード → Zero Trust
2. Access → Applications → Create
3. ポリシー設定（メールドメイン制限など）

## モバイルアクセス

### QRコード表示

```env
SHOW_QR_CODE=true
```

起動時にQRコードが表示され、スマートフォンで簡単にアクセスできます。

## トラブルシューティング

### Cloudflare Tunnelが起動しない

```bash
# cloudflaredの確認
cloudflared --version

# 直接テスト
cloudflared tunnel --url http://localhost:5000
```

### URLが表示されない

```bash
# ログ確認
pm2 logs cc-anywhere | grep -i tunnel

# または専用スクリプト
./scripts/show-cloudflare-url.sh
```

### アクセスできない

1. ファイアウォール設定を確認
2. API_KEYが正しく設定されているか確認
3. ポートが正しいか確認（デフォルト: 5000）

## ベストプラクティス

1. **本番環境ではCloudflare Tunnelを使用**
   - ngrokは開発・デモ用途に限定

2. **必ずAPI認証を有効化**
   - 外部公開時は特に重要

3. **アクセスログの監視**
   ```bash
   pm2 logs cc-anywhere | grep "API request"
   ```

4. **定期的なトークンローテーション**
   - セキュリティ向上のため

## 関連ドキュメント

- [Cloudflare Tunnel公式](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/)
- [セキュリティガイド](../operations/security.md)
- [PM2運用ガイド](../operations/pm2-setup.md)
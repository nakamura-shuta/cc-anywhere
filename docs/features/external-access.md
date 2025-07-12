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

Cloudflare Tunnelの詳細なセットアップ手順については、[専用ガイド](../cloudflare-tunnel-setup-guide.md)を参照してください。

#### クイックスタート

```bash
# 1. cloudflaredのインストールが必要
brew install cloudflare/cloudflare/cloudflared  # macOS

# 2. 環境変数を設定
echo "TUNNEL_TYPE=cloudflare" >> .env

# 3. サーバーを起動
npm run dev
```

これで自動的に一時的なトンネル（`*.trycloudflare.com`）が作成されます。

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
tail -f server.log | grep -i tunnel

# または専用スクリプト
./scripts/tunnel-manager.sh show
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
   tail -f server.log | grep "API request"
   ```

4. **定期的なトークンローテーション**
   - セキュリティ向上のため

## 関連ドキュメント

- [Cloudflare Tunnel詳細セットアップガイド](../cloudflare-tunnel-setup-guide.md)
- [Cloudflare Tunnel公式](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/)
- [セキュリティガイド](../operations/security.md)
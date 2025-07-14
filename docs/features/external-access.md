# 外部アクセス機能

CC-Anywhereを外部ネットワークからアクセス可能にする方法です。

## Cloudflare Tunnel（推奨）

### セットアップ

1. **cloudflaredのインストール**
```bash
# macOS
brew install cloudflare/cloudflare/cloudflared

# 確認
cloudflared --version
```

2. **環境変数の設定**
```bash
# .envファイル
TUNNEL_TYPE=cloudflare
API_KEY=your-secure-api-key
SHOW_QR_CODE=true  # QRコード表示（オプション）
```

3. **起動**
```bash
npm run dev
```

起動時に表示されるURLでアクセスできます。

### 特徴
- ✅ 無料・無制限
- ✅ 安定した接続
- ✅ QRコードでモバイルアクセス
- ✅ エンタープライズ対応

## ngrok（簡易アクセス）

```bash
# .envファイル
TUNNEL_TYPE=ngrok

# 起動
npm run dev
```

## セキュリティ

外部公開時は必ず以下を設定してください：

- **APIキー認証**: `.env`で`API_KEY`を設定
- **HTTPS**: 自動的に有効化されます
- **アクセス制限**: 必要に応じてCloudflare Accessを設定

## トラブルシューティング

### 接続できない場合
```bash
# Cloudflare Tunnelの直接テスト
cloudflared tunnel --url http://localhost:5000

# ログ確認
pm2 logs cc-anywhere
```

### ポート競合の場合
```bash
# 別のポートで起動
PORT=3001 npm run dev
```
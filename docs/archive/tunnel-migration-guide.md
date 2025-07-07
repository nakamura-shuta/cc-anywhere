# ngrokからCloudflare Tunnelへの移行ガイド

## 移行手順

### 1. cloudflaredのインストール

```bash
# macOS (Homebrew)
brew install cloudflare/cloudflare/cloudflared

# 確認
cloudflared --version
```

### 2. 環境変数の更新

`.env`ファイルを編集：

```bash
# 変更前（ngrok）
ENABLE_NGROK=true

# 変更後（Cloudflare Tunnel）
TUNNEL_TYPE=cloudflare
ENABLE_NGROK=false
SHOW_QR_CODE=true
```

### 3. アプリケーションの再起動

```bash
# PM2を使用している場合
pm2 restart cc-anywhere

# または通常の起動
npm run dev
```

### 4. URL確認

```bash
# Cloudflare URLを表示
./scripts/show-cloudflare-url.sh

# またはログから確認
pm2 logs cc-anywhere | grep cloudflare
```

## 設定オプション

### クイックトンネル（簡単・一時的）
```env
TUNNEL_TYPE=cloudflare
# トークン不要、起動するたびに新しいURL
```

### 永続トンネル（推奨）
```env
TUNNEL_TYPE=cloudflare
CLOUDFLARE_TUNNEL_TOKEN=your-tunnel-token-here
# 同じURLを維持
```

## 比較表

| 機能 | ngrok | Cloudflare Tunnel |
|------|-------|------------------|
| 無料枠 | 制限あり | 無制限 |
| カスタムドメイン | 有料 | 無料 |
| 接続安定性 | 普通 | 高い |
| 企業利用 | 制限あり | 推奨 |
| セットアップ | 簡単 | やや複雑 |

## トラブルシューティング

### Q: URLが表示されない
A: cloudflaredがインストールされているか確認してください。

### Q: 以前のngrok URLにアクセスできない
A: Cloudflare Tunnelは異なるURLを使用します。新しいURLを確認してください。

### Q: どちらも使いたい場合
A: `TUNNEL_TYPE=none`にして、手動でngrokまたはcloudflaredを起動することも可能です。

## ロールバック

ngrokに戻す場合：
```env
TUNNEL_TYPE=ngrok
# または
TUNNEL_TYPE=none
ENABLE_NGROK=true
```
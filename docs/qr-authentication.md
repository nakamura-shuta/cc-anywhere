# QRコード認証機能

## 概要

CC-AnywhereのQRコードアクセス時にクエリパラメータベースの認証機能を実装しました。これにより、ngrokやCloudflare Tunnelで外部公開した際のセキュリティが強化されます。

## 機能

### 認証フロー

1. **QRコード生成時**: URLに認証トークン（`auth_token`）が自動付与されます
2. **初回アクセス**: QRコードをスキャンすると、認証トークンが検証されます
3. **認証成功**: トークンがブラウザに保存され、以降は自動的に認証されます
4. **API呼び出し**: すべてのAPIリクエストに認証トークンが自動付与されます

### セキュリティ特徴

- トークンは環境変数で管理（gitignoreで保護）
- 一度認証すれば24時間有効（設定可能）
- 既存のAPI Key認証と共存可能
- 開発環境では無効化可能

## 設定方法

### 1. 環境変数の設定

`.env`ファイルに以下を追加：

```bash
# QR認証設定
QR_AUTH_TOKEN=your-secure-token-here  # 最低5文字以上推奨
QR_AUTH_ENABLED=true                   # 認証機能の有効/無効
QR_AUTH_SESSION_DURATION=86400000      # セッション有効期限（ミリ秒、デフォルト24時間）
```

### 2. 起動と確認

```bash
# クラムシェルモードで起動
./scripts/start-clamshell.sh

# 表示されるQRコードには自動的に認証トークンが含まれます
```

### 3. 認証の確認

起動時のログに以下が表示されます：

```
🔐 QR Auth: Enabled (token set)
🌍 Web UI Access:
   https://example.ngrok.io/?auth_token=your-secure-token-here
```

## 使用方法

### エンドユーザー向け

1. 管理者から提供されたQRコードをスマートフォンでスキャン
2. 自動的に認証され、CC-Anywhereにアクセス可能
3. 一度認証すれば24時間は再認証不要

### 管理者向け

1. `.env`で`QR_AUTH_TOKEN`を設定（ランダムな文字列を推奨）
2. `start-clamshell.sh`でサーバーを起動
3. 表示されたQRコードをユーザーに共有

## トラブルシューティング

### 認証エラーが表示される場合

1. `.env`の`QR_AUTH_TOKEN`が正しく設定されているか確認
2. `QR_AUTH_ENABLED=true`になっているか確認
3. QRコードを再スキャンしてみる

### トークンを変更したい場合

1. `.env`の`QR_AUTH_TOKEN`を新しい値に変更
2. サーバーを再起動
3. 新しいQRコードを配布

### 認証を無効化したい場合

`.env`で以下を設定：

```bash
QR_AUTH_ENABLED=false
```

## 技術詳細

### バックエンド

- **認証ミドルウェア**: `/backend/src/server/middleware/qr-auth.ts`
  - すべてのAPIエンドポイントで認証チェック
  - ヘッダー（`X-Auth-Token`）またはクエリパラメータで認証

- **QRコード生成**: `/backend/src/utils/tunnel/manager.ts`
  - トンネルURL生成時に自動的にトークンを付与

### フロントエンド

- **認証ストア**: `/frontend/src/lib/stores/auth.svelte.ts`
  - トークンの保存と管理
  - 自動的な認証状態の復元

- **ルートガード**: `/frontend/src/routes/+layout.ts`
  - 全ページで認証チェック
  - 未認証時は認証エラーページへリダイレクト

- **APIクライアント**: `/frontend/src/lib/api/client.ts`
  - すべてのAPIリクエストに認証ヘッダーを自動付与

## セキュリティ推奨事項

1. **トークンの強度**: 推測困難な長い文字列を使用（32文字以上推奨）
2. **定期的な変更**: トークンは定期的に変更することを推奨
3. **アクセスログ**: 不正アクセスの監視のためログを確認
4. **HTTPS必須**: ngrok/Cloudflare Tunnelは自動的にHTTPS化されます

## 将来の拡張

- 複数トークン対応（ユーザー別管理）
- トークンの有効期限管理
- 2要素認証の追加
- アクセスログの詳細記録
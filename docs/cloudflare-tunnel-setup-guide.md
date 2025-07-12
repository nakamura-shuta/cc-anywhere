# Cloudflare Tunnel設定ガイド

このガイドでは、cc-anywhereをCloudflare Tunnelで外部公開する手順を説明します。

## 前提条件

- Cloudflareアカウント（無料プランでOK）
- Cloudflare API認証情報（Email、API Key、Account ID）
- Node.js環境（cc-anywhereが動作する環境）

## 設定方法

### 既存のトンネルがある場合（例: cc-anywhere-1751864640）

既にCloudflareダッシュボードでトンネルを作成済みの場合：

1. **トークンの確認**
   - [Cloudflare Zero Trust Dashboard](https://one.dash.cloudflare.com/)にログイン
   - Access > Tunnels から既存のトンネルを選択
   - 「Configure」タブで設定を確認

2. **新しいトークンが必要な場合**
   - トンネルの「Configure」ページで「Rotate token」をクリック
   - 新しいトークンをコピー

3. **.envファイルの設定**
   ```env
   TUNNEL_TYPE=cloudflare
   CLOUDFLARE_TUNNEL_TOKEN=your-existing-tunnel-token
   CLOUDFLARE_TUNNEL_NAME=cc-anywhere-1751864640
   API_KEY=your-secure-api-key
   ```

### 方法1: 自動セットアップスクリプトを使用（CLI管理）

```bash
# セットアップスクリプトを実行
./scripts/setup-cloudflare-tunnel.sh
```

#### スクリプトの機能

1. **トンネルの作成・管理**
   - Cloudflare APIを使用してトンネルを自動作成
   - 既存トンネルの検出と削除オプション
   - トンネル名の自動生成 or カスタム名の指定

2. **必要な認証情報**
   - Cloudflare Email
   - Global API Key（[プロファイル設定](https://dash.cloudflare.com/profile/api-tokens)から取得）
   - Account ID（ダッシュボードのサイドバーで確認）

3. **自動設定される内容**
   ```env
   TUNNEL_TYPE=cloudflare
   CLOUDFLARE_TUNNEL_TOKEN=自動生成されたトークン
   CLOUDFLARE_TUNNEL_NAME=指定したトンネル名
   ```

4. **オプション機能**
   - カスタムドメインの設定
   - DNSレコードの自動作成
   - サブドメインの指定（例: cc-anywhere.yourdomain.com）

#### APIトークンの権限設定

スクリプトを使用する場合、以下の権限が必要：
- Account > Cloudflare Tunnel: Edit
- Zone > Zone: Read
- Zone > DNS: Edit（カスタムドメイン使用時）

### 方法2: Cloudflareダッシュボードを使用した手動設定

#### 1. Cloudflare Zero Trustダッシュボードでトンネルを作成

1. **Cloudflare Zero Trustにアクセス**
   - [https://one.dash.cloudflare.com/](https://one.dash.cloudflare.com/)にログイン
   - 初回アクセス時はZero Trustプランの選択が必要（無料プランでOK）

2. **トンネルの作成**
   - 左メニューから「Access」→「Tunnels」を選択
   - 「Create a tunnel」ボタンをクリック
   - トンネルタイプは「Cloudflared」を選択して「Next」

3. **トンネル名の設定**
   - トンネル名を入力（例: `cc-anywhere-1751864640`）
   - 「Save tunnel」をクリック
   - ※この名前は後で変更できません

4. **トークンの取得**
   - 次の画面で表示される長いトークンをコピー
   - このトークンは以下のような形式：
     ```
     eyJhIjoixxxxx...（非常に長い文字列）
     ```
   - ※このトークンは後で再表示できないので必ず保存

5. **Public Hostnameの設定（オプション）**
   - 「Next」をクリックしてPublic Hostnameの設定画面へ
   - 今は設定せずに「Save tunnel」で完了してもOK
   - 後でダッシュボードから設定可能

#### 2. 環境変数を設定

`.env`ファイルに以下を設定：

```env
# トンネルタイプをcloudflareに設定
TUNNEL_TYPE=cloudflare

# Cloudflareトンネルトークン（Dashboard から取得）
CLOUDFLARE_TUNNEL_TOKEN=your-tunnel-token-here

# トンネル名（任意、デフォルトは "cc-anywhere"）
CLOUDFLARE_TUNNEL_NAME=cc-anywhere-1751864640

# API認証（外部公開時は必須）
API_KEY=your-secure-api-key
```

#### 3. cloudflared-config.yml を設定（オプション）

既存のトンネルを使用する場合は、`cloudflared-config.yml`は不要です。
トークンに全ての設定が含まれています。

### 方法3: クイックトンネル（一時的な利用）

トークンなしで一時的なトンネルを作成：

```env
TUNNEL_TYPE=cloudflare
# CLOUDFLARE_TUNNEL_TOKEN は設定しない
```

この場合、`*.trycloudflare.com`のランダムなURLが割り当てられます。

## トンネル管理

### トンネルの起動

```bash
# サーバーとトンネルを同時に起動
npm run dev

# または個別に起動
./scripts/start-cloudflare.sh
```

### tunnel-manager.sh による管理

`tunnel-manager.sh` は、トンネルの設定と管理を簡単に行うためのツールです：

```bash
# 使用可能なコマンド
./scripts/tunnel-manager.sh [コマンド]

# setup - 初期設定（ngrok/Cloudflare選択）
./scripts/tunnel-manager.sh setup

# show - 現在のトンネル情報を表示
./scripts/tunnel-manager.sh show

# switch - トンネルタイプの切り替え
./scripts/tunnel-manager.sh switch cloudflare
./scripts/tunnel-manager.sh switch ngrok
./scripts/tunnel-manager.sh switch none

# qr - QRコードを再表示
./scripts/tunnel-manager.sh qr

# status - トンネルの動作状態を確認
./scripts/tunnel-manager.sh status
```

### トンネルの削除・再作成

既存のトンネルを削除して新規作成する場合：

```bash
# setup-cloudflare-tunnel.sh を実行
./scripts/setup-cloudflare-tunnel.sh

# 既存トンネルが検出された場合の選択肢:
# - y: 削除して新規作成
# - N: 新しい名前で作成（タイムスタンプ付加）
```

## CLOUDFLARE_TUNNEL_NAME について

- **固定ではありません** - 任意の名前を設定可能
- デフォルト値: `"cc-anywhere"`
- 自動生成形式: `cc-anywhere-{timestamp}`
- あなたの場合: `cc-anywhere-1751864640` を使用

トンネル名は識別用であり、実際の接続にはトークンが使用されます。

## セキュリティ設定

### 1. API認証の有効化

外部公開時は必ずAPI認証を設定：

```env
API_KEY=your-secure-api-key-here
ENABLE_AUTH=true
```

### 2. Cloudflare Access Policy（オプション）

Zero Trust Dashboardで追加のアクセス制御を設定可能：
- IPアドレス制限
- メールアドレスによる認証
- デバイス認証

### 3. 本番環境のベストプラクティス

- トークンは環境変数で管理（コードに含めない）
- 定期的なトークンローテーション
- アクセスログの監視
- Rate Limiting の設定

## トラブルシューティング

### "context canceled" エラーが発生する

このエラーは通常、以下の理由で発生します：

1. **トークンが無効または期限切れ**
   - ダッシュボードでトークンをローテート
   - または新しいトンネルを作成

2. **トンネルが他の場所で実行中**
   - ダッシュボードでアクティブなコネクターを確認
   - 必要に応じて既存の接続を切断

3. **ネットワーク接続の問題**
   - Cloudflare Edgeへの接続を確認：`ping 198.41.192.37`

### トンネルが起動しない

```bash
# cloudflaredがインストールされているか確認
which cloudflared

# インストールされていない場合
brew install cloudflared  # macOS
# または https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/
```

### 接続エラー

1. トークンが正しいか確認
2. ネットワーク接続を確認
3. Cloudflare Dashboardでトンネルステータスを確認

### ログの確認

```bash
# サーバーのログを確認
tail -f server.log | grep -i tunnel

# クイックトンネルでは以下のようなログが表示されます：
# "Cloudflare quick tunnel established" 
# "cloudflare tunnel is ready at https://xxx.trycloudflare.com"

# トークンモードでは以下のようなログが表示されます：
# "Registered tunnel connection"
# "Cloudflare tunnel registered"
```

## まとめ

cc-anywhereは以下の3つの方法でCloudflare Tunnelを利用できます：

1. **既存トンネルの利用** - ダッシュボードで作成済みのトンネルトークンを使用
2. **CLI自動作成** - setup-cloudflare-tunnel.shでAPI経由で作成・管理
3. **クイックトンネル** - トークンなしで一時的なトンネルを作成

推奨される使用方法：
- **開発環境**: クイックトンネル or ngrok
- **本番環境**: Cloudflare Tunnelトークンモード（CLI or ダッシュボード作成）
- **チーム共有**: カスタムドメインを設定したCloudflare Tunnel

## トークンモードでURLを設定する方法

トークンモードでは、トンネルのURLは自動的に表示されません。以下の方法でURLを設定できます：

### 方法1: カスタムドメインを使用

Cloudflareダッシュボードでドメインを設定し、環境変数で指定：

```env
CLOUDFLARE_TUNNEL_URL=https://cc-anywhere.yourdomain.com
```

### 方法2: トンネルIDを使用

トンネルIDを使用したデフォルトURL：

```
https://<tunnel-id>.cfargotunnel.com
```

トンネルIDはダッシュボードまたはトークンから確認できます。

## 参考リンク

- [Cloudflare Tunnel Documentation](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/)
- [Zero Trust Dashboard](https://one.dash.cloudflare.com/)
- [cc-anywhere External Access Guide](./features/external-access.md)
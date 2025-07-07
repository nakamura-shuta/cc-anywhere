# CC-Anywhere スクリプト

このディレクトリには、CC-Anywhereの運用と管理のためのスクリプトが含まれています。

## 主要スクリプト

### 🚀 起動・停止

#### `start-clamshell.sh`
MacBookを閉じてもサーバーが動作し続けるクラムシェルモードで起動します。
- PM2によるプロセス管理
- caffeinateによるスリープ防止
- ngrok/Cloudflareの自動設定
- QRコード表示でスマートフォンアクセス可能

```bash
./scripts/start-clamshell.sh
```

#### `pm2-manager.sh`
PM2を使用したプロセス管理の包括的なツールです。

```bash
./scripts/pm2-manager.sh start    # 起動
./scripts/pm2-manager.sh stop     # 停止
./scripts/pm2-manager.sh status   # 状態確認
./scripts/pm2-manager.sh logs     # ログ表示
./scripts/pm2-manager.sh restart  # 再起動
```

#### `quick-start.sh`
初回セットアップと起動を自動化します。
- 依存関係のチェックとインストール
- ビルド実行
- PM2起動

```bash
./scripts/quick-start.sh
```

### 🌐 トンネル管理

#### `tunnel-manager.sh`
ngrokとCloudflare Tunnelの統合管理ツールです。

```bash
./scripts/tunnel-manager.sh setup   # トンネル設定
./scripts/tunnel-manager.sh show    # URL表示
./scripts/tunnel-manager.sh qr      # QRコード表示
./scripts/tunnel-manager.sh status  # 状態確認
./scripts/tunnel-manager.sh switch  # トンネル切り替え
```

#### `setup-cloudflare-tunnel.sh`
Cloudflare Tunnel をAPIで自動セットアップします。

```bash
./scripts/setup-cloudflare-tunnel.sh
```

機能：
- Cloudflare APIを使用して新しいトンネルを作成
- 認証トークンを自動生成
- `.env`ファイルを自動更新
- オプションでカスタムドメインのDNS設定も可能

### 📱 QRコード表示

#### `show-qr-direct.sh`
保存されたQRコードを直接表示します（PM2のタイムスタンプ問題を回避）。

```bash
./scripts/show-qr-direct.sh
```

### 🧪 テスト・デバッグ

#### `test-batch-tasks.sh`
バッチタスク機能のテストスクリプトです。

#### `test-queue.sh`
キューシステムのテストスクリプトです。

#### `test-persistence.sh`
データ永続化のテストスクリプトです。

### 📁 testディレクトリ

`test/`ディレクトリには、Worktree機能専用のテストスクリプトが含まれています：

- `worktree-tests.sh` - Worktree機能の統合テスト
- `run-all-worktree-tests.sh` - 包括的なWorktreeテストスイート
- `cleanup-worktrees.sh` - Worktreeのクリーンアップ

詳細は[test/README.md](./test/README.md)を参照してください。

## 使用例

### 典型的な起動フロー

1. **初回起動（クラムシェルモード）**
   ```bash
   ./scripts/start-clamshell.sh
   ```
   - 外部アクセス方法を選択（ngrok/Cloudflare/なし）
   - QRコードが表示される
   - MacBookを閉じてもアクセス可能

2. **トンネル設定の変更**
   ```bash
   ./scripts/tunnel-manager.sh switch
   ./scripts/pm2-manager.sh restart
   ```

3. **状態確認とログ**
   ```bash
   ./scripts/pm2-manager.sh status
   ./scripts/pm2-manager.sh logs
   ```

4. **停止**
   ```bash
   ./scripts/pm2-manager.sh stop
   ```

## 環境変数

主要な環境変数（.envファイル）：

- `TUNNEL_TYPE` - トンネルタイプ（none/ngrok/cloudflare）
- `ENABLE_NGROK` - ngrok有効化（レガシー、TUNNEL_TYPEを推奨）
- `CLOUDFLARE_TUNNEL_TOKEN` - Cloudflareトンネルトークン
- `SHOW_QR_CODE` - QRコード表示（true/false）

## トラブルシューティング

### PM2が見つからない
```bash
npm install -g pm2
# nodenvを使用している場合
nodenv rehash
```

### ポートが使用中
```bash
# .envでPORTを変更
PORT=3000
```

### caffeinateが動作しない
macOS専用機能です。他のOSでは無視されます。

## 廃止されたスクリプト

以下のスクリプトは機能統合により廃止されました：

- `show-cloudflare-url.sh` → `tunnel-manager.sh show`
- `show-ngrok-url.sh` → `tunnel-manager.sh show`
- `start-pm2.sh` → `pm2-manager.sh start` または `start-clamshell.sh`
- `stop-pm2.sh` → `pm2-manager.sh stop`
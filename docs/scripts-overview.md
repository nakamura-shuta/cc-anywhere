# CC-Anywhere スクリプト一覧と使い分け

## 📊 スクリプト使い分け早見表

| 用途 | 推奨スクリプト | 説明 |
|------|---------------|------|
| **通常の開発作業** | `start-dev.sh` | ホットリロード有効の開発サーバー |
| **モバイルからアクセス** | `start-clamshell.sh` | ngrok/Cloudflare Tunnel経由でモバイルアクセス |
| **本番環境** | `start-production.sh` | PM2による本番サーバー起動 |
| **ビルド** | `build-all.sh` | フロントエンド・バックエンド統合ビルド |
| **停止** | `stop-all.sh` | すべてのプロセスを停止 |

## 🚀 起動スクリプト詳細

### 1. `start-dev.sh` - 開発環境用
**用途**: 日常的な開発作業

```bash
./scripts/start-dev.sh
```

**特徴**:
- ホットリロード有効（ファイル変更を自動検知）
- tmux対応（複数ウィンドウで起動）
- フロントエンド: http://localhost:4444
- バックエンド: http://localhost:5000
- デバッグモード有効

**使うべき場面**:
- コード開発・デバッグ時
- ローカル環境でのテスト
- 頻繁にコード変更する場合

---

### 2. `start-clamshell.sh` - モバイルアクセス用
**用途**: MacBookを閉じた状態でスマートフォンからアクセス

```bash
./scripts/start-clamshell.sh
```

**特徴**:
- スリープ防止機能（caffeinate）
- 外部アクセス方法を選択可能:
  1. ngrok（簡単・一時的なURL）
  2. Cloudflare Tunnel（固定URL）
  3. なし（ローカルのみ）
- QRコード表示（モバイルアクセス用）
- 自動的にURLとQRコードを表示

**使うべき場面**:
- 外出先からスマートフォンでアクセス
- MacBookをクラムシェルモードで使用
- チーム内で一時的に共有
- デモンストレーション

---

### 3. `start-production.sh` - 本番環境用
**用途**: 本番環境でのサーバー運用

```bash
./scripts/start-production.sh
```

**特徴**:
- PM2プロセスマネージャーで管理
- 自動再起動（クラッシュ時）
- システム起動時の自動起動設定
- ログローテーション対応
- プロダクション最適化

**使うべき場面**:
- 本番環境へのデプロイ
- 24時間365日稼働させる場合
- 安定性を重視する場合
- サーバーで常時稼働

**事前準備**:
1. ビルド済みであること（`./scripts/build-all.sh`）
2. PM2インストール済み（`pnpm install -g pm2`）
3. `.env`ファイル設定済み

---

## 🛠️ ユーティリティスクリプト

### `build-all.sh` - 統合ビルド
```bash
./scripts/build-all.sh
```
- フロントエンドとバックエンドを統合ビルド
- 本番環境用にフロントエンドを`backend/web`に配置
- デプロイ前に必須

### `stop-all.sh` - 全プロセス停止
```bash
./scripts/stop-all.sh
```
- すべてのCC-Anywhereプロセスを停止
- PM2、開発サーバー、tmux、caffeinateを停止
- ポート5000を解放

### `pm2-manager.sh` - PM2管理
```bash
./scripts/pm2-manager.sh [start|stop|restart|logs|status]
```
- PM2プロセスの管理
- ログ確認
- 状態確認

### `tunnel-manager.sh` - トンネル管理
```bash
./scripts/tunnel-manager.sh [ngrok|cloudflare] [start|stop]
```
- ngrok/Cloudflare Tunnelの起動・停止
- URLの取得
- QRコード生成

### `setup-cloudflare-tunnel.sh` - Cloudflare初期設定
```bash
./scripts/setup-cloudflare-tunnel.sh
```
- Cloudflare Tunnelの初期設定
- 認証情報の設定
- 固定URLの取得

## 📝 シナリオ別使い分けガイド

### シナリオ1: 通常の開発作業
```bash
# 開発サーバー起動
./scripts/start-dev.sh

# 作業終了時
./scripts/stop-all.sh
```

### シナリオ2: スマートフォンでテスト
```bash
# クラムシェルモードで起動
./scripts/start-clamshell.sh
# → 「1) ngrok」を選択
# → QRコードをスマートフォンでスキャン

# 作業終了時
./scripts/stop-all.sh
```

### シナリオ3: 本番環境へデプロイ
```bash
# 1. ビルド
./scripts/build-all.sh

# 2. 本番起動
./scripts/start-production.sh

# 3. ログ確認
pm2 logs cc-anywhere-backend

# 4. 停止する場合
./scripts/stop-all.sh
```

### シナリオ4: チームメンバーとの共有
```bash
# Cloudflare Tunnel使用（固定URL）
./scripts/start-clamshell.sh
# → 「2) Cloudflare Tunnel」を選択
# → 固定URLを共有

# または事前にセットアップ済みの場合
./scripts/tunnel-manager.sh cloudflare start
```

## ⚠️ 注意事項

### ポート競合
- ポート5000が既に使用されている場合は、まず`stop-all.sh`を実行

### 権限設定
```bash
chmod +x scripts/*.sh
```

### 依存関係
- PM2: `pnpm install -g pm2`
- tmux（オプション）: `brew install tmux`
- ngrok（オプション）: `brew install ngrok`

## トラブルシューティング

### Q: どのスクリプトを使えばいいか分からない
A: 
- 開発中 → `start-dev.sh`
- スマホでテスト → `start-clamshell.sh`
- サーバー運用 → `start-production.sh`

### Q: ポート5000が使用中エラー
A:
```bash
./scripts/stop-all.sh
# または
lsof -i :5000 | grep LISTEN
kill -9 <PID>
```

### Q: PM2が見つからない
A:
```bash
pnpm install -g pm2
```

### Q: ngrokのURLが表示されない
A:
```bash
# ngrok設定を確認
ngrok config add-authtoken YOUR_AUTH_TOKEN
```
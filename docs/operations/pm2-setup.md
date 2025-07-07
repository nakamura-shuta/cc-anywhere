# PM2 + クラムシェルモード セットアップガイド

CC-AnywhereをPM2で管理し、MacBookを閉じても（クラムシェルモード）動作し続けるように設定する方法を説明します。

## 前提条件

1. **PM2のインストール**
   ```bash
   npm install -g pm2
   ```

2. **macOS**（caffeinateコマンド使用のため）

## セットアップ

### 1. PM2でアプリケーションを起動

最も簡単な方法：
```bash
./scripts/start-pm2.sh
```

このスクリプトは以下を実行します：
- ビルドの確認と実行
- PM2でアプリケーションを起動
- スリープ防止（caffeinate）を有効化
- 自動起動の設定

### 2. 管理コマンド

専用の管理スクリプトを使用：
```bash
# ヘルプを表示
./scripts/pm2-manager.sh

# ステータス確認
./scripts/pm2-manager.sh status

# ログ表示
./scripts/pm2-manager.sh logs

# 再起動
./scripts/pm2-manager.sh restart

# 停止
./scripts/pm2-manager.sh stop
```

### 3. PM2エコシステムファイル

より詳細な設定は `ecosystem.config.js` を編集：
```javascript
module.exports = {
  apps: [{
    name: 'cc-anywhere',
    script: './dist/index.js',
    instances: 1,
    max_memory_restart: '1G',
    // その他の設定...
  }]
}
```

## クラムシェルモードでの動作

### スリープ防止の仕組み

起動スクリプトは自動的に `caffeinate` コマンドを実行します：
```bash
caffeinate -disu &
```

オプションの意味：
- `-d`: ディスプレイスリープを防ぐ
- `-i`: システムアイドルスリープを防ぐ
- `-s`: システムスリープを防ぐ
- `-u`: ユーザーがアクティブであるかのように振る舞う

### 確認方法

1. **プロセスの確認**
   ```bash
   # PM2プロセス
   pm2 status cc-anywhere
   
   # caffeinateプロセス
   ps aux | grep caffeinate
   ```

2. **動作テスト**
   - MacBookを閉じる
   - 外部からアクセス（ngrok URL経由など）
   - 正常にレスポンスが返ることを確認

## 自動起動設定

システム起動時に自動的にCC-Anywhereを起動：

```bash
# PM2の起動スクリプトを生成
pm2 startup

# 現在の状態を保存
pm2 save
```

## トラブルシューティング

### アプリケーションが停止する場合

1. **ログを確認**
   ```bash
   pm2 logs cc-anywhere --lines 100
   ```

2. **メモリ不足の場合**
   ```bash
   # ecosystem.config.jsで制限を調整
   max_memory_restart: '2G'
   ```

3. **caffeinate が効かない場合**
   - システム環境設定 > 省エネルギー を確認
   - 「電源アダプタ接続時はコンピュータを自動でスリープさせない」を有効化

### ポートが使用中の場合

```bash
# 使用中のポートを確認
lsof -i :5000

# 強制的に停止
pm2 kill
```

## ベストプラクティス

1. **定期的なログローテーション**
   ```bash
   # ログをクリア
   pm2 flush cc-anywhere
   ```

2. **リソース監視**
   ```bash
   # リアルタイムモニタリング
   pm2 monit
   ```

3. **グレースフルな再起動**
   ```bash
   # ダウンタイムなしで再起動
   pm2 reload cc-anywhere
   ```

## セキュリティ考慮事項

- クラムシェルモードで動作させる場合、物理的なセキュリティを確保
- 適切なファイアウォール設定
- ngrokのURLは必要な人にのみ共有

## 関連ドキュメント

- [PM2公式ドキュメント](https://pm2.keymetrics.io/)
- [macOS caffeinate](https://ss64.com/osx/caffeinate.html)
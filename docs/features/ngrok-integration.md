# ngrok統合

CC-Anywhereは、開発中にローカルサーバーを外部からアクセス可能にするため、ngrok統合を提供しています。

## 概要

ngrok統合により、以下が可能になります：
- ローカル開発サーバーへの一時的な外部アクセス
- HTTPSエンドポイントの自動生成
- APIキー認証と組み合わせた安全なアクセス

## 設定

### 環境変数

`.env`ファイルで以下の設定を行います：

```env
# ngrokを有効化
ENABLE_NGROK=true

# API認証（推奨）
API_KEY=your-secret-api-key
```

### 起動方法

```bash
# .envで設定済みの場合
npm run dev

# 一時的に有効化
ENABLE_NGROK=true npm run dev
```

## 使用方法

1. サーバー起動時、自動的にngrok tunnelが開始されます
2. コンソールに外部アクセス情報が表示されます：

```
========================================
🌐 External Access Information
========================================

📡 ngrok URL: https://xxxx-xxx-xxx-xxx-xxx.ngrok-free.app
🔒 API Key: your-secret-api-key

🌍 Web UI Access:
   https://xxxx-xxx-xxx-xxx-xxx.ngrok-free.app/?apiKey=your-secret-api-key

📱 API Access:
   curl -H "X-API-Key: your-secret-api-key" https://xxxx-xxx-xxx-xxx-xxx.ngrok-free.app/api/tasks

========================================
```

## セキュリティ考慮事項

1. **API認証の使用を強く推奨**
   - ngrokで公開する際は、必ず`API_KEY`を設定してください
   - 認証なしの公開は避けてください

2. **一時的な使用に限定**
   - ngrokは開発・デモ用途での使用を想定しています
   - 本番環境では使用しないでください

3. **URLの共有に注意**
   - ngrok URLは誰でもアクセス可能です
   - APIキー付きのURLを共有する際は注意してください

## トラブルシューティング

### ngrokが起動しない場合

1. ポートが既に使用されていないか確認
```bash
lsof -i:5000
```

2. ngrokの依存関係を再インストール
```bash
npm install --save-dev ngrok
```

### プロセス終了時の注意

- Ctrl+Cでサーバーを停止すると、ngrok tunnelも自動的に切断されます
- 異常終了した場合は、ngrokプロセスが残る可能性があります

```bash
# ngrokプロセスを確認
ps aux | grep ngrok

# 残っているプロセスを終了
killall ngrok
```

## 関連ドキュメント

- [API認証](../api/authentication.md)
- [クイックスタート](../getting-started/quickstart.md)
# CC-Anywhere ドキュメント

CC-Anywhereは、Claude Code SDKを使用してHTTP経由でタスクを実行できるサーバーアプリケーションです。

## 📚 ドキュメント構成

### 🚀 はじめに
- [クイックスタート](./getting-started/quickstart.md) - 5分で始める
- [インストールガイド](./getting-started/installation.md) - 詳細なセットアップ
- [設定ガイド](./getting-started/configuration.md) - 環境変数と設定オプション

### 📡 API
- [APIリファレンス](./api/api-reference.md) - 全エンドポイントの詳細
- [API使用例](./api/api-examples.md) - 実践的なサンプルコード

### 🔧 主要機能
- [Git Worktree](./features/git-worktree.md) - 独立した作業環境での実行
- [外部アクセス](./features/external-access.md) - Cloudflare Tunnel/ngrok統合
- [WebSocket通信](./features/websocket.md) - リアルタイムログとステータス
- [スラッシュコマンド](./features/slash-commands.md) - カスタムコマンド

### 🏗️ アーキテクチャ
- [システム概要](./architecture/overview.md) - 全体アーキテクチャ
- [ワーカーシステム](./architecture/worker-system.md) - 並行タスク処理
- [キューシステム](./architecture/queue-architecture.md) - タスク管理

### 🛠️ 運用
- [PM2運用ガイド](./operations/pm2-setup.md) - プロセス管理とクラムシェルモード
- [タイムアウト処理](./operations/timeout-handling.md) - 高度なタイムアウト制御
- [トラブルシューティング](./operations/troubleshooting.md) - よくある問題と解決方法

### 💻 開発
- [開発環境セットアップ](./development/setup.md) - 開発者向けガイド
- [サンプルコード](./examples/) - 実装例とテンプレート

## 🎯 主な特徴

- **Claude Code SDK統合** - 高度なAI支援タスク実行
- **非同期処理** - ノンブロッキングなタスク実行
- **リアルタイム通信** - WebSocketによるライブアップデート
- **スケーラブル** - ワーカープールによる並行処理
- **セキュア** - APIキー認証とアクセス制御
- **柔軟な設定** - 環境変数による詳細な制御

## 🚦 クイックスタート

```bash
# インストール
git clone https://github.com/your-org/cc-anywhere.git
cd cc-anywhere
npm install

# 環境設定
cp .env.example .env
# .envファイルを編集してCLAUDE_API_KEYを設定

# 起動
npm run dev

# または本番環境向け（PM2使用）
./scripts/quick-start.sh
```

## 📖 関連リソース

- [Claude API ドキュメント](https://docs.anthropic.com/)
- [プロジェクトリポジトリ](https://github.com/your-org/cc-anywhere)
- [問題報告](https://github.com/your-org/cc-anywhere/issues)
# CC-Anywhere ドキュメント

CC-AnywhereはClaude Code SDKを使用してHTTP経由で指示を実行できるサーバーアプリケーションです。

## ドキュメント構成

### 🚀 はじめに
- [インストール](./getting-started/installation.md) - インストール方法
- [設定](./getting-started/configuration.md) - 環境変数と設定ファイル
- [クイックスタート](./getting-started/quickstart.md) - 基本的な使い方

### 📚 APIリファレンス
- [APIリファレンス](./api/api-reference.md) - 全エンドポイントの仕様と使用例

### ✨ 機能ガイド
- [スケジューラー](./features/scheduler.md) - 定期実行とワンタイム実行
- [Git Worktree](./features/git-worktree.md) - 独立した作業環境での実行
- [外部アクセス](./features/external-access.md) - Cloudflare Tunnelによる公開
- [WebSocket](./features/websocket.md) - リアルタイムログ配信
- [プリセット管理](./features/preset-management.md) - 設定の保存と再利用
- [スラッシュコマンド](./features/slash-commands.md) - 特殊なタスク実行

### 🔧 運用ガイド
- [PM2セットアップ](./operations/pm2-setup.md) - プロセス管理の設定
- [トラブルシューティング](./operations/troubleshooting.md) - 問題解決ガイド

### 📋 その他
- [変更履歴](./CHANGELOG.md) - バージョンごとの変更内容
- [アーキテクチャ概要](./architecture/overview.md) - システム設計
- [開発セットアップ](./development/setup.md) - 開発環境の構築

## クイックリンク

- 🌐 Web UI: `http://localhost:5000`
- 📡 API: `http://localhost:5000/api`
- 🔒 APIキー: `.env`ファイルで設定

## サポート

問題が発生した場合は、[トラブルシューティング](./operations/troubleshooting.md)を参照してください。
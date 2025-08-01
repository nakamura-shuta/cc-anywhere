# CC-Anywhere ドキュメント

CC-AnywhereはClaude Code SDKをHTTP経由で利用可能にするAPIサーバーです。

## 🚀 クイックスタート

```bash
# インストール
git clone https://github.com/your-org/cc-anywhere.git
cd cc-anywhere
npm install

# 設定
cp .env.example .env
# .envでCLAUDE_API_KEYを設定

# 起動
npm run dev                    # 開発環境
./scripts/start-production.sh  # 本番環境（PM2）
./scripts/start-clamshell.sh   # クラムシェルモード（外部アクセス）
```

アクセス: http://localhost:5000

## 📚 ドキュメント

- [はじめに](./getting-started/) - インストール、設定、基本的な使い方
- [API](./api/) - エンドポイント仕様と使用例
- [機能](./features/) - 各機能の詳細ガイド
- [アーキテクチャ](./architecture/overview.md) - システム設計と構成
- [デプロイ](./deployment/) - 本番環境へのデプロイと運用
- [フロントエンド](./frontend/) - Web UI開発ガイド
- [トラブルシューティング](./troubleshooting.md) - 問題解決
- [変更履歴](./CHANGELOG.md) - バージョン履歴

## 🔑 主な機能

- **Claude Code SDK統合** - AI駆動のコード生成・編集
- **非同期タスク実行** - 長時間タスクのサポート
- **リアルタイム通信** - WebSocketでログストリーミング
- **Git Worktree** - 独立した実行環境
- **スケジューラー** - 定期実行とワンタイム実行
- **外部アクセス** - ngrok/Cloudflareトンネル統合
- **QR認証** - モバイルアクセス用認証

## 🛠 技術スタック

- **Backend**: TypeScript, Fastify, SQLite
- **Frontend**: SvelteKit, Tailwind CSS
- **AI**: Claude Code SDK, Claude API
- **運用**: PM2, WebSocket, Winston

## 📝 ライセンス

MIT
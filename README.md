# CC-Anywhere

Claude CodeとCodexをHTTP API経由で利用できるサーバーアプリケーション。

## 特徴

- **マルチExecutor対応**: Claude Agent SDK、OpenAI Codex SDKから選択可能
- **リアルタイム表示**: ログ、ファイル変更（[+]/[M]/[D]/[R]）をWebSocketで配信
- **Web UI & REST API**: ブラウザまたはAPIから操作
- **リモートアクセス**: ngrok/Cloudflare Tunnelでスマホからもアクセス可能
- **スケジューラー**: Cron式で定期実行
- **セッション継続**: CLI ⇔ SDK間でコンテキスト共有

## Quick Start

```bash
git clone https://github.com/nakamura-shuta/cc-anywhere
cd cc-anywhere
npm install
cp .env.example .env
# .envを編集してCLAUDE_API_KEYを設定

./scripts/start-dev.sh
```

→ http://localhost:5000 をブラウザで開く

## 必要な環境

- Node.js v20以上
- npm 10以上
- Claude API キー（[Anthropic Console](https://console.anthropic.com/)で取得）

## 起動スクリプト

```bash
./scripts/start-dev.sh         # 開発環境（ホットリロード）
./scripts/start-clamshell.sh   # モバイルアクセス（ngrok/Cloudflare）
./scripts/start-production.sh  # 本番環境（PM2管理）
./scripts/stop-all.sh          # 停止
```

詳細は[スクリプト使い分けガイド](docs/scripts-overview.md)を参照。

## 環境変数

`.env`ファイルで設定（`.env.example`をコピー）：

```env
# 必須
CLAUDE_API_KEY=your-api-key

# 推奨
API_KEY=your-secret-key        # API認証
PORT=5000                      # ポート番号
ENABLE_WORKTREE=true           # Git worktree使用
```

詳細は[環境変数リファレンス](docs/environment-variables.md)を参照。

## 使い方

### Web UI
1. http://localhost:5000 を開く
2. リポジトリを選択
3. Executorを選択（Claude/Codex）
4. 指示を入力して実行

### REST API
```bash
curl -X POST http://localhost:5000/api/tasks \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "instruction": "Create README.md",
    "options": {"executor": "claude"},
    "context": {"workingDirectory": "/path/to/repo"}
  }'
```

API詳細: http://localhost:5000/api/docs

## Executor比較

| 機能 | Claude Agent SDK | OpenAI Codex SDK |
|------|-----------------|------------------|
| セッション継続 | ✅ | ❌ |
| 実行モード選択 | ✅ | ❌ |
| ファイル変更通知 | ✅ | ✅ |
| ストリーミング | ✅ | ✅ |

詳細: [ファイル変更検知ドキュメント](docs/file-watcher-websocket.md)

## 開発者向け

```bash
# テスト
npm run test:unit           # ユニットテスト
npm run test:integration    # 統合テスト

# コード品質
npm run lint
npm run type-check
npm run build
```

## ドキュメント

- [スクリプト使い分けガイド](docs/scripts-overview.md)
- [環境変数リファレンス](docs/environment-variables.md)
- [ファイル変更検知とWebSocket](docs/file-watcher-websocket.md)
- [APIリファレンス](docs/api/README.md)

## ライセンス

MIT License

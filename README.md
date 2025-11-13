# CC-Anywhere

Claude CodeとCodexをHTTP API経由で利用できるサーバーアプリケーション。

## 特徴

- **マルチExecutor対応**: Claude Agent SDK、OpenAI Codex SDKから選択可能
- **リアルタイム表示**: ログ、ファイル変更（[+]/[M]/[D]/[R]）をWebSocketで配信
- **ファイルパスリンク**: AI応答内のファイルパスを自動的にクリック可能なリンクに変換
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
# 必須（いずれか）
CLAUDE_API_KEY=your-api-key    # Claude API（Claude Executorに必要）
OPENAI_API_KEY=your-api-key    # OpenAI API（Codex Executorに必要）

# 推奨
API_KEY=your-secret-key        # API認証
PORT=5000                      # ポート番号
ENABLE_WORKTREE=true           # Git worktree使用
```

**Codex Executor設定**:
- `OPENAI_API_KEY`: OpenAI APIキー（[OpenAI Platform](https://platform.openai.com/)で取得）
- Codex Executorを使用する場合はこのAPIキーが必要です

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
| セッション継続 | ✅ | ✅ |
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

## アーキテクチャ

### Agent Executor

ClaudeとCodex両SDKに対応したExecutorアーキテクチャ：

- **BaseTaskExecutor**: 共通ロジックを提供する抽象基底クラス
  - タスク追跡・キャンセル機能
  - ヘルパーメソッド（ログ、ID生成等）
- **ClaudeAgentExecutor**: Claude Agent SDK実装
- **CodexAgentExecutor**: OpenAI Codex SDK実装
- **ProgressEventConverter**: イベント変換の統一インターフェース

詳細: [Agent Execution Events](docs/architecture/agent-execution-events.md), [Progress Events](docs/architecture/progress-events.md)

## ドキュメント

### ユーザー向け
- [スクリプト使い分けガイド](docs/scripts-overview.md)
- [環境変数リファレンス](docs/environment-variables.md)
- [ファイル変更検知とWebSocket](docs/file-watcher-websocket.md)
- [Codex Executorセッション継続機能](docs/features/codex-session-continuation.md)
- [APIリファレンス](docs/api/README.md)

### 開発者向け
- [アーキテクチャ概要](docs/architecture/README.md)
- [Agent Execution Events](docs/architecture/agent-execution-events.md)
- [Progress Events](docs/architecture/progress-events.md)

## ライセンス

MIT License

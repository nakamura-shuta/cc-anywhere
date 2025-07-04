# CC-Anywhere

Claude Code SDKを使用してHTTP経由で指示できるアプリです。

## 概要

CC-Anywhereは、HTTPリクエストを通じてClaude Code SDKと対話し、様々なタスクを実行できるAPIサーバーです。

### 主な機能

- 🚀 Claude Code SDKをHTTP API経由で利用
- 📱 モバイル対応Web UI
- 🔄 非同期タスク実行とキュー管理
- 📦 複数リポジトリへの一括実行（バッチタスク）
- 💬 スラッシュコマンドサポート
- 🌐 ngrok統合による外部アクセス
- 📱 QRコード表示によるモバイルアクセス
- 🔐 APIキー認証
- 📊 リアルタイムタスク進捗表示（WebSocket）
- 🔁 自動リトライ機能

## セットアップ

### 前提条件

- Node.js 20以上
- Claude API キー

### インストール

```bash
# リポジトリのクローン
https://github.com/nakamura-shuta/cc-anywhere
cd cc-anywhere

# 依存関係のインストール
npm install

# 環境変数の設定
cp .env.example .env
# .envファイルを編集してCLAUDE_API_KEYを設定
```

### 環境変数

`.env`ファイルに以下の環境変数を設定してください：

```env
# 必須
CLAUDE_API_KEY=your-claude-api-key

# API認証
# APIキーを設定すると認証が有効になります。
API_KEY=your-secret-api-key

# サーバー設定
PORT=5000
NODE_ENV=development

# ログ設定
LOG_LEVEL=debug

# タスク実行設定
TASK_TIMEOUT_MS=300000
MAX_CONCURRENT_TASKS=10
USE_CLAUDE_CODE_SDK=true
QUEUE_CONCURRENCY=2

# データベース（SQLite）
DB_PATH=./data/cc-anywhere.db

# ワーカー設定
WORKER_MODE=inline  # inline, standalone, managed
WORKER_COUNT=1      # managed モードでのワーカー数
```

## 使用方法

### リポジトリ設定

Web UIで使用する(Claude Codeの実行対象）ローカルリポジトリを設定します：

```bash
# サンプルから設定ファイルを作成
cp config/repositories.json.example config/repositories.json

# リポジトリ情報を編集
```

`config/repositories.json`の例：
```json
{
  "repositories": [
    {
      "name": "my-project",
      "path": "/path/to/my-project"
    },
    {
      "name": "another-project",
      "path": "/path/to/another-project"
    }
  ]
}
```

### 開発サーバーの起動

```bash
npm run dev
```

サーバーはデフォルトで `http://localhost:5000` で起動します。
.envに記述したAPI_KEYをクエリパラメータ(apiKey)としてアクセスしてください。
Web UIにアクセス：
```
http://localhost:5000/?apiKey=your-secret-api-key
```

別のポートで起動する場合：
```bash
PORT=5001 npm run dev
```

### ワーカーシステム

CC-Anywhereは3つのワーカーモードをサポートします：

#### Inline Mode (デフォルト)
APIサーバーと同じプロセスでタスクを処理します。
```bash
npm run dev  # 開発
npm start    # プロダクション
```

#### Standalone Mode
APIサーバーとワーカーを別プロセスで実行します。
```bash
# APIサーバー起動
npm run dev:standalone

# 別ターミナルでワーカー起動
npm run dev:worker
```

#### Managed Mode
APIサーバーが自動的にワーカープロセスを管理します。
```bash
WORKER_COUNT=3 npm run dev:managed
```

詳細は[ワーカーシステムドキュメント](docs/architecture/worker-system.md)を参照してください。

### テストの実行

```bash
# 全テスト
npm test

# ユニットテストのみ
npm run test:unit
```

### その他のコマンド

```bash
# Lintチェック
npm run lint

# Lintエラーの自動修正
npm run lint:fix

# 型チェック
npm run type-check

# ビルド
npm run build

# クリーンビルド
npm run clean && npm run build
```

## バッチタスク

複数のリポジトリに対して同じタスクを並列実行する機能です。

### APIでの使用

```bash
# 複数リポジトリでテストを実行
curl -X POST http://localhost:5000/api/batch/tasks \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "instruction": "npm test",
    "repositories": [
      {"name": "app1", "path": "/path/to/app1"},
      {"name": "app2", "path": "/path/to/app2"},
      {"name": "app3", "path": "/path/to/app3"}
    ],
    "options": {
      "timeout": 300000,
      "allowedTools": ["Bash", "Read", "Write"]
    }
  }'
```

### Web UIでの使用

1. 複数のリポジトリを選択（Ctrl/Cmdキーを押しながらクリック）
2. プロンプトを入力
3. 「タスクを実行」をクリック

選択された各リポジトリに対して独立したタスクが作成され、並列で実行されます。

### バッチタスクのステータス確認

```bash
# グループIDを使用してバッチタスクのステータスを確認
curl -X GET http://localhost:5000/api/batch/tasks/{groupId}/status \
  -H "X-API-Key: your-api-key"
```

レスポンス例：
```json
{
  "groupId": "group_123",
  "summary": {
    "total": 3,
    "pending": 1,
    "running": 1,
    "completed": 1,
    "failed": 0
  },
  "tasks": [
    {
      "taskId": "task1",
      "repository": "app1",
      "status": "completed",
      "duration": 5000
    },
    // ...
  ]
}
```

## スラッシュコマンド

CC-Anywhereは、`/project:` および `/user:` プレフィックスを使用したカスタムスラッシュコマンドをサポートしています。

### 使用方法

- `/project:<command>` - プロジェクトのリポジトリ内の `.claude/commands/` ディレクトリからコマンドを実行
- `/user:<command>` - ユーザーのホームディレクトリの `~/.claude/commands/` からコマンドを実行

### 例

```bash
# プロジェクト固有のコマンドを実行
curl -X POST http://localhost:5000/api/tasks \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "instruction": "/project:analyze src",
    "context": {
      "workingDirectory": "/path/to/project"
    }
  }'

# ユーザー固有のコマンドを実行
curl -X POST http://localhost:5000/api/tasks \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "instruction": "/user:daily-report"
  }'
```

### カスタムコマンドの作成

コマンドはMarkdownファイルとして定義され、YAMLフロントマターでメタデータを指定します。

例: `.claude/commands/analyze.md`
```markdown
---
description: Analyze code quality and security
parameters:
  - name: target
    type: string
    required: true
    description: Target directory or file
  - name: depth
    type: number
    required: false
    default: 2
---
Analyze the code in {{target}} with the following criteria:
- Code quality assessment
- Security vulnerabilities
- Performance considerations
{{#if depth >= 2}}
- Include detailed analysis of dependencies
{{/if}}

Arguments: $ARGUMENTS
```

### テンプレート構文

CC-Anywhereは2つのテンプレート構文をサポートしています：

1. **Claude Code互換構文** (環境変数スタイル)
   - `$ARGUMENTS` - すべての引数
   - `$VARIABLE_NAME` - 大文字の変数名（パラメータは小文字で定義）

2. **Handlebars風構文**
   - `{{variable}}` - 変数の展開
   - `{{#if condition}}...{{/if}}` - 条件分岐
   - `{{#each array}}...{{/each}}` - ループ処理

詳細は [Claude Code ドキュメント](https://docs.anthropic.com/en/docs/claude-code/slash-commands) を参照してください。

## API認証

`.env`ファイルに`API_KEY`を設定すると、すべてのAPIエンドポイントで認証が必要になります。

### 認証方法

1. **HTTPヘッダー**（推奨 - API呼び出し用）
   ```bash
   curl -H "X-API-Key: your-secret-api-key" http://localhost:5000/api/tasks
   ```

2. **クエリパラメータ**（Web UIやブラウザアクセス用）
   ```bash
   curl "http://localhost:5000/api/tasks?apiKey=your-secret-api-key"
   ```

## 外部アクセス（ngrok）

開発中にローカルサーバーを外部からアクセス可能にするため、ngrok統合を提供しています。

### 使用方法

1. `.env`ファイルで`ENABLE_NGROK=true`を設定
2. オプション：`SHOW_QR_CODE=true`を設定するとQRコードも表示されます
3. サーバーを起動すると、自動的にngrok tunnelが開始されます
4. コンソールに外部アクセス用のURL（とQRコード）が表示されます

### QRコード表示

`SHOW_QR_CODE=true`を設定すると、スマートフォンでスキャン可能なQRコードがターミナルに表示されます。これにより、モバイルデバイスから簡単にWeb UIにアクセスできます。

```bash
# .envファイル
ENABLE_NGROK=true
API_KEY=your-secret-api-key
SHOW_QR_CODE=true  # QRコードを表示する場合

# サーバー起動
npm run dev

# 以下のような情報が表示されます：
# ========================================
# 🌐 External Access Information
# ========================================
# 
# 📡 ngrok URL: https://xxxx-xxx-xxx-xxx-xxx.ngrok.io
# 🔒 API Key: your-secret-api-key
# 
# 🌍 Web UI Access:
#    https://xxxx-xxx-xxx-xxx-xxx.ngrok.io/?apiKey=your-secret-api-key
# 
# 📱 API Access:
#    curl -H "X-API-Key: your-secret-api-key" https://xxxx-xxx-xxx-xxx-xxx.ngrok.io/api/tasks
#
# 📱 Scan QR code with your phone:
#
#     █▀▀▀▀▀█ ▄▀▄ ▄▄▀▄▄ █▀▀▀▀▀█
#     █ ███ █ ▀▄▀▄▀▄▀▄▀ █ ███ █
#     █ ▀▀▀ █ ▄▀▄▀▄ ▀▄▀ █ ▀▀▀ █
#     ▀▀▀▀▀▀▀ █ ▀ █ ▀ █ ▀▀▀▀▀▀▀
#     ▀▄▀▄▀▄▀ ▄▀▄ ▀▄▀▄ ▀▄▀▄▀▄▀
#     █ ▀▄▀▄▀ ▄▀▄▀▄ ▀▄ ▀▄▀▄▀ █
#     ▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀
```

## クイックスタート

### 即座にタスクを実行

```bash
# タスクの作成（同期実行）
# API認証が無効の場合（API_KEY未設定）
curl -X POST http://localhost:5000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "instruction": "Write a hello world function"
  }'

# API認証が有効の場合（API_KEY設定済み）
curl -X POST http://localhost:5000/api/tasks \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "instruction": "Write a hello world function"
  }'

# 作業ディレクトリとツール制限を指定
curl -X POST http://localhost:5000/api/tasks \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "instruction": "List TypeScript files",
    "context": {
      "workingDirectory": "/path/to/project"
    },
    "options": {
      "allowedTools": ["Read", "Glob"]
    }
  }'
```

### タスクキューを使用

```bash
# キューにタスクを追加（優先度付き）
curl -X POST http://localhost:5000/api/queue/tasks \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "instruction": "Refactor authentication module",
    "priority": 10
  }'

# キューの状態を確認
curl -X GET http://localhost:5000/api/queue/stats \

# タスク履歴を取得
curl -X GET http://localhost:5000/api/history/tasks \

# フィルタリングとページネーション
curl -X GET "http://localhost:5000/api/history/tasks?status=completed&limit=10&offset=0" \
```


## ライセンス

MIT License

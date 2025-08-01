# 機能ガイド

CC-Anywhereの主要機能について説明します。

## 📅 スケジューラー

定期実行とワンタイム実行をサポートします。

### 定期実行（Cron）
```bash
# 毎日9時にテスト実行
curl -X POST http://localhost:5000/api/schedules \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Daily Test",
    "cron": "0 9 * * *",
    "enabled": true,
    "task": {
      "instruction": "npm test",
      "context": { "workingDirectory": "/project" }
    }
  }'
```

### ワンタイム実行
```bash
# 30分後に実行
curl -X POST http://localhost:5000/api/schedules \
  -d '{
    "name": "Deploy",
    "oneTime": "2024-01-01T10:30:00Z",
    "task": {
      "instruction": "npm run deploy"
    }
  }'
```

## 🌳 Git Worktree

独立した作業環境でタスクを実行します。

### 設定
```env
ENABLE_WORKTREE=true
WORKTREE_AUTO_CLEANUP=true
WORKTREE_CLEANUP_DELAY=10000
```

### 使用方法
```json
{
  "instruction": "新機能を実装",
  "options": {
    "repository": "feature-branch",
    "worktree": {
      "baseBranch": "main",
      "commitChanges": true
    }
  }
}
```

### 利点
- メインブランチに影響しない
- 並行作業が可能
- 自動クリーンアップ

## 🌐 外部アクセス

ngrokまたはCloudflare Tunnelで外部公開します。

### ngrok（推奨）
```bash
# .env設定
TUNNEL_TYPE=ngrok
ENABLE_NGROK=true
SHOW_QR_CODE=true

# 起動
./scripts/start-clamshell.sh
```

### Cloudflare Tunnel
```bash
# トークン取得
cloudflared tunnel create cc-anywhere

# .env設定
TUNNEL_TYPE=cloudflare
CLOUDFLARE_TUNNEL_TOKEN=your-token
```

## 🔌 WebSocket

リアルタイムログとタスク進捗を配信します。

### 接続例
```javascript
const ws = new WebSocket('ws://localhost:5000/ws');

// 認証
ws.send(JSON.stringify({
  type: 'auth',
  payload: { apiKey: 'your-token' }
}));

// タスクサブスクライブ
ws.send(JSON.stringify({
  type: 'subscribe',
  payload: { taskId: 'task-123' }
}));

// ハートビート（必須）
setInterval(() => {
  ws.send(JSON.stringify({ type: 'ping' }));
}, 30000);
```

### メッセージタイプ
- `task.log` - ログメッセージ
- `task.progress` - 進捗更新
- `task.status` - ステータス変更
- `task.completed` - 完了通知

## 💾 プリセット管理

よく使う設定をプリセットとして保存できます。

### システムプリセット
`config/presets/`に配置:

```yaml
# config/presets/test-runner.yaml
name: Test Runner
description: Run tests with coverage
instruction: npm test -- --coverage
options:
  timeout: 600000
```

### ユーザープリセット
APIで作成:

```bash
curl -X POST http://localhost:5000/api/presets \
  -d '{
    "name": "Deploy Staging",
    "instruction": "npm run deploy:staging",
    "options": { "timeout": 900000 }
  }'
```

### 使用方法
```bash
curl -X POST http://localhost:5000/api/tasks \
  -d '{
    "presetId": "test-runner",
    "context": { "workingDirectory": "/project" }
  }'
```

## 🔧 スラッシュコマンド

特殊なタスクを実行するコマンドです。

### システムコマンド
- `/quick` - 簡単なタスクを高速実行
- `/test` - テストスイートを実行
- `/build` - ビルドプロセスを実行

### カスタムコマンド
`config/slash-commands/`に配置:

```yaml
# config/slash-commands/deploy.md
---
command: /deploy
description: Deploy to production
---
Please deploy the application:
1. Run tests
2. Build the project
3. Deploy to production
4. Verify deployment
```

### 使用方法
```json
{
  "instruction": "/deploy production"
}
```

## 🔄 タスク継続

既存タスクの結果を引き継いで新しいタスクを実行します。

```bash
# 最初のタスク
curl -X POST http://localhost:5000/api/tasks \
  -d '{
    "instruction": "APIエンドポイントを実装",
    "context": { "workingDirectory": "/project" }
  }'
# => taskId: "task-123"

# 継続タスク
curl -X POST http://localhost:5000/api/tasks \
  -d '{
    "instruction": "先ほど実装したAPIのテストを追加",
    "options": {
      "sdk": {
        "continueFromTaskId": "task-123"
      }
    }
  }'
```

## 📦 バッチ実行

複数のリポジトリで同じタスクを実行します。

```bash
curl -X POST http://localhost:5000/api/batch/tasks \
  -d '{
    "instruction": "セキュリティアップデートを適用",
    "repositories": ["api", "frontend", "backend"],
    "options": {
      "async": true,
      "worktree": { "baseBranch": "main" }
    }
  }'
```

## 🔐 QR認証

モバイルアクセス用の認証機能です。

### 設定
```env
QR_AUTH_ENABLED=true
QR_AUTH_TOKEN=hello
```

### アクセス方法
1. `./scripts/start-clamshell.sh`を実行
2. QRコードをスキャン
3. URLに`?auth_token=hello`が自動付与

### APIアクセス
```bash
# ヘッダー
curl -H "X-Auth-Token: hello" http://your-url/api/tasks

# クエリパラメータ
curl http://your-url/api/tasks?auth_token=hello
```
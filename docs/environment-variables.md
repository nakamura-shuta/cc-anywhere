# 環境変数リファレンス

## 必須設定

### 🔑 Claude API設定
| 変数名 | 説明 | デフォルト値 | 必須 |
|--------|------|------------|------|
| `CLAUDE_API_KEY` | Claude APIキー（[取得](https://console.anthropic.com/)） | - | ✅ |

### 🤖 OpenAI API設定
| 変数名 | 説明 | デフォルト値 | 必須 |
|--------|------|------------|------|
| `OPENAI_API_KEY` | OpenAI APIキー（Codex Executor使用時に必要） | - | ⚠️ Codex使用時のみ |

### 🔐 セキュリティ
| 変数名 | 説明 | デフォルト値 | 必須 |
|--------|------|------------|------|
| `API_KEY` | API認証キー（リモートアクセス時は設定推奨） | - | ⚠️ 推奨 |

## 基本設定

### 🖥️ サーバー設定
| 変数名 | 説明 | デフォルト値 |
|--------|------|------------|
| `PORT` | サーバーポート番号 | `5000` |
| `HOST` | バインドホスト | `0.0.0.0` |
| `NODE_ENV` | 実行環境 | `development` |
| `LOG_LEVEL` | ログレベル（error/warn/info/debug） | `info` |
| `CORS_ORIGIN` | CORS許可オリジン | `*` |

### ⚙️ タスク実行設定
| 変数名 | 説明 | デフォルト値 |
|--------|------|------------|
| `TASK_TIMEOUT_MS` | タスクタイムアウト（ミリ秒） | `1800000`（30分） |
| `MAX_CONCURRENT_TASKS` | 最大同時実行タスク数 | `10` |
| `QUEUE_CONCURRENCY` | キュー同時実行数 | `2` |
| `DEFAULT_MAX_TURNS` | Claude Code SDKの最大ターン数 | `50` |

### 💾 データベース
| 変数名 | 説明 | デフォルト値 |
|--------|------|------------|
| `DB_PATH` | SQLiteデータベースパス | `./data/cc-anywhere.db` |

## 高度な設定

### 🌐 外部アクセス（Tunnel）設定
| 変数名 | 説明 | デフォルト値 |
|--------|------|------------|
| `TUNNEL_TYPE` | トンネルタイプ（none/ngrok/cloudflare） | `none` |
| `CLOUDFLARE_TUNNEL_TOKEN` | Cloudflare Tunnelトークン | - |
| `CLOUDFLARE_TUNNEL_NAME` | Cloudflare Tunnel名 | `cc-anywhere` |
| `SHOW_QR_CODE` | QRコード表示 | `false` |
| `QR_AUTH_ENABLED` | QR表示機能有効化 | `false` |
| `QR_AUTH_SESSION_DURATION` | QRセッション期間（ミリ秒） | `86400000`（24時間） |

### 🌲 Git Worktree設定
| 変数名 | 説明 | デフォルト値 |
|--------|------|------------|
| `ENABLE_WORKTREE` | Worktree機能有効化 | `false` |
| `WORKTREE_BASE_PATH` | Worktreeベースパス | `.worktrees` |
| `MAX_WORKTREES` | 最大Worktree数 | `5` |
| `WORKTREE_AUTO_CLEANUP` | 自動クリーンアップ | `true` |
| `WORKTREE_PREFIX` | Worktreeプレフィックス | `cc-anywhere` |
| `WORKTREE_DEFAULT_BASE_BRANCH` | デフォルトベースブランチ | 現在のブランチ |

### 🔌 WebSocket設定
| 変数名 | 説明 | デフォルト値 |
|--------|------|------------|
| `WEBSOCKET_HEARTBEAT_INTERVAL` | ハートビート間隔（ミリ秒） | `60000`（60秒） |
| `WEBSOCKET_HEARTBEAT_TIMEOUT` | ハートビートタイムアウト | `120000`（120秒） |
| `WEBSOCKET_AUTH_TIMEOUT` | 認証タイムアウト | `30000`（30秒） |
| `WEBSOCKET_MAX_LOG_BUFFER_SIZE` | 最大ログバッファサイズ | `10000` |

### 👷 ワーカー設定
| 変数名 | 説明 | デフォルト値 |
|--------|------|------------|
| `WORKER_MODE` | ワーカーモード（inline/standalone/managed） | `inline` |
| `WORKER_COUNT` | ワーカープロセス数 | `1` |

### 🤖 AWS Bedrock設定（オプション）
| 変数名 | 説明 | デフォルト値 |
|--------|------|------------|
| `AWS_ACCESS_KEY_ID` | AWS アクセスキー | - |
| `AWS_SECRET_ACCESS_KEY` | AWS シークレットキー | - |
| `AWS_REGION` | AWS リージョン | `us-east-1` |
| `BEDROCK_MODEL_ID` | Bedrockモデル ID | `us.anthropic.claude-opus-4-20250514-v1:0` |
| `FORCE_EXECUTION_MODE` | 実行モード強制（api-key/bedrock） | - |

## 設定例

### 最小構成（ローカル開発）
```env
# 必須
CLAUDE_API_KEY=sk-ant-api03-xxxxx

# これだけでOK！
```

### 標準構成（チーム開発）
```env
# API設定
CLAUDE_API_KEY=sk-ant-api03-xxxxx
API_KEY=my-secure-api-key

# サーバー設定
PORT=5000
LOG_LEVEL=info

# タスク設定
TASK_TIMEOUT_MS=3600000  # 1時間
MAX_CONCURRENT_TASKS=5
```

### モバイルアクセス構成
```env
# API設定
CLAUDE_API_KEY=sk-ant-api03-xxxxx
API_KEY=my-secure-api-key

# Tunnel設定
TUNNEL_TYPE=ngrok
SHOW_QR_CODE=true
QR_AUTH_ENABLED=true
```

### 本番環境構成
```env
# 環境設定
NODE_ENV=production
LOG_LEVEL=warn

# API設定
CLAUDE_API_KEY=sk-ant-api03-xxxxx
API_KEY=production-api-key-xxxxx

# Cloudflare Tunnel（固定URL）
TUNNEL_TYPE=cloudflare
CLOUDFLARE_TUNNEL_TOKEN=xxxxx

# パフォーマンス設定
MAX_CONCURRENT_TASKS=20
QUEUE_CONCURRENCY=5
WORKER_MODE=managed
WORKER_COUNT=4

# Worktree（安全な実行）
ENABLE_WORKTREE=true
WORKTREE_AUTO_CLEANUP=true
```

### AWS Bedrock使用時
```env
# Bedrock認証
AWS_ACCESS_KEY_ID=AKIAXXXXX
AWS_SECRET_ACCESS_KEY=xxxxx
AWS_REGION=us-east-1
FORCE_EXECUTION_MODE=bedrock

# モデル選択
BEDROCK_MODEL_ID=us.anthropic.claude-3-5-sonnet-20241022-v2:0
```

## トラブルシューティング

### Q: CLAUDE_API_KEYが認識されない
A: `.env`ファイルがプロジェクトルートにあることを確認してください。

### Q: ポート番号を変更したい
A: `PORT=8080`などに変更してください。

### Q: 外部からアクセスできない
A: 
1. `API_KEY`を設定
2. `TUNNEL_TYPE=ngrok`を設定
3. `./scripts/start-clamshell.sh`で起動

### Q: タスクがタイムアウトする
A: `TASK_TIMEOUT_MS`を増やしてください（例: `7200000` = 2時間）。

## 削除された環境変数（v0.6.0以降）

以下の環境変数は使用されなくなりました：

- ❌ `DATABASE_URL` - PostgreSQL対応は未実装のため削除
- ❌ `REDIS_URL` - Redis/Bull対応は未実装のため削除
- ❌ `ENABLE_NGROK` - `TUNNEL_TYPE`で統合管理

これらの環境変数が`.env`に残っていても害はありませんが、削除することを推奨します。
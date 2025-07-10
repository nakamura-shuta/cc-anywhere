# 自己組織化型並列実行の実装と検証

## 概要

このドキュメントは、cc-anywhere（Claude Code SDKを使用したHTTPサーバー）を使用して、「自己組織化型並列実行」を実現した検証プロジェクトの記録です。司令塔タスクが他のタスクをHTTP API経由で作成・管理し、各タスクが独立したGit worktreeで並列実行される仕組みを実装しました。

## アーキテクチャ

### 1. 自己組織化パターン

```
┌─────────────────┐
│   司令塔タスク    │ (Orchestrator)
│ /api/tasks POST │
└────────┬────────┘
         │ HTTP APIを通じて他のタスクを作成
         │
    ┌────┴────┬──────────┬──────────┐
    ▼         ▼          ▼          ▼
┌────────┐┌────────┐┌────────┐┌────────┐
│Backend ││Frontend││ DevOps ││  ...   │
│ Task   ││  Task  ││  Task  ││        │
└────────┘└────────┘└────────┘└────────┘
    │         │          │
    ▼         ▼          ▼
[worktree][worktree][worktree]  各タスクが独立したworktreeで実行
```

### 2. 技術スタック

- **cc-anywhere**: Claude Code SDKをHTTP API化したサーバー
- **Git worktree**: 並列実行のための独立した作業環境
- **Node.js/Express**: TODOアプリのバックエンド
- **React (CDN版)**: TODOアプリのフロントエンド
- **Docker/Docker Compose**: コンテナ化とオーケストレーション

## 実装の流れ

### Phase 1: 基盤準備

1. **cc-anywhereサーバーの起動**
   ```bash
   npm run dev  # ポート5000で起動
   ```

2. **テストプロジェクトの初期化**
   ```bash
   mkdir todo-app-parallel-test
   cd todo-app-parallel-test
   git init
   echo "# TODO App" > README.md
   git add . && git commit -m "init"
   ```

### Phase 2: 自己組織化スクリプトの作成

`self-orchestrated-with-commit.sh`を作成：

```bash
#!/bin/bash
# 司令塔型並列実行テストスクリプト（コミット機能付き）

PROJECT_PATH="/Users/nakamura.shuta/dev/node/todo-app-parallel-test"
API_URL="http://localhost:5000/api/tasks"
API_KEY="hoge"

# 司令塔タスクを作成
curl -X POST $API_URL \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d "{
    \"instruction\": \"司令塔として以下を実行：
    1. アーキテクチャ設計ドキュメントを作成
    2. 並列タスク作成スクリプトを生成・実行
    3. 各タスクの進捗を監視
    4. 最終レポートを作成\",
    \"options\": {
      \"worktree\": {
        \"enabled\": true,
        \"branchName\": \"feature/orchestrator\"
      },
      \"sdk\": {
        \"allowedTools\": [\"Read\", \"Write\", \"Edit\", \"Bash\", \"LS\"],
        \"maxTurns\": 50
      }
    }
  }"
```

### Phase 3: 司令塔タスクの実行内容

司令塔タスクは以下を自律的に実行：

1. **アーキテクチャ設計ドキュメントの作成**
   - `docs/architecture.md` - システム設計
   - `docs/api-spec.md` - API仕様
   - `docs/ui-spec.md` - UI仕様
   - `docs/deployment-spec.md` - デプロイ仕様

2. **並列タスクの作成（create-parallel-tasks.sh）**
   ```bash
   # バックエンドタスクを作成（バックグラウンド実行）
   curl -X POST http://localhost:5000/api/tasks ... > backend-response.json &
   BACKEND_PID=$!
   
   # フロントエンドタスクを作成（バックグラウンド実行）
   curl -X POST http://localhost:5000/api/tasks ... > frontend-response.json &
   FRONTEND_PID=$!
   
   # DevOpsタスクを作成（バックグラウンド実行）
   curl -X POST http://localhost:5000/api/tasks ... > devops-response.json &
   DEVOPS_PID=$!
   
   # すべてのタスクの作成を待つ
   wait $BACKEND_PID
   wait $FRONTEND_PID
   wait $DEVOPS_PID
   ```

### Phase 4: 並列実行の成果

各タスクが独立したworktreeで以下を実装：

#### 1. Backend Task (feature/backend-api)
- Express.jsサーバー（ポート5000→5001）
- TODO CRUD API実装
- メモリ内データストア
- CORS対応

#### 2. Frontend Task (feature/frontend-ui)
- React (CDN版) SPA
- TODOの追加・表示・更新・削除
- レスポンシブデザイン
- APIとの連携

#### 3. DevOps Task (feature/devops)
- Dockerfile（マルチステージビルド）
- docker-compose.yml（開発/本番環境）
- GitHub Actions CI/CD設定
- セキュリティスキャン統合

### Phase 5: 統合とマージ

```bash
# すべてのブランチをmasterにマージ
git merge feature/orchestrator --no-ff
git merge feature/backend-api --no-ff
git merge feature/frontend-ui --no-ff
git merge feature/devops --no-ff
```

## 実装のポイント

### 1. 真の並列実行
- Bashの`&`演算子でバックグラウンド実行
- `wait`コマンドで全プロセスの完了を待機
- 各タスクが独立したworktreeで干渉なく実行

### 2. 自律的なコミット
- 各タスクが作業完了後に自動的にgit commit
- worktree内での変更が各featureブランチに保存
- マージ時にコンフリクトが発生しない設計

### 3. APIを通じた疎結合
- 司令塔タスクは他のタスクの詳細を知らない
- HTTP APIを通じた標準的なインターフェース
- 各タスクが独立して動作可能

## 遭遇した課題と解決策

### 1. APIタイムアウト問題
**問題**: 長時間実行タスクでHTTP接続がタイムアウト
**解決**: 非同期実行とステータス確認の分離

### 2. ポート競合
**問題**: バックエンドアプリとcc-anywhereが同じポート5000を使用
**解決**: 環境変数でポート5001に変更

### 3. フィールド名の不整合
**問題**: フロントエンドが`text`、バックエンドが`title`を使用
**解決**: cc-anywhere経由で修正タスクを実行

## 実行結果

### 最終的なGitログ
```
* c840f91 Merge feature/devops: Docker/CI環境構築
* f229456 Merge feature/frontend-ui: React UI実装
* bc5b6c2 Merge feature/backend-api: Express APIサーバー実装
* fdf129b Merge feature/orchestrator: アーキテクチャ設計と司令塔機能
* 782deca init
```

### プロジェクト構造
```
todo-app-parallel-test/
├── docs/                 # アーキテクチャドキュメント
├── src/
│   ├── backend/         # Express.js API
│   └── frontend/        # React UI
├── .github/workflows/   # CI/CD設定
├── Dockerfile          # Docker設定
├── docker-compose.yml  # オーケストレーション
└── package.json        # 依存関係
```

## まとめ

### 実証された概念

1. **自己組織化**: タスクがAPIを通じて他のタスクを作成・管理
2. **真の並列実行**: 複数のタスクが同時に独立して実行
3. **自律的な完結**: 各タスクがコミットまで自動実行
4. **実用的な成果物**: 動作するTODOアプリケーションの完成

### 今後の可能性

- より複雑な依存関係を持つタスクの管理
- タスク間の通信と協調
- 動的なタスク生成とスケーリング
- エラーハンドリングとリトライ機構

この実装により、cc-anywhereを使用した自己組織化型の並列タスク実行が実用レベルで可能であることが実証されました。
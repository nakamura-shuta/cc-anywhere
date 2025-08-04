# Test Scripts

このディレクトリには、cc-anywhereのテスト用スクリプトが含まれています。

## 主要なテストスクリプト

### worktree-tests.sh
Git Worktree機能の統合テストを実行します。

```bash
# すべてのテストを実行
./scripts/test/worktree-tests.sh

# 基本機能テストのみ実行
./scripts/test/worktree-tests.sh basic

# Worktreeのクリーンアップのみ実行
./scripts/test/worktree-tests.sh cleanup

# ヘルプを表示
./scripts/test/worktree-tests.sh help
```

### run-all-worktree-tests.sh
Worktree機能の包括的なテストスイートを実行します。より詳細なテストが必要な場合に使用します。

```bash
./scripts/test/run-all-worktree-tests.sh
```

### cleanup-worktrees.sh
作成されたWorktreeとブランチをクリーンアップします。

```bash
./scripts/test/cleanup-worktrees.sh
```

## 前提条件

1. CC-Anywhereサーバーが起動していること
2. `.env`ファイルで以下の設定がされていること：
   - `ENABLE_WORKTREE=true`
   - `MAX_WORKTREES=5`（推奨）
   - `WORKTREE_AUTO_CLEANUP=true`（推奨）
3. 認証が設定されていること：
   - `API_KEY`を設定（デフォルト: "hoge"）
   - QRコード表示を有効にする場合: `QR_AUTH_ENABLED=true`を設定

## 環境変数

テストスクリプトは以下の環境変数をサポートしています：

- `BASE_URL` - APIサーバーのURL（デフォルト: http://localhost:5000）
- `REPO_PATH` - リポジトリパス（デフォルト: 現在のディレクトリ）
- `API_KEY` - APIキー（デフォルト: "hoge"）

例：
```bash
BASE_URL=http://localhost:3000 ./scripts/test/worktree-tests.sh
```

## トラブルシューティング

### Worktreeが残っている場合

```bash
# クリーンアップスクリプトを実行
./scripts/test/cleanup-worktrees.sh

# 手動で確認
git worktree list
```

### テストが失敗する場合

1. サーバーが起動しているか確認
2. 環境設定を確認
   ```bash
   grep WORKTREE .env
   ```
3. サーバーログを確認
   ```bash
   npm run dev
   ```

### 並列実行テストについて

現在のアーキテクチャでは、タスクは順次実行されます（QUEUE_CONCURRENCYによる制御）。そのため、複数のWorktreeが同時に存在することはありますが、完全な並列実行ではありません。
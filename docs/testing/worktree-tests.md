# Git Worktree テストガイド

このドキュメントでは、CC-AnywhereのGit Worktree機能のテスト方法について説明します。

## 概要

Git Worktree機能により、タスクを独立した作業環境で実行できます。これにより、複数のタスクを同時に実行しても、互いに干渉することなく安全に処理できます。

## テストの実行

### 基本的なテスト実行

```bash
# すべてのWorktreeテストを実行
./scripts/test/worktree-tests.sh

# 基本機能テストのみ実行
./scripts/test/worktree-tests.sh basic

# クリーンアップのみ実行
./scripts/test/worktree-tests.sh cleanup
```

### 包括的なテストスイート

より詳細なテストが必要な場合：

```bash
./scripts/test/run-all-worktree-tests.sh
```

このスクリプトは以下のテストを実行します：
- 基本機能テスト
- 複数タスク実行テスト
- ファイル操作テスト
- エラーハンドリングテスト
- クリーンアップテスト

## テスト内容

### 1. 基本機能テスト
- Worktreeの作成と削除
- タスクの独立実行
- カスタムブランチ名の指定

### 2. 複数タスク実行テスト
- 複数タスクの順次実行
- Worktreeの同時管理
- リソース制限の確認

### 3. keepAfterCompletionオプション
- タスク完了後のWorktree保持
- 手動クリーンアップの必要性

## 環境設定

テスト実行前に以下の設定を確認してください：

```bash
# .envファイルの設定
ENABLE_WORKTREE=true
MAX_WORKTREES=5
WORKTREE_AUTO_CLEANUP=true
WORKTREE_CLEANUP_DELAY=10000  # 10秒
```

## トラブルシューティング

### Worktreeが残っている場合

```bash
# すべてのWorktreeをクリーンアップ
./scripts/test/cleanup-worktrees.sh

# 手動で確認
git worktree list

# 特定のWorktreeを削除
git worktree remove <path> --force
```

### テストが失敗する場合

1. **サーバーが起動していることを確認**
   ```bash
   npm run dev
   ```

2. **環境設定を確認**
   ```bash
   grep WORKTREE .env
   ```

3. **Gitリポジトリであることを確認**
   ```bash
   git status
   ```

## 並列実行について

現在のアーキテクチャの制限：
- タスクはキューを通じて順次実行されます
- `QUEUE_CONCURRENCY`設定により同時実行数が制御されます
- 複数のWorktreeは存在できますが、完全な並列実行ではありません

## ベストプラクティス

1. **テスト後は必ずクリーンアップを実行**
   - 自動クリーンアップが有効でも、念のため手動確認を推奨

2. **本番環境でのテスト実行は避ける**
   - 開発環境またはステージング環境でテストを実行

3. **定期的なWorktree確認**
   ```bash
   git worktree list | grep cc-anywhere
   ```

## 関連ドキュメント

- [Git Worktree機能](../features/git-worktree.md)
- [APIリファレンス](../api/api-reference.md)
- [トラブルシューティング](../operations/troubleshooting.md)
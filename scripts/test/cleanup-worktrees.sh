#!/bin/bash

echo "=== Worktree クリーンアップ ==="
echo ""

# 現在のWorktreeを表示
echo "現在のWorktree:"
git worktree list | grep cc-anywhere || echo "cc-anywhere関連のWorktreeはありません"

echo ""
echo "クリーンアップ開始..."

# cc-anywhere関連のWorktreeを削除
git worktree list | grep cc-anywhere | awk '{print $1}' | while read worktree_path; do
    echo "削除中: $worktree_path"
    git worktree remove "$worktree_path" --force 2>/dev/null || git worktree remove "$worktree_path"
done

# 不要なブランチを削除
echo ""
echo "不要なブランチを削除中..."
git branch | grep cc-anywhere | while read branch; do
    branch_name=$(echo $branch | sed 's/[+*]//g' | xargs)
    echo "ブランチ削除: $branch_name"
    git branch -D "$branch_name" 2>/dev/null || echo "  既に削除されています"
done

# Worktreeのpruneを実行
echo ""
echo "Worktreeのpruneを実行..."
git worktree prune -v

# ディレクトリの物理削除（念のため）
if [ -d ".worktrees" ]; then
    echo ""
    echo ".worktreesディレクトリをクリーンアップ..."
    rm -rf .worktrees/cc-anywhere-* 2>/dev/null
    # 空の場合はディレクトリ自体も削除
    rmdir .worktrees 2>/dev/null || echo ".worktreesディレクトリに他のファイルがあります"
fi

echo ""
echo "=== クリーンアップ完了 ==="
echo ""
echo "最終確認:"
echo "- Worktree:"
git worktree list | grep cc-anywhere || echo "  cc-anywhere関連のWorktreeはありません ✓"
echo ""
echo "- ブランチ:"
git branch | grep cc-anywhere || echo "  cc-anywhere関連のブランチはありません ✓"
echo ""
echo "- ディレクトリ:"
ls -la .worktrees 2>/dev/null || echo "  .worktreesディレクトリは存在しません ✓"
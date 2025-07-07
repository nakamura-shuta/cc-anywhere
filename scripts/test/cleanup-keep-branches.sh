#!/bin/bash

echo "=== Keep ブランチのクリーンアップ ==="
echo ""

# keep/で始まるWorktreeを削除
echo "Keep Worktreeの削除:"
git worktree list | grep "keep/" | awk '{print $1}' | while read worktree_path; do
    echo "削除中: $worktree_path"
    git worktree remove "$worktree_path" --force 2>/dev/null || git worktree remove "$worktree_path"
done

# keep/で始まるブランチを削除
echo ""
echo "Keep ブランチの削除:"
git branch | grep "keep/" | while read branch; do
    branch_name=$(echo $branch | sed 's/[+*]//g' | xargs)
    echo "ブランチ削除: $branch_name"
    git branch -D "$branch_name" 2>/dev/null || echo "  既に削除されています"
done

echo ""
echo "=== クリーンアップ完了 ==="
echo ""
echo "残存Worktree:"
git worktree list
echo ""
echo "残存keepブランチ:"
git branch | grep "keep/" || echo "keepブランチなし"
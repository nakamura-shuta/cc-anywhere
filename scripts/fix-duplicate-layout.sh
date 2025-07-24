#!/bin/bash
# 重複したlayoutファイルを削除

cd /Users/nakamura.shuta/dev/cc-anywhere/frontend

# +layout.jsを削除（+layout.tsを残す）
if [ -f "src/routes/+layout.js" ]; then
    rm -f "src/routes/+layout.js"
    echo "Removed duplicate +layout.js"
fi

# .svelte-kitキャッシュをクリア
if [ -d ".svelte-kit" ]; then
    rm -rf ".svelte-kit"
    echo "Cleared .svelte-kit cache"
fi

echo "Fixed duplicate layout files"
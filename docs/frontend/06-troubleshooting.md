# Svelte 5 & shadcn-svelte トラブルシューティング

このドキュメントでは、CC-Anywhereの開発で遭遇した問題と解決方法をまとめています。

## 1. よくあるエラーと解決方法

### イベントハンドラーが動作しない

**問題**: ボタンをクリックしても何も起こらない

```svelte
<!-- ❌ Svelte 4の書き方（Svelte 5では動作しない） -->
<button on:click={handleClick}>クリック</button>
```

**解決方法**: Svelte 5の新しい構文を使用

```svelte
<!-- ✅ Svelte 5の正しい書き方 -->
<button onclick={handleClick}>クリック</button>

<!-- その他のイベントも同様 -->
<input oninput={handleInput} />
<form onsubmit={handleSubmit}>
<select onchange={handleChange}>
```

### $propsの型エラー

**問題**: TypeScriptで$props()の型が推論されない

```typescript
// ❌ 型エラーが発生
let props = $props();
console.log(props.name); // エラー: 'name'は存在しません
```

**解決方法**: 明示的な型注釈または分割代入を使用

```typescript
// ✅ 解決方法1: 型注釈
interface Props {
  name: string;
  age?: number;
}
let props: Props = $props();

// ✅ 解決方法2: 分割代入（推奨）
let { name, age = 25 } = $props<{
  name: string;
  age?: number;
}>();
```

### ページ遷移時の重複表示

**問題**: 新しいページが既存ページの下に表示される

```typescript
// ❌ SSRが有効な場合の問題
// +layout.ts
export const ssr = true;
```

**解決方法**: SPAモードに設定

```typescript
// ✅ +layout.ts
export const prerender = true;
export const ssr = false;  // SSRを無効化
export const csr = true;   // CSRを有効化
```

### APIレスポンスの型不一致

**問題**: バックエンドとフロントエンドで型が異なる

```typescript
// バックエンド: taskId
// フロントエンド: id を期待

// ❌ エラーが発生
tasks.forEach(task => {
  console.log(task.id); // undefined
});
```

**解決方法**: サービス層でデータを変換

```typescript
// ✅ task.service.ts
async list(params?: ListParams) {
  const response = await apiClient.get('/api/tasks', { params });
  
  // データ変換
  const tasks = response.tasks.map(task => ({
    ...task,
    id: task.taskId // バックエンドのtaskIdをidにマッピング
  }));
  
  return { data: tasks, pagination: response.pagination };
}
```

## 2. shadcn-svelteの問題

### コンポーネントのインポートエラー

**問題**: shadcn-svelteコンポーネントが見つからない

```typescript
// ❌ エラー: モジュールが見つかりません
import { Button } from '@/components/ui/button';
```

**解決方法**: 正しいパスエイリアスを使用

```typescript
// ✅ $libエイリアスを使用
import { Button } from '$lib/components/ui/button';

// components.jsonで設定を確認
{
  "aliases": {
    "components": "$lib/components",
    "ui": "$lib/components/ui"
  }
}
```

### スタイルが適用されない

**問題**: shadcn-svelteのスタイルが機能しない

**解決方法**: 必要な設定を確認

1. **app.cssでTailwind CSSをインポート**
```css
/* app.css */
@tailwind base;
@tailwind components;
@tailwind utilities;
```

2. **レイアウトでapp.cssをインポート**
```svelte
<!-- +layout.svelte -->
<script>
  import '../app.css';
</script>
```

3. **tailwind.config.jsの設定確認**
```javascript
export default {
  content: [
    './src/**/*.{html,js,svelte,ts}',
    './node_modules/@shadcn-svelte/**/*.{html,js,svelte,ts}'
  ]
};
```

### ダイアログが表示されない

**問題**: Dialog.Rootを使ってもモーダルが表示されない

```svelte
<!-- ❌ 動作しない例 -->
<Dialog.Root>
  <Dialog.Trigger>開く</Dialog.Trigger>
  <Dialog.Content>内容</Dialog.Content>
</Dialog.Root>
```

**解決方法**: bind:openを使用して状態を管理

```svelte
<!-- ✅ 正しい実装 -->
<script>
  let open = $state(false);
</script>

<Dialog.Root bind:open>
  <Dialog.Trigger>
    <Button>開く</Button>
  </Dialog.Trigger>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>タイトル</Dialog.Title>
    </Dialog.Header>
    <!-- 内容 -->
  </Dialog.Content>
</Dialog.Root>
```

## 3. ビルドとデプロイの問題

### TypeScriptエラー

**問題**: svelte-checkでエラーが発生

```bash
Error: Type 'string | undefined' is not assignable to type 'string'
```

**解決方法**: 

1. **Null合体演算子を使用**
```typescript
// ❌ エラーが発生
const value: string = data.value;

// ✅ デフォルト値を提供
const value: string = data.value ?? '';
```

2. **型ガードを使用**
```typescript
if (data.value) {
  // ここではdata.valueはstring型
  const value: string = data.value;
}
```

### ビルドエラー

**問題**: `npm run build`が失敗する

**チェックリスト**:

1. **依存関係の確認**
```bash
# node_modulesを削除して再インストール
rm -rf node_modules package-lock.json
npm install
```

2. **型チェック**
```bash
npm run type-check
```

3. **アダプター設定**
```javascript
// svelte.config.js
import adapter from '@sveltejs/adapter-static';

export default {
  kit: {
    adapter: adapter({
      fallback: 'index.html' // SPAの場合
    })
  }
};
```

## 4. 開発環境の問題

### ホットリロードが動作しない

**問題**: ファイルを変更しても反映されない

**解決方法**:

1. **Vite設定を確認**
```javascript
// vite.config.ts
export default defineConfig({
  server: {
    hmr: true,
    watch: {
      usePolling: true // Dockerやvirtualbox使用時
    }
  }
});
```

2. **開発サーバーを再起動**
```bash
# Ctrl+C で停止してから
npm run dev
```

### WebSocket接続エラー

**問題**: WebSocket接続が失敗する

```
WebSocket connection to 'ws://localhost:5000' failed
```

**解決方法**:

1. **開発環境では無効化**
```typescript
// websocket.svelte.ts
connect() {
  if (import.meta.env.DEV) {
    console.log('WebSocket is disabled in development');
    return;
  }
  // 本番環境でのみ接続
}
```

2. **CORS設定を確認**
```typescript
// バックエンド設定
app.register(cors, {
  origin: 'http://localhost:4444',
  credentials: true
});
```

## 5. パフォーマンスの問題

### 大量データのレンダリング

**問題**: リストが多いと画面がフリーズする

**解決方法**: 仮想スクロールの実装

```svelte
<script>
  import VirtualList from '@tanstack/svelte-virtual';
  
  let items = $state(largeDateArray);
</script>

<VirtualList
  height={600}
  itemHeight={50}
  itemCount={items.length}
  overscan={5}
>
  {#snippet children({ index, style })}
    <div {style}>
      {items[index].name}
    </div>
  {/snippet}
</VirtualList>
```

### 不要な再レンダリング

**問題**: $effectが頻繁に実行される

```svelte
<!-- ❌ 全ての変更で実行される -->
<script>
  let searchTerm = $state('');
  let filter = $state('all');
  
  $effect(() => {
    // searchTermまたはfilterが変更されるたびに実行
    fetchData(searchTerm, filter);
  });
</script>
```

**解決方法**: 依存関係を最小化

```svelte
<!-- ✅ デバウンスを使用 -->
<script>
  let searchTerm = $state('');
  let debouncedSearch = $state('');
  
  $effect(() => {
    const timer = setTimeout(() => {
      debouncedSearch = searchTerm;
    }, 300);
    
    return () => clearTimeout(timer);
  });
  
  $effect(() => {
    if (debouncedSearch) {
      fetchData(debouncedSearch);
    }
  });
</script>
```

## 6. デバッグのヒント

### コンソールデバッグ

```svelte
<script>
  // リアクティブな値の変化を追跡
  $effect(() => {
    console.log('State changed:', { tasks, loading, error });
  });
  
  // propsの確認
  let props = $props();
  $effect(() => {
    console.log('Props:', props);
  });
</script>
```

### Svelte DevTools

1. **Chrome拡張機能をインストール**
   - Svelte DevToolsをChromeウェブストアから追加

2. **コンポーネントツリーの確認**
   - プロパティの値
   - 状態の変化
   - イベントの発火

### エラーバウンダリ

```svelte
<!-- ErrorBoundary.svelte -->
<script>
  import { onMount } from 'svelte';
  
  let hasError = $state(false);
  let error = $state(null);
  
  onMount(() => {
    window.addEventListener('error', (e) => {
      hasError = true;
      error = e.error;
      console.error('Caught error:', e);
    });
  });
</script>

{#if hasError}
  <div class="error-boundary">
    <h2>エラーが発生しました</h2>
    <pre>{error?.stack}</pre>
  </div>
{:else}
  {@render children?.()}
{/if}
```

## まとめ

### 重要なチェックポイント

1. **Svelte 5の新構文を使用しているか**
   - イベントハンドラー: `onclick`
   - プロパティ: `$props()`
   - 状態: `$state()`

2. **型定義が正しいか**
   - APIレスポンスの型
   - コンポーネントのプロパティ型
   - ストアの型定義

3. **設定ファイルが適切か**
   - svelte.config.js
   - vite.config.ts
   - tailwind.config.js

4. **依存関係が最新か**
   - Svelte 5対応バージョン
   - shadcn-svelteの互換性

これらの問題と解決方法を理解することで、Svelte 5アプリケーション開発がスムーズに進められます。
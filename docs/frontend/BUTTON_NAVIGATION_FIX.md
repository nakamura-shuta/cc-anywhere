# ボタンクリックとナビゲーション問題の修正ガイド

## 問題の概要

1. **ボタンクリックが動作しない**
   - Svelte 5の新しいイベントハンドラー構文の違いによる問題
   - `on:click`から`onclick`への移行が必要

2. **ページ遷移時の重複表示**
   - SvelteKitの`goto()`使用時に新しいページが既存ページの下に追加される
   - SSR/CSR設定の問題

## 解決方法

### 1. Svelte 5のイベントハンドラー構文

```svelte
<!-- ❌ Svelte 4の構文（動作しない） -->
<button on:click={handleClick}>クリック</button>

<!-- ✅ Svelte 5の構文（正しい） -->
<button onclick={handleClick}>クリック</button>

<!-- ✅ インラインハンドラーも可能 -->
<button onclick={() => console.log('clicked')}>クリック</button>
```

### 2. shadcn-svelteのButtonコンポーネント

```svelte
<script>
  import { Button } from '$lib/components/ui/button';
  
  function handleClick() {
    console.log('Button clicked!');
  }
</script>

<!-- ✅ Buttonコンポーネントでもonclickを使用 -->
<Button onclick={handleClick}>
  クリック
</Button>
```

### 3. ページ遷移の回避策

```svelte
<script>
  import { goto } from '$app/navigation';
  
  // ❌ 問題のあるパターン（ページが重複表示される）
  function navigateWithGoto() {
    goto('/tasks');
  }
  
  // ✅ 一時的な回避策
  function navigateWithHref() {
    window.location.href = '/tasks';
  }
</script>

<!-- タスク詳細表示ボタンの例 -->
<Button onclick={() => window.location.href = `/tasks/${taskId}`}>
  詳細を見る
</Button>
```

### 4. SSR設定の調整

`src/routes/+layout.ts`:
```typescript
// プリレンダリングを有効化（静的サイト生成）
export const prerender = true;

// サーバーサイドレンダリングを無効化（SPAモード）
export const ssr = false;

// クライアントサイドレンダリングを有効化
export const csr = true;
```

## 注意事項

1. **パフォーマンスへの影響**
   - `window.location.href`はページ全体をリロードするため、SPAの利点が失われる
   - これは一時的な回避策であり、将来的にはSvelteKitの問題が解決されることを期待

2. **型チェック**
   - Buttonコンポーネントの`onclick`プロパティは型定義に含まれており、型安全

3. **WebSocket接続**
   - 開発環境では無効化（`ENABLE_WEBSOCKET = false`）
   - ページリロード時の再接続エラーを防ぐため

## 今後の改善点

1. SvelteKitのルーティング問題の根本的な解決
2. SPAモードでの適切なナビゲーション実装
3. WebSocket接続の安定化
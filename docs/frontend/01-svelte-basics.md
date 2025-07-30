# Svelte 5 基礎ガイド

## Svelteとは？

Svelteは、ReactやVueとは異なるアプローチを取るフロントエンドフレームワークです。最大の特徴は「コンパイル時にバニラJavaScriptに変換される」ことで、ランタイムが不要なため高速に動作します。

## 1. Svelteコンポーネントの基本構造

Svelteコンポーネントは `.svelte` ファイルで、以下の3つのセクションから構成されます：

```svelte
<!-- Button.svelte -->
<script>
  // JavaScriptロジック
  let count = 0;
  
  function increment() {
    count += 1;
  }
</script>

<!-- HTMLテンプレート -->
<button onclick={increment}>
  クリック回数: {count}
</button>

<style>
  /* コンポーネントスコープのCSS */
  button {
    background-color: #4CAF50;
    color: white;
    padding: 10px 20px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }
</style>
```

## 2. Svelte 5の新機能：Runes

Svelte 5では「Runes」という新しい反応性システムが導入されました：

### $state - リアクティブな状態管理

```svelte
<script>
  // 従来のSvelte 4
  // let count = 0;
  
  // Svelte 5のRunes
  let count = $state(0);
  let user = $state({ name: 'Alice', age: 25 });
  
  function updateUser() {
    user.name = 'Bob'; // 自動的に再レンダリング
  }
</script>
```

### $props - プロパティの受け取り

```svelte
<!-- 子コンポーネント: UserCard.svelte -->
<script>
  // 従来のSvelte 4
  // export let name;
  // export let age;
  
  // Svelte 5
  let { name, age, role = 'user' } = $props();
</script>

<div class="user-card">
  <h3>{name}</h3>
  <p>年齢: {age}</p>
  <p>役割: {role}</p>
</div>

<!-- 親コンポーネントでの使用 -->
<UserCard name="Alice" age={25} />
<UserCard name="Bob" age={30} role="admin" />
```

### $effect - 副作用の処理

```svelte
<script>
  let searchTerm = $state('');
  let results = $state([]);
  
  // searchTermが変更されるたびに実行
  $effect(() => {
    if (searchTerm.length > 2) {
      fetchSearchResults(searchTerm).then(data => {
        results = data;
      });
    }
  });
  
  async function fetchSearchResults(term) {
    const response = await fetch(`/api/search?q=${term}`);
    return response.json();
  }
</script>

<input bind:value={searchTerm} placeholder="検索..." />
```

## 3. イベントハンドリング

Svelte 5では、イベントハンドラーの書き方が変更されました：

```svelte
<script>
  function handleClick() {
    console.log('クリックされました！');
  }
  
  function handleInput(event) {
    console.log('入力値:', event.target.value);
  }
</script>

<!-- Svelte 4の書き方（動作しない） -->
<!-- <button on:click={handleClick}>クリック</button> -->

<!-- Svelte 5の書き方 -->
<button onclick={handleClick}>クリック</button>
<input oninput={handleInput} />

<!-- インラインハンドラーも可能 -->
<button onclick={() => console.log('インライン！')}>
  インラインハンドラー
</button>
```

## 4. 条件付きレンダリング

```svelte
<script>
  let isLoggedIn = $state(false);
  let userRole = $state('guest');
</script>

<!-- if文 -->
{#if isLoggedIn}
  <p>ようこそ！</p>
{:else}
  <p>ログインしてください</p>
{/if}

<!-- if-else if-else -->
{#if userRole === 'admin'}
  <AdminPanel />
{:else if userRole === 'user'}
  <UserDashboard />
{:else}
  <GuestView />
{/if}
```

## 5. リストレンダリング

```svelte
<script>
  let todos = $state([
    { id: 1, text: 'Svelteを学ぶ', done: false },
    { id: 2, text: 'アプリを作る', done: false },
    { id: 3, text: 'デプロイする', done: false }
  ]);
  
  function toggleTodo(id) {
    const todo = todos.find(t => t.id === id);
    if (todo) {
      todo.done = !todo.done;
    }
  }
</script>

<ul>
  {#each todos as todo (todo.id)}
    <li>
      <input 
        type="checkbox" 
        checked={todo.done}
        onchange={() => toggleTodo(todo.id)}
      />
      <span class:done={todo.done}>{todo.text}</span>
    </li>
  {/each}
</ul>

<style>
  .done {
    text-decoration: line-through;
    opacity: 0.5;
  }
</style>
```

## 6. 双方向バインディング

```svelte
<script>
  let name = $state('');
  let email = $state('');
  let newsletter = $state(false);
  let country = $state('japan');
</script>

<!-- テキスト入力 -->
<input bind:value={name} placeholder="名前" />

<!-- チェックボックス -->
<label>
  <input type="checkbox" bind:checked={newsletter} />
  ニュースレターを受け取る
</label>

<!-- セレクトボックス -->
<select bind:value={country}>
  <option value="japan">日本</option>
  <option value="usa">アメリカ</option>
  <option value="uk">イギリス</option>
</select>

<p>入力内容: {name} / {email} / {newsletter} / {country}</p>
```

## 7. コンポーネント間の通信

### 親から子へ（Props）

```svelte
<!-- Parent.svelte -->
<script>
  import Child from './Child.svelte';
  
  let message = $state('親からのメッセージ');
</script>

<Child message={message} />

<!-- Child.svelte -->
<script>
  let { message } = $props();
</script>

<p>{message}</p>
```

### 子から親へ（カスタムイベント）

```svelte
<!-- Child.svelte -->
<script>
  let { onUpdate } = $props();
  
  function handleClick() {
    onUpdate?.('子からのデータ');
  }
</script>

<button onclick={handleClick}>親に通知</button>

<!-- Parent.svelte -->
<script>
  import Child from './Child.svelte';
  
  function handleUpdate(data) {
    console.log('子から受信:', data);
  }
</script>

<Child onUpdate={handleUpdate} />
```

## 8. スロット（コンテンツの挿入）

```svelte
<!-- Card.svelte -->
<script>
  let { title } = $props();
</script>

<div class="card">
  <h3>{title}</h3>
  <div class="card-content">
    {@render children?.()}
  </div>
</div>

<!-- 使用例 -->
<Card title="お知らせ">
  <p>ここにカードの内容が入ります</p>
  <button>詳細を見る</button>
</Card>
```

## 9. ライフサイクル

```svelte
<script>
  import { onMount } from 'svelte';
  
  let data = $state(null);
  
  // コンポーネントがマウントされた時
  onMount(() => {
    fetchData();
    
    // クリーンアップ関数（アンマウント時に実行）
    return () => {
      console.log('コンポーネントが破棄されました');
    };
  });
  
  async function fetchData() {
    const response = await fetch('/api/data');
    data = await response.json();
  }
</script>
```

## 10. ストア（グローバルな状態管理）

```javascript
// stores/counter.js
import { writable } from 'svelte/store';

export const count = writable(0);

// カスタムストア
export function createCounter() {
  const { subscribe, set, update } = writable(0);
  
  return {
    subscribe,
    increment: () => update(n => n + 1),
    decrement: () => update(n => n - 1),
    reset: () => set(0)
  };
}
```

```svelte
<!-- Component.svelte -->
<script>
  import { count } from './stores/counter.js';
  
  // $プレフィックスで自動購読
  function increment() {
    $count += 1;
  }
</script>

<p>カウント: {$count}</p>
<button onclick={increment}>増加</button>
```

## まとめ

Svelte 5の主な特徴：
- **Runes** (`$state`, `$props`, `$effect`) による直感的な反応性
- **コンパイル時最適化** による高速な実行
- **組み込みの状態管理** （外部ライブラリ不要）
- **シンプルな構文** による学習の容易さ
- **小さなバンドルサイズ** による高速なロード

次のドキュメントでは、shadcn-svelteを使ったUIコンポーネントの構築方法を学びます。
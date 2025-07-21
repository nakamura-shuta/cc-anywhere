# Svelte/SvelteKit 技術用語集

## 基本用語

### コンポーネント（Component）
- **意味**: 再利用可能なUI部品
- **例**: ボタン、カード、ヘッダーなど
- **Svelteでの書き方**:
  ```svelte
  <!-- Button.svelte -->
  <button>
    クリックしてください
  </button>
  ```

### プロップス（Props）
- **意味**: 親コンポーネントから子コンポーネントへ渡すデータ
- **例**:
  ```svelte
  <!-- 親コンポーネント -->
  <Button text="送信" color="blue" />
  
  <!-- 子コンポーネント（Button.svelte） -->
  <script>
    export let text;
    export let color;
  </script>
  <button style="color: {color}">{text}</button>
  ```

### リアクティブ（Reactive）
- **意味**: データが変更されたら自動的にUIも更新される仕組み
- **例**:
  ```svelte
  <script>
    let count = 0;
    // countが変わると画面も自動更新
  </script>
  <button on:click={() => count++}>
    クリック回数: {count}
  </button>
  ```

### ストア（Store）
- **意味**: コンポーネント間でデータを共有する仕組み
- **例**: ユーザー情報、テーマ設定など

## SvelteKit特有の用語

### ルーティング（Routing）
- **意味**: URLとページを対応させる仕組み
- **SvelteKitの特徴**: ファイル名で自動的にルートが決まる
  ```
  src/routes/+page.svelte → /
  src/routes/about/+page.svelte → /about
  src/routes/blog/[id]/+page.svelte → /blog/123
  ```

### レイアウト（Layout）
- **意味**: 複数のページで共通する部分（ヘッダー、フッターなど）
- **ファイル**: `+layout.svelte`
- **例**: 全ページ共通のナビゲーションバー

### SSR（Server-Side Rendering）
- **意味**: サーバー側でHTMLを生成してから送信
- **メリット**: 
  - 初回表示が速い
  - SEO（検索エンジン最適化）に有利
- **デメリット**: サーバーの負荷が高い

### CSR（Client-Side Rendering）
- **意味**: ブラウザ側でJavaScriptを実行してHTMLを生成
- **メリット**: インタラクティブな操作が速い
- **デメリット**: 初回表示が遅い

### ハイドレーション（Hydration）
- **意味**: サーバーで生成したHTMLにブラウザでJavaScriptの機能を追加
- **流れ**: SSR → HTML送信 → JavaScriptで機能追加

## Svelte記法

### リアクティブ宣言（$:）
- **意味**: 他の値に依存して自動更新される値
- **例**:
  ```svelte
  <script>
    let width = 10;
    let height = 20;
    $: area = width * height; // widthかheightが変わると自動計算
  </script>
  ```

### バインディング（bind:）
- **意味**: 入力要素とデータを双方向で結びつける
- **例**:
  ```svelte
  <script>
    let name = '';
  </script>
  <input bind:value={name} />
  <p>こんにちは、{name}さん！</p>
  ```

### イベントハンドリング（on:）
- **意味**: クリックなどのイベントを処理
- **例**:
  ```svelte
  <button on:click={() => alert('クリックされました')}>
    クリック
  </button>
  ```

### 条件付きレンダリング（{#if}）
- **意味**: 条件によって表示/非表示を切り替え
- **例**:
  ```svelte
  {#if loggedIn}
    <p>ようこそ！</p>
  {:else}
    <p>ログインしてください</p>
  {/if}
  ```

### リストレンダリング（{#each}）
- **意味**: 配列の要素を繰り返し表示
- **例**:
  ```svelte
  {#each items as item}
    <li>{item.name}</li>
  {/each}
  ```

## shadcn-svelte用語

### バリアント（Variant）
- **意味**: コンポーネントの見た目のバリエーション
- **例**: 
  - `default`: 標準のボタン
  - `outline`: 枠線のみのボタン
  - `ghost`: 背景なしのボタン
  - `destructive`: 削除など危険な操作用

### サイズ（Size）
- **意味**: コンポーネントの大きさ
- **例**: `sm`（小）、`default`（標準）、`lg`（大）

### cn関数
- **意味**: クラス名を結合するユーティリティ関数
- **用途**: Tailwindのクラス名の重複を解決
- **例**:
  ```typescript
  cn('bg-blue-500', 'bg-red-500') // → 'bg-red-500'（後の方が優先）
  ```

## Tailwind CSS用語

### ユーティリティクラス
- **意味**: 単一の目的を持つ小さなCSSクラス
- **例**:
  - `bg-blue-500`: 青い背景
  - `text-white`: 白い文字
  - `p-4`: パディング1rem
  - `rounded`: 角丸

### レスポンシブプレフィックス
- **意味**: 画面サイズごとにスタイルを変える
- **例**:
  - `md:text-lg`: 中画面以上で文字を大きく
  - `lg:grid-cols-3`: 大画面で3列グリッド

### ダークモード
- **意味**: 暗い配色のUI
- **Tailwindでの書き方**: `dark:bg-gray-800`（ダークモード時のみ適用）

## 開発ツール用語

### HMR（Hot Module Replacement）
- **意味**: コードを変更すると自動的にブラウザが更新される機能
- **メリット**: 開発効率が向上

### ビルド（Build）
- **意味**: 本番環境用にコードを最適化すること
- **コマンド**: `npm run build`

### デプロイ（Deploy）
- **意味**: アプリケーションを公開すること
- **方法**: Vercel、Netlify、CloudFlareなど

### 型チェック（Type Check）
- **意味**: TypeScriptの型が正しいか確認
- **コマンド**: `npm run check`

### リンター（Linter）
- **意味**: コードの品質をチェックするツール
- **例**: ESLint（コードスタイルの統一）
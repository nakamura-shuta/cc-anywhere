# CC-Anywhere Svelte/SvelteKit セットアップガイド

## 概要

このドキュメントでは、CC-AnywereのフロントエンドをSvelte/SvelteKitとshadcn-svelteを使用して構築した手順を解説します。

## 技術用語の解説

### Svelte（スヴェルト）
- **概要**: JavaScriptフレームワークの一種で、ReactやVueと同じようにWebアプリケーションを作るためのツール
- **特徴**: 
  - コンパイル時に最適化されたJavaScriptコードを生成（ビルド時に変換）
  - 仮想DOMを使わないため、高速で軽量
  - 学習曲線が緩やか（覚えることが少ない）
- **例**: `.svelte`ファイルにHTML、CSS、JavaScriptを一緒に書ける

### SvelteKit（スヴェルトキット）
- **概要**: Svelteの公式フレームワーク。Next.js（React用）のSvelte版と考えると分かりやすい
- **特徴**:
  - ルーティング（ページ遷移）が自動
  - SSR（サーバーサイドレンダリング）対応
  - API作成機能も内蔵
- **フォルダ構造**:
  ```
  src/routes/          # ページファイルを置く場所
  src/routes/+page.svelte    # ホームページ（/）
  src/routes/tasks/+page.svelte  # タスクページ（/tasks）
  ```

### shadcn-svelte（シャドウシーエヌ・スヴェルト）
- **概要**: 美しいUIコンポーネントを提供するライブラリ
- **特徴**:
  - コピー＆ペーストで使える（npmパッケージではない）
  - カスタマイズが容易
  - Tailwind CSSベース
- **例**: ボタン、カード、ダイアログなどのUI部品

### Tailwind CSS（テイルウィンド）
- **概要**: ユーティリティファーストのCSSフレームワーク
- **特徴**:
  - クラス名で直接スタイルを指定
  - `class="bg-blue-500 text-white p-4"`のような記述
  - CSSファイルを書く必要が少ない

## セットアップ手順

### 1. 前提条件の確認
```bash
# Node.jsがインストールされているか確認
node --version  # v18以上推奨

# npmがインストールされているか確認
npm --version
```

### 2. SvelteKitプロジェクトの作成

当初は以下のコマンドを試しましたが、廃止されていました：
```bash
# 廃止されたコマンド（使用不可）
npm create svelte@latest frontend-svelte
```

代わりにViteテンプレートを使用：
```bash
# Viteを使用したSvelteプロジェクト作成
npm create vite@latest frontend-svelte -- --template svelte-ts

# ディレクトリに移動
cd frontend-svelte

# 依存関係をインストール
npm install
```

### 3. SvelteKitへの変換

ViteのSvelteテンプレートからSvelteKitに変換：

```bash
# SvelteKit関連パッケージをインストール
npm install -D @sveltejs/kit @sveltejs/adapter-auto @sveltejs/vite-plugin-svelte
```

### 4. 不要なファイルの削除

Viteテンプレートの不要なファイルを削除：
```bash
rm -f index.html src/main.ts src/App.svelte src/app.css src/vite-env.d.ts
rm -rf src/assets src/lib/Counter.svelte
```

### 5. SvelteKit用のファイル構造作成

```bash
# ルートディレクトリ作成
mkdir -p src/routes

# 各ページファイルを作成
touch src/routes/+page.svelte        # ホームページ
touch src/routes/+layout.svelte      # 共通レイアウト
mkdir -p src/routes/tasks
touch src/routes/tasks/+page.svelte  # タスク一覧ページ
mkdir -p src/routes/scheduler  
touch src/routes/scheduler/+page.svelte  # スケジューラーページ
mkdir -p src/routes/settings
touch src/routes/settings/+page.svelte   # 設定ページ

# グローバルCSSファイル作成
touch src/app.css
```

### 6. Tailwind CSS v4のセットアップ

最新のTailwind CSS v4を使用（従来とは設定方法が異なります）：

```bash
# Tailwind CSS v4と関連パッケージをインストール
npm install -D tailwindcss@next @tailwindcss/vite
```

`vite.config.ts`を更新：
```typescript
import { defineConfig } from 'vite'
import { sveltekit } from '@sveltejs/kit/vite'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    sveltekit(),
    tailwindcss()  // Tailwind CSS v4 Viteプラグイン
  ],
})
```

`src/app.css`を作成：
```css
/* Tailwind CSS v4の新しいインポート方法 */
@import "tailwindcss";
```

### 7. shadcn-svelteのインストール

#### 問題と解決策

最初は`@next`バージョンで試みましたが、レジストリエラーが発生：
```bash
# エラーが発生したコマンド
npx shadcn-svelte@next init
# Error: Error parsing json response from https://next.shadcn-svelte.com/registry/index.json
```

安定版（`@latest`）を使用することで解決：
```bash
# 安定版を使用（成功）
npx shadcn-svelte@latest init
```

設定項目：
- **Base color**: Slate（スレート色をベースカラーに）
- **Global CSS file**: src/app.css
- **Import aliases**: デフォルトのまま

### 8. コンポーネントの追加

Buttonコンポーネントを追加：
```bash
npx shadcn-svelte@latest add button
```

これにより以下が作成されます：
- `src/lib/components/ui/button/` - Buttonコンポーネント
- `src/lib/utils.ts` - ユーティリティ関数（cn関数など）

### 9. 開発サーバーの起動

```bash
# デフォルトポート（4444）で起動
npm run dev

# カスタムポート（4444）で起動
npm run dev -- --port 4444
```

## ファイル構造の説明

```
frontend-svelte/
├── src/
│   ├── routes/              # ページファイル
│   │   ├── +layout.svelte   # 全ページ共通のレイアウト
│   │   ├── +page.svelte     # ホームページ（/）
│   │   ├── tasks/
│   │   │   └── +page.svelte # タスク一覧（/tasks）
│   │   ├── scheduler/
│   │   │   └── +page.svelte # スケジューラー（/scheduler）
│   │   └── settings/
│   │       └── +page.svelte # 設定（/settings）
│   ├── lib/                 # 共有コンポーネント・ユーティリティ
│   │   ├── components/
│   │   │   └── ui/         # shadcn-svelteのUIコンポーネント
│   │   │       └── button/
│   │   └── utils.ts        # ユーティリティ関数
│   └── app.css             # グローバルCSS
├── static/                  # 静的ファイル（画像など）
├── vite.config.ts          # Vite設定
├── svelte.config.js        # SvelteKit設定
├── package.json            # プロジェクト設定
└── components.json         # shadcn-svelte設定
```

## コンポーネントの使用例

### Buttonコンポーネントの使用

```svelte
<script lang="ts">
  import { Button } from '$lib/components/ui/button';
</script>

<!-- デフォルトボタン -->
<Button>クリック</Button>

<!-- バリアント（見た目の種類）を指定 -->
<Button variant="outline">アウトライン</Button>
<Button variant="ghost">ゴースト</Button>

<!-- サイズを指定 -->
<Button size="sm">小さい</Button>
<Button size="lg">大きい</Button>

<!-- リンクとして使用 -->
<Button href="/tasks">タスク一覧へ</Button>
```

## トラブルシューティング

### 1. npm create svelte@latestが動作しない
- **原因**: 廃止されたCLI
- **解決策**: Viteテンプレートを使用してからSvelteKitに変換

### 2. shadcn-svelte@next initでレジストリエラー
- **原因**: @nextバージョンのレジストリに問題
- **解決策**: `@latest`（安定版）を使用

### 3. Tailwind CSSが適用されない
- **原因**: v4の設定方法が異なる
- **解決策**: `@tailwindcss/vite`プラグインを使用

### 4. ページが404エラー
- **原因**: SvelteKitのルートファイルが存在しない
- **解決策**: `src/routes/[ページ名]/+page.svelte`を作成

## 次のステップ

1. **WebSocket統合**: リアルタイム通信の実装
2. **API連携**: バックエンドとの接続
3. **認証機能**: ユーザー認証の実装
4. **状態管理**: Svelte Storeの活用

## 参考リンク

- [Svelte公式ドキュメント](https://svelte.dev/)
- [SvelteKit公式ドキュメント](https://kit.svelte.dev/)
- [shadcn-svelte公式サイト](https://www.shadcn-svelte.com/)
- [Tailwind CSS v4ドキュメント](https://tailwindcss.com/)
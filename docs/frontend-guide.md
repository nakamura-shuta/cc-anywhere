# CC-Anywhere フロントエンド開発ガイド

最終更新: 2025-01-22

## 概要

CC-Anywhere のフロントエンドは Svelte 5 と SvelteKit を使用して構築されています。このドキュメントでは、開発環境のセットアップから本番デプロイまでの手順を説明します。

## クイックスタート

```bash
# リポジトリのクローン
git clone <repository-url>
cd cc-anywhere/frontend

# 依存関係のインストール
npm install

# 開発サーバーの起動
npm run dev
```

## 主要コマンド一覧

| コマンド | 説明 | 用途 |
|---------|------|------|
| `npm run dev` | 開発サーバー起動（HMR有効） | 開発時 |
| `npm run build` | プロダクションビルド | 本番デプロイ前 |
| `npm run preview` | ビルド結果のプレビュー | ビルド確認 |
| `npm run test` | テスト実行（単発） | CI/CD |
| `npm run test:watch` | テスト実行（監視モード） | 開発時 |
| `npm run check` | 型チェック | コミット前 |
| `npm run lint` | ESLintチェック | コミット前 |
| `npm run lint:fix` | ESLint自動修正 | コード整形 |

## 開発フロー

### 1. 機能開発

```bash
# 開発サーバー起動
npm run dev

# 別ターミナルでテスト監視
npm run test:watch
```

### 2. コミット前チェック

```bash
# 型チェック
npm run check

# Lintチェック
npm run lint

# テスト実行
npm run test
```

### 3. ビルド確認

```bash
# プロダクションビルド
npm run build

# ビルド結果の動作確認
npm run preview
```

## Svelte 5 移行ガイド

### 主な変更点

#### 1. Props の定義

```svelte
<!-- 旧: Svelte 4 -->
<script lang="ts">
  export let value: string;
  export let disabled = false;
</script>

<!-- 新: Svelte 5 -->
<script lang="ts">
  interface Props {
    value: string;
    disabled?: boolean;
  }
  
  let { value, disabled = false }: Props = $props();
</script>
```

#### 2. Slot の使用

```svelte
<!-- 旧: Svelte 4 -->
<slot />
<slot name="header" />

<!-- 新: Svelte 5 -->
{@render children?.()}
{@render header?.()}
```

#### 3. State の管理

```svelte
<!-- 旧: Svelte 4 -->
<script lang="ts">
  let count = 0;
  $: doubled = count * 2;
</script>

<!-- 新: Svelte 5 -->
<script lang="ts">
  let count = $state(0);
  let doubled = $derived(count * 2);
</script>
```

#### 4. イベントハンドラー

```svelte
<!-- 旧: Svelte 4 -->
<button on:click={handleClick}>
<form on:submit|preventDefault={handleSubmit}>

<!-- 新: Svelte 5 -->
<button onclick={handleClick}>
<form onsubmit={handleSubmit}>
```

## テスト戦略

### 単体テスト

Vitest と @testing-library/svelte を使用：

```typescript
import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import MyComponent from './MyComponent.svelte';

describe('MyComponent', () => {
  it('レンダリングテスト', () => {
    const { getByText } = render(MyComponent, {
      props: { message: 'Hello' }
    });
    
    expect(getByText('Hello')).toBeInTheDocument();
  });
});
```

### 現在のテストカバレッジ

- コンポーネントテスト: 21件（Button）、8件（Badge）、6件（Card）
- ストアテスト: 8件（task store）
- WebSocketテスト: 8件
- **合計: 51テスト（すべて成功）**

## ESLint設定

ESLint 9 のフラットコンフィグ形式を使用しています：

### 主な設定

- Svelte 5 対応（eslint-plugin-svelte）
- TypeScript 対応
- Svelte runes（`$state`、`$derived`など）をグローバル変数として認識
- 警告レベルで`any`型の使用を検出

### 現在の状態

- **エラー: 0件**
- **警告: 22件**（すべて`any`型の使用に関する警告）

## ビルドプロセス

### 開発ビルド

```bash
npm run dev
# Vite開発サーバーが起動
# ホットモジュールリロード（HMR）有効
# http://localhost:5173
```

### プロダクションビルド

```bash
npm run build
# 1. TypeScriptのトランスパイル
# 2. Svelteコンポーネントのコンパイル
# 3. 静的アセットの最適化
# 4. build/ディレクトリに出力
```

### ビルド成果物

```
build/
├── client/          # クライアントサイドアセット
│   ├── _app/        # JavaScriptチャンク
│   └── assets/      # 静的アセット
├── server/          # サーバーサイドコード
└── prerendered/     # プリレンダリングされたページ
```

## パフォーマンス最適化

### 実装済みの最適化

1. **コード分割**: SvelteKitの自動コード分割
2. **遅延読み込み**: 動的インポートによるコンポーネントの遅延読み込み
3. **静的アダプター**: SSGによる高速な初期表示
4. **Tailwind CSS**: 未使用スタイルの自動削除

### 推奨事項

- 大きなコンポーネントは動的インポートを使用
- 画像は適切なフォーマット（WebP、AVIF）を使用
- WebSocket接続は必要な画面でのみ確立

## トラブルシューティング

### よくある問題と解決方法

#### 1. ビルドエラー

```bash
# .svelte-kitディレクトリの再生成
rm -rf .svelte-kit
npm run sync
npm run build
```

#### 2. 型エラー

```bash
# 型定義の更新
npm run check
```

#### 3. テスト失敗

```bash
# テストキャッシュのクリア
npm run test -- --clearCache
```

#### 4. ESLintエラー

```bash
# 自動修正
npm run lint:fix
```

## デプロイ

### 静的サイトとしてデプロイ

```bash
# ビルド
npm run build

# build/ディレクトリを静的ホスティングサービスにアップロード
# （Netlify、Vercel、GitHub Pagesなど）
```

### Dockerでのデプロイ

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/build /usr/share/nginx/html
```

## 今後の開発予定

- [ ] スケジューラーUIの実装
- [ ] 設定画面の実装
- [ ] 国際化（i18n）対応
- [ ] ダークモード対応
- [ ] PWA対応
# CC-Anywhere フロントエンド開発ガイド

このガイドは、Svelte 5とshadcn-svelteを使用したCC-Anywhereフロントエンドの包括的なドキュメントです。初学者でもステップバイステップで学習できるように構成されています。

## 📚 ドキュメント構成

### 1. [Svelte 5 基礎ガイド](./01-svelte-basics.md)
Svelte 5の基本概念と新機能（Runes）について学びます。
- コンポーネントの基本構造
- Runesシステム（$state, $props, $effect）
- イベントハンドリング
- 条件付きレンダリングとリスト表示
- 双方向バインディング

### 2. [shadcn-svelte 基礎ガイド](./02-shadcn-svelte-basics.md)
shadcn-svelteの導入と基本的なUIコンポーネントの使い方を解説します。
- セットアップ方法
- 主要コンポーネントの使用例
  - Button, Card, Input, Table, Badge, Dialog, Select
- テーマのカスタマイズ
- 実践的な組み合わせ例

### 3. [CC-Anywhere アーキテクチャ](./03-architecture.md)
アプリケーションの全体構造と設計思想を理解します。
- ディレクトリ構造
- レイヤーアーキテクチャ
- データフロー
- ビルドとデプロイ
- パフォーマンス最適化

### 4. [実装例](./04-practical-examples.md)
CC-Anywhereの実際のコードを通じて、実践的な実装パターンを学びます。
- タスク一覧ページの完全な実装
- データ取得パターン（+page.ts）
- グローバルレイアウト
- サービス層の実装
- リアクティブな状態管理

### 5. [テストガイド](./05-testing-guide.md)
Vitest を使用したコンポーネントテストの書き方を解説します。
- テスト環境のセットアップ
- コンポーネントテストのパターン
- 非同期処理のテスト
- ストアのテスト
- ベストプラクティス

### 6. [トラブルシューティング](./06-troubleshooting.md)
開発中に遭遇する可能性のある問題と解決方法をまとめています。
- よくあるエラーと解決方法
- shadcn-svelteの問題
- ビルドとデプロイの問題
- パフォーマンスの問題
- デバッグのヒント

## 🚀 学習の進め方

### 初心者の方へ

1. **基礎を固める**
   - まず「Svelte 5 基礎ガイド」を読んで、Svelteの基本概念を理解してください
   - 特にRunesシステムとイベントハンドリングの変更点は重要です

2. **UIコンポーネントを学ぶ**
   - 「shadcn-svelte 基礎ガイド」で、再利用可能なUIコンポーネントの使い方を学びます
   - 実際にコンポーネントを使ってみることが大切です

3. **アーキテクチャを理解する**
   - 「CC-Anywhere アーキテクチャ」で、実際のプロジェクト構造を理解します
   - なぜこのような構造になっているかを考えながら読んでください

4. **実践的なコードを読む**
   - 「実装例」で、実際のコードがどのように書かれているかを学びます
   - コードをコピーして、自分で動かしてみましょう

5. **テストを書く**
   - 「テストガイド」を参考に、作成したコンポーネントのテストを書いてみます
   - テストを書くことで、コンポーネントの理解が深まります

6. **問題解決スキルを身につける**
   - 「トラブルシューティング」は、問題に遭遇したときに参照してください
   - よくある問題とその解決方法を知っておくことで、開発効率が向上します

## 🛠️ 開発環境のセットアップ

### 必要なツール

```bash
# Node.js (v18以上)
node --version

# npm または pnpm
npm --version

# 推奨: VS Code with Svelte extension
```

### プロジェクトの起動

```bash
# フロントエンドディレクトリに移動
cd frontend

# 依存関係のインストール
npm install

# 開発サーバーの起動
npm run dev

# ブラウザで http://localhost:4444 を開く
```

### 便利なコマンド

```bash
# 型チェック
npm run type-check

# Lintチェック
npm run lint

# テスト実行
npm run test:unit

# ビルド
npm run build
```

## 📝 コーディング規約

### 命名規則
- コンポーネント名: PascalCase（例: `TaskList.svelte`）
- 関数名: camelCase（例: `handleClick`）
- ファイル名: kebab-case（例: `task-service.ts`）

### インポート順序
1. 外部ライブラリ
2. SvelteKit関連
3. 内部コンポーネント
4. 型定義
5. スタイル

```typescript
// 外部ライブラリ
import { format } from 'date-fns';

// SvelteKit
import { page } from '$app/stores';

// 内部コンポーネント
import { Button } from '$lib/components/ui/button';

// 型定義
import type { TaskResponse } from '$lib/types/api';
```

## 🔗 参考リンク

- [Svelte 5 公式ドキュメント](https://svelte.dev/docs)
- [SvelteKit ドキュメント](https://kit.svelte.dev/docs)
- [shadcn-svelte](https://www.shadcn-svelte.com/)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Vitest](https://vitest.dev/)

## 💡 Tips

### Svelte 5 への移行
既存のSvelte 4プロジェクトから移行する場合：
- イベントハンドラーを `on:click` から `onclick` に変更
- `export let` を `$props()` に変更
- リアクティブな変数に `$state()` を使用

### パフォーマンスの最適化
- 大量のデータを扱う場合は仮想スクロールを検討
- `$effect` の依存関係を最小化
- 画像の遅延読み込みを活用

### デバッグ
- Svelte DevTools を活用
- `$inspect()` rune でリアクティブな値を監視
- エラーバウンダリーを実装してエラーをキャッチ

---

このガイドを通じて、Svelte 5とshadcn-svelteを使用したモダンなフロントエンド開発を習得できることを願っています。質問や改善提案がある場合は、プロジェクトのIssueにてお知らせください。

Happy Coding! 🎉
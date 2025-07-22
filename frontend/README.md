# CC-Anywhere Frontend

CC-Anywhere のフロントエンドアプリケーション。Svelte 5 と SvelteKit を使用して構築されています。

## 技術スタック

- **フレームワーク**: Svelte 5 + SvelteKit
- **UI コンポーネント**: shadcn-svelte
- **スタイリング**: Tailwind CSS v4
- **テスト**: Vitest + @testing-library/svelte
- **Lint**: ESLint 9 (Flat Config)
- **型チェック**: TypeScript 5.8

## セットアップ

```bash
# 依存関係のインストール
npm install

# 開発サーバーの起動
npm run dev
```

開発サーバーは http://localhost:4444 で起動します。

## 開発コマンド

### ビルド

```bash
# プロダクションビルド
npm run build

# ビルド結果のプレビュー
npm run preview
```

### テスト

```bash
# 単体テストを一度実行
npm run test

# テストをwatchモードで実行
npm run test:watch

# テストUIを起動
npm run test:ui

# カバレッジレポート付きでテスト実行
npm run test:coverage
```

### 型チェック

```bash
# TypeScriptの型チェックとSvelteコンポーネントのチェック
npm run check
```

### Lint

```bash
# ESLintでコード品質チェック
npm run lint

# 自動修正可能な問題を修正
npm run lint:fix
```

### その他

```bash
# SvelteKitのファイル同期
npm run sync
```

## プロジェクト構造

```
frontend/
├── src/
│   ├── routes/              # ページコンポーネント
│   │   ├── +layout.svelte   # 共通レイアウト
│   │   ├── +page.svelte     # ダッシュボード
│   │   ├── tasks/           # タスク管理ページ
│   │   ├── logs/            # ログ表示ページ
│   │   ├── api/             # API Explorer
│   │   ├── scheduler/       # スケジューラー（未実装）
│   │   └── settings/        # 設定（未実装）
│   ├── lib/
│   │   ├── components/      # 再利用可能なコンポーネント
│   │   │   ├── ui/          # shadcn-svelteコンポーネント
│   │   │   └── providers/   # コンテキストプロバイダー
│   │   ├── api/             # API通信層
│   │   ├── websocket/       # WebSocket通信
│   │   ├── stores/          # Svelteストア
│   │   ├── services/        # ビジネスロジック
│   │   ├── hooks/           # カスタムフック
│   │   ├── types/           # TypeScript型定義
│   │   └── config/          # 設定ファイル
│   └── app.html             # HTMLテンプレート
├── static/                  # 静的ファイル
├── tests/                   # テストファイル
├── .svelte-kit/             # SvelteKitビルド成果物（自動生成）
└── build/                   # プロダクションビルド成果物
```

## 現在の実装状況

### 実装済み ✅

- ダッシュボード（統計情報の表示）
- タスク一覧（作成・表示・フィルタリング）
- タスク詳細（リアルタイム更新）
- 新規タスク作成
- ログ表示（リアルタイム更新）
- API Explorer（タスク実行インターフェース）
- WebSocket通信（リアルタイム更新）
- レスポンシブサイドバーレイアウト
- Svelte 5完全対応（runes構文）
- 型安全性（TypeScript + svelte-check）

### 未実装 🚧

- スケジューラーUI
- 設定画面

## テスト

現在、51個のテストが実装されており、すべて成功しています：

- コンポーネントテスト（Button、Badge、Cardなど）
- ストアテスト（task、websocket）
- API通信テスト
- WebSocketテスト

### テスト実行例

```bash
# テストを実行
npm run test

 ✓ src/lib/components/ui/button/button.svelte.test.ts (21)
 ✓ src/lib/components/ui/badge/badge.svelte.test.ts (8)
 ✓ src/lib/components/ui/card/card.svelte.test.ts (6)
 ✓ src/lib/stores/task.svelte.test.ts (8)
 ✓ src/lib/websocket/websocket.svelte.test.ts (8)

 Test Files  5 passed (5)
      Tests  51 passed (51)
```

## Lint状態

ESLint設定済み。現在エラーは0件：

```bash
# Lintチェック
npm run lint

✖ 22 problems (0 errors, 22 warnings)
```

警告はすべて`any`型の使用に関するもので、必要に応じて後から修正可能です。

## ビルドと起動

### 開発環境

```bash
# 開発サーバー起動（ホットリロード有効）
npm run dev

  VITE v7.0.5  ready in 1234 ms

  ➜  Local:   http://localhost:4444/
  ➜  Network: use --host to expose
  ➜  press h + enter to show help
```

### プロダクションビルド

```bash
# ビルド実行
npm run build

# ビルド結果の確認
npm run preview
```

## APIサーバーとの接続

フロントエンドはデフォルトで以下のエンドポイントに接続します：

- REST API: `http://localhost:5000/api`
- WebSocket: `ws://localhost:5000/ws`

環境変数でカスタマイズ可能：

```bash
PUBLIC_API_URL=http://your-api-server:5000 npm run dev
```

## トラブルシューティング

### ビルドエラーが発生する場合

```bash
# キャッシュクリアと再インストール
rm -rf node_modules .svelte-kit
npm install
npm run sync
```

### 型エラーが発生する場合

```bash
# 型チェックを実行して詳細を確認
npm run check
```

### テストが失敗する場合

```bash
# テストを詳細モードで実行
npm run test:ui
```

## 注意事項

- Svelte 5の新しいrunes構文（`$state`、`$props`など）を使用しています
- `export let`や`<slot />`などのSvelte 4構文は使用できません
- コンポーネントは`.svelte`拡張子、ストアは`.svelte.ts`拡張子を使用
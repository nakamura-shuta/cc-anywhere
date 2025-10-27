# ファイルナビゲーション機能

## 概要

タスク詳細ページのリポジトリエクスプローラーで、URLパラメータを使用して特定のファイルを直接開くことができる機能です。

## 使い方

### 基本的な使用方法

タスク詳細ページのURLに `?file=` パラメータを追加することで、特定のファイルを直接開くことができます。

```
/tasks/[taskId]?file=path/to/file.ts
```

### 例

```
/tasks/123?file=src/index.ts
/tasks/456?file=frontend/src/lib/components/RepositoryExplorer.svelte
```

## 機能詳細

### 1. URL パラメータによる初期ファイル選択

- URLに `?file=パス` を含めることで、ページ読み込み時に自動的にそのファイルを開きます
- ファイルパスはリポジトリのルートからの相対パスです
- 指定されたファイルが存在しない場合は、エラーメッセージが表示されます

### 2. URL同期

- ファイルツリーでファイルを選択すると、URLが自動的に更新されます
- `history.replaceState()` を使用しているため、ブラウザの履歴を汚染しません
- URLをコピーして共有することで、特定のファイルを開いた状態を共有できます

### 3. ブラウザ履歴サポート

- ブラウザの「戻る」「進む」ボタンが正しく機能します
- `popstate` イベントを監視して、URLパラメータの変更を検知します
- ファイル選択状態が履歴と同期されます

### 4. エラーハンドリング

- ファイルが見つからない場合、削除されたファイルとして表示されます
- その他のエラーについても適切なエラーメッセージが表示されます

## 実装詳細

### 関連ファイル

- `frontend/src/lib/components/repository-explorer/types.ts`
  - `initialFile` prop を追加
  - `syncWithUrl` prop を追加

- `frontend/src/lib/components/repository-explorer/RepositoryExplorer.svelte`
  - 初期ファイル自動選択ロジック
  - URL同期ロジック
  - ブラウザ履歴サポート

- `frontend/src/routes/tasks/[id]/+page.svelte`
  - URLパラメータの読み取り
  - RepositoryExplorerへのprops渡し

### Props

#### RepositoryExplorerProps

```typescript
interface RepositoryExplorerProps {
  // ... 既存のprops

  // URLパラメータで初期表示するファイル
  initialFile?: string;

  // URL同期を有効にするか（ファイル選択時にURLを更新）
  syncWithUrl?: boolean;
}
```

### 実装のポイント

1. **$effect() の使用**: Svelte 5のrunes APIを使用して、リアクティブな副作用を実装
2. **replaceState vs pushState**: 履歴を汚染しないために `replaceState` を使用
3. **popstate イベント**: ブラウザの戻る/進むボタンに対応するためのイベントリスナー
4. **cleanup**: コンポーネントのアンマウント時にイベントリスナーを適切に削除

## 今後の拡張予定

### Phase 4: エージェント回答のファイルリンク化

Claude CodeやCodexからの回答で、ファイルパスを含むテキストを自動的にクリック可能なリンクに変換する機能を追加予定。

例:
```
`src/index.ts:42` → クリック可能なリンク → `/tasks/[id]?file=src/index.ts`
```

実装内容:
- マークダウンレンダラーの拡張
- ファイルパス検出の正規表現パターン
- バックエンドのプロンプト指示の追加

## トラブルシューティング

### ファイルが開かれない

1. ファイルパスが正しいか確認してください（リポジトリルートからの相対パス）
2. ファイルが実際に存在するか確認してください
3. ブラウザのコンソールでエラーメッセージを確認してください

### URLが更新されない

1. `syncWithUrl={true}` が RepositoryExplorer に渡されているか確認してください
2. ブラウザのJavaScriptが有効になっているか確認してください

### ブラウザの戻るボタンが機能しない

1. `popstate` イベントリスナーが正しく登録されているか確認してください
2. ブラウザのコンソールでエラーがないか確認してください

## 関連ドキュメント

- [リポジトリエクスプローラー](./repository-explorer.md)
- [タスク管理](./tasks.md)
- [SoW: ファイルナビゲーション実装計画](../../.work/file-navigation-sow.md)

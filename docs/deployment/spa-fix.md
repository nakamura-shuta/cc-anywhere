# SPA (Single Page Application) 修正ガイド

## 問題の詳細

本番環境で`/tasks`などのルートに直接アクセスすると500エラーが発生する問題は、SvelteKitのSSR（サーバーサイドレンダリング）とSPA（シングルページアプリケーション）の設定の不整合によるものです。

## 修正内容

### 1. グローバルなSSR無効化

`frontend/src/routes/+layout.js`を作成して、アプリケーション全体でSSRを無効化:

```javascript
// SSRを無効にしてSPAモードで動作させる
export const ssr = false;

// プリレンダリングも無効化（SPAなので不要）
export const prerender = false;

// クライアントサイドルーティングを有効化
export const csr = true;
```

### 2. ビルド後の動作

この設定により:
- すべてのルーティングがクライアントサイドで処理される
- サーバーは常に`index.html`を返す
- JavaScriptがロードされた後、適切なページが表示される

### 3. 再ビルドが必要

変更を適用するには再ビルドが必要です:

```bash
# 統合ビルドを実行
./scripts/build-all.sh

# 本番環境を再起動
./scripts/stop-all.sh
./scripts/start-production.sh
```

## 確認方法

1. ブラウザで`http://localhost:5000`にアクセス
2. タスク一覧（`/tasks`）に移動
3. ページをリロードしても正常に表示されることを確認

## 技術的な背景

### SSRとSPAの違い

- **SSR（サーバーサイドレンダリング）**:
  - サーバーでHTMLを生成
  - 初回表示が速い
  - SEOに有利
  - 各ルートに対応するHTMLが必要

- **SPA（シングルページアプリケーション）**:
  - クライアントサイドでルーティング
  - 初回ロードは遅いが、その後は高速
  - APIベースのアプリケーションに適している
  - すべてのルートで同じ`index.html`を使用

### CC-AnywhereがSPAを選択した理由

1. **API中心のアーキテクチャ**: フロントエンドは単なるUIで、すべてのデータはAPIから取得
2. **動的なコンテンツ**: タスクの状態などリアルタイムで更新される
3. **認証**: クライアントサイドでAPIキーを管理
4. **WebSocket**: リアルタイム通信が必要

## 関連ファイル

- `frontend/src/routes/+layout.js` - グローバル設定
- `frontend/svelte.config.js` - ビルド設定
- `backend/src/server/plugins/static.ts` - 静的ファイル配信設定

## トラブルシューティング

もし問題が続く場合:

1. ブラウザのキャッシュをクリア
2. `frontend/.svelte-kit`ディレクトリを削除
3. 完全な再ビルドを実行

```bash
rm -rf frontend/.svelte-kit frontend/build
rm -rf backend/web backend/dist
./scripts/build-all.sh
```
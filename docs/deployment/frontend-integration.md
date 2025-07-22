# フロントエンド統合デプロイメント

このドキュメントでは、フロントエンドとバックエンドを統合して単一のURLで配信する方法について説明します。

## 概要

CC-Anywhereは、開発時はフロントエンド（SvelteKit）とバックエンド（Fastify）を別々のポートで動作させますが、本番環境ではフロントエンドをビルドしてバックエンドから配信することで、単一のURLでアクセス可能にします。

### メリット

- **単一URL** - ngrok/Cloudflareトンネルが1つで済む
- **CORS不要** - 同一オリジンなので設定が不要
- **シンプル** - QRコード1つでスマートフォンからアクセス可能
- **コスト効率** - 追加のホスティングサービスが不要

## アーキテクチャ

```
開発時:
  Frontend (http://localhost:4444) ←→ Backend API (http://localhost:5000)

本番時:
  統合サーバー (http://localhost:5000)
    ├── / (フロントエンドUI)
    └── /api/* (バックエンドAPI)
```

## セットアップ手順

### 1. 初回セットアップ

```bash
# プロジェクトルートで依存関係をインストール
npm install

# ワークスペースの依存関係もインストール
cd backend && npm install
cd ../frontend && npm install
cd ..
```

### 2. 開発環境での作業

開発時は、フロントエンドとバックエンドを別々に起動してホットリロードを活用します。

```bash
# プロジェクトルートから
npm run dev

# または個別に起動
npm run dev:backend  # http://localhost:5000
npm run dev:frontend # http://localhost:4444
```

### 3. 本番用ビルド

フロントエンドをビルドしてバックエンドに統合します。

```bash
# すべてをビルド（推奨）
npm run build

# または個別にビルド
npm run build:frontend     # フロントエンドのビルド
npm run build:backend      # バックエンドのビルド
npm run deploy:frontend    # フロントエンドをbackend/webへデプロイ
```

`npm run build`コマンドは以下を実行します：
1. フロントエンドをビルド（`frontend/build/`に出力）
2. バックエンドをビルド（`backend/dist/`に出力）
3. フロントエンドのビルド結果を`backend/web/`にコピー

### 4. 統合サーバーの起動

```bash
# クラムシェルモードで起動（推奨）
./backend/scripts/start-clamshell.sh

# または通常起動
cd backend && npm start
```

### 5. アクセス確認

- ローカル: http://localhost:5000
- 外部アクセス: ngrok/CloudflareのURL（QRコードで表示）

## ビルドスクリプトの詳細

### build-frontend.sh

`backend/scripts/build-frontend.sh`は以下の処理を行います：

1. フロントエンドディレクトリの確認
2. 依存関係のインストール（必要な場合）
3. フロントエンドのビルド実行
4. 既存の`backend/web`ディレクトリを削除
5. ビルド結果を`backend/web`にコピー

### package.jsonスクリプト

```json
{
  "scripts": {
    "build": "npm run build:all",
    "build:all": "npm run build:frontend && npm run build:backend && npm run deploy:frontend",
    "build:frontend": "npm run build -w frontend",
    "build:backend": "npm run build -w backend",
    "deploy:frontend": "./backend/scripts/build-frontend.sh"
  }
}
```

## フロントエンドの設定

### svelte.config.js

静的サイト生成用のアダプターを使用：

```javascript
import adapter from "@sveltejs/adapter-static";

const config = {
  kit: {
    adapter: adapter({
      pages: "build",
      assets: "build",
      fallback: "index.html",
      precompress: false,
      strict: true
    })
  }
};
```

### API通信設定

`frontend/src/lib/config/api.ts`で環境に応じたAPIエンドポイントを管理：

- 開発時: `http://localhost:5000`（別ポート）
- 本番時: 相対パス（同一オリジン）

## トラブルシューティング

### ビルドエラー

```bash
# キャッシュをクリアして再ビルド
cd frontend
rm -rf .svelte-kit build node_modules
npm install
npm run build
```

### 404エラー

フロントエンドがSPAとして動作するよう、`+layout.ts`で以下を設定：

```typescript
export const prerender = true;
export const ssr = false;
export const csr = true;
```

### APIアクセスエラー

開発時と本番時でAPIのベースURLが異なることを確認：

```typescript
// frontend/src/lib/config/api.ts
export const API_BASE_URL = dev ? 'http://localhost:5000' : '';
```

## 更新フロー

フロントエンドを更新した場合：

1. 開発環境で変更を確認
2. `npm run build`で統合ビルド
3. バックエンドサーバーを再起動

## 注意事項

- フロントエンドの変更は、ビルド＆デプロイ後に反映されます
- 開発時はホットリロードが有効ですが、本番時は再ビルドが必要です
- `backend/web/`ディレクトリは自動生成されるため、直接編集しないでください
- `.gitignore`に`backend/web/`を追加することを推奨します
# Web UI 開発ドキュメント

このディレクトリには、cc-anywhere の Web UI に関する開発ドキュメントが含まれています。

## ドキュメント一覧

- [UI_PROPOSAL.md](./UI_PROPOSAL.md) - Web UI の初期設計提案
- [SDK_OPTIONS_IMPLEMENTATION_GUIDE.md](./SDK_OPTIONS_IMPLEMENTATION_GUIDE.md) - Claude Code SDK オプション対応の実装ガイド

## 関連ドキュメント

- [リポジトリ要件提案](../../features/REPOSITORY_REQUIREMENT_PROPOSAL.md)
- [リポジトリ要件実装](../../features/REPOSITORY_REQUIREMENT_IMPLEMENTATION.md)
- [プリセット管理機能](../../features/preset-management.md)

## Web UI ファイル構成

```
web/
├── index.html              # 基本的な Web UI
├── index-sdk-options.html  # SDK オプション対応版
├── style.css              # 基本スタイル
├── style-sdk-options.css  # SDK オプション用追加スタイル
├── api.js                 # API クライアント
├── app.js                 # 基本的なアプリケーションロジック
└── app-sdk-options.js     # SDK オプション対応版のロジック
```

## 開発ガイドライン

### スタイリング
- CSS 変数を使用してテーマ管理
- レスポンシブデザイン対応
- アクセシビリティを考慮

### JavaScript
- ES6+ の機能を活用
- async/await パターンの使用
- エラーハンドリングの徹底

### API 連携
- `api.js` の APIClient クラスを使用
- 認証は X-API-Key ヘッダーで実装
- WebSocket によるリアルタイム更新対応
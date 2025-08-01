# はじめに

CC-Anywhereのインストールから基本的な使い方までを説明します。

## 📋 前提条件

- Node.js 18以上
- npm または yarn
- Claude API Key（[取得方法](https://console.anthropic.com/)）

## 🚀 クイックスタート

### 1. インストール

```bash
# リポジトリのクローン
git clone https://github.com/your-org/cc-anywhere.git
cd cc-anywhere

# 依存関係のインストール
npm install
```

### 2. 環境設定

```bash
# 設定ファイルをコピー
cp .env.example .env
```

`.env`ファイルを編集して必須項目を設定:

```env
# Claude API（必須）
CLAUDE_API_KEY=sk-ant-api03-...

# QR認証（外部アクセス用）
QR_AUTH_TOKEN=hello
QR_AUTH_ENABLED=true
```

その他の設定は[設定ガイド](./configuration.md)を参照。

### 3. 起動

```bash
# 開発環境（ホットリロード有効）
npm run dev

# 本番環境（PM2使用）
./scripts/start-production.sh

# クラムシェルモード（外部アクセス可能）
./scripts/start-clamshell.sh
```

### 4. 動作確認

#### Web UI
ブラウザで http://localhost:5000 にアクセス

#### API経由
```bash
# タスクの作成
curl -X POST http://localhost:5000/api/tasks \
  -H "Content-Type: application/json" \
  -H "X-Auth-Token: hello" \
  -d '{
    "instruction": "Hello Worldと出力してください",
    "context": {
      "workingDirectory": "."
    }
  }'
```

## 📱 外部アクセス

ngrokまたはCloudflare Tunnelで外部からアクセス可能にする:

```bash
# ngrok（簡単）
./scripts/start-clamshell.sh
# 1. ngrokを選択
# 2. QRコードが表示される

# Cloudflare Tunnel（高度）
# .envに設定を追加
TUNNEL_TYPE=cloudflare
CLOUDFLARE_TUNNEL_TOKEN=your-token
```

## 🔧 開発環境

### 統合ビルド
```bash
./scripts/build-all.sh
```

### 個別起動
```bash
# バックエンド
cd backend && npm run dev

# フロントエンド（別ターミナル）
cd frontend && npm run dev
```

## 👨‍💻 開発者向け

### 開発環境セットアップ

```bash
# フォーク＆クローン
git clone https://github.com/YOUR_USERNAME/cc-anywhere.git
cd cc-anywhere

# アップストリームを追加
git remote add upstream https://github.com/original-org/cc-anywhere.git

# 開発用依存関係も含めてインストール
npm install

# Git hooksのセットアップ（推奨）
npm run prepare
```

### 開発ワークフロー

```bash
# 機能ブランチを作成
git checkout -b feature/your-feature-name

# 開発サーバー起動（TypeScript watch mode + nodemon）
npm run dev

# テスト実行
npm run test:unit    # ユニットテスト
npm run test:watch   # ウォッチモード

# コード品質チェック
npm run lint         # Lintチェック
npm run lint:fix     # 自動修正
npm run type-check   # 型チェック
```

### VSCode推奨設定

推奨拡張機能:
- dbaeumer.vscode-eslint
- esbenp.prettier-vscode
- ms-vscode.vscode-typescript-next
- orta.vscode-jest

### デバッグ

```typescript
import { logger } from './utils/logger';

logger.debug('Detailed debug info', { 
  taskId, 
  context: task.context 
});
```

```bash
# SQLiteデータベースを直接確認
sqlite3 data/cc-anywhere.db
```

### コーディング規約

- TypeScript strictモードを維持
- ファイル名: kebab-case
- クラス名: PascalCase
- 関数名: camelCase
- 定数: UPPER_SNAKE_CASE

### コミットメッセージ

```
feat: 新機能の追加
fix: バグ修正
docs: ドキュメントのみの変更
style: コードの意味に影響しない変更
refactor: バグ修正や機能追加を伴わないコード変更
test: テストの追加・修正
chore: ビルドプロセスやツールの変更
```

## 📖 次のステップ

- [詳細な設定](./configuration.md) - 環境変数とオプション
- [APIリファレンス](../api/) - エンドポイント仕様
- [機能ガイド](../features/) - 各機能の使い方
- [デプロイメント](../deployment/) - 本番環境へのデプロイ
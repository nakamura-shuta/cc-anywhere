# cc-anywhere APIテスト

## 概要

cc-anywhereのバックエンドAPIをテストし、Claude Code SDKが実際に指示通りに動作することを検証するテスト環境です。

## 必要要件

- Node.js 18以上
- cc-anywhereサーバーが起動していること（ポート5000）
- ~/dev/node/test ディレクトリへの書き込み権限

## テスト実行前の準備

### 1. APIサーバーを起動

別のターミナルで以下を実行:

```bash
# cc-anywhereプロジェクトのルートディレクトリで
npm run dev
```

サーバーが正常に起動していることを確認:

```bash
curl -X POST http://localhost:5000/api/tasks \
  -H "Content-Type: application/json" \
  -H "X-API-Key: hello" \
  -d '{"instruction": "test"}'
```

## セットアップ

```bash
cd system-tests
npm install
```

## 環境設定

`.env.example`をコピーして`.env`を作成:

```bash
cp .env.example .env
```

デフォルト設定:
- `API_BASE_URL`: http://localhost:5000
- `API_KEY`: hello

## テスト実行

```bash
# 全テスト実行
npm test

# 基本的なAPIテスト
npm run test:api

# タスク実行結果の検証テスト
npm run test:verify

# タスクグループの検証テスト  
npm run test:group

# デバッグモード
npm run test:debug

# テストレポート表示
npm run report
```

## テストファイル構成

```
api-tests/
├── task-api.test.ts                    # 基本的なAPIテスト
├── task-execution-verification.test.ts # 実行結果検証テスト
└── task-group-verification.test.ts     # グループ実行検証テスト
```

## テスト内容

### 1. 基本的なAPIテスト (`task-api.test.ts`)
- タスクの作成と実行
- タスクグループの実行
- エラーハンドリング
- API認証

### 2. 実行検証テスト (`task-execution-verification.test.ts`)
- ファイル作成タスクの検証
- JavaScriptファイル作成の検証
- 既存ファイルの修正タスクの検証
- エラーハンドリングの検証

### 3. グループ検証テスト (`task-group-verification.test.ts`)
- 順次実行タスクグループ（プロジェクト初期化）
- 並列実行タスクグループ（複数ファイル作成）
- 依存関係のあるタスク実行

## 作業ディレクトリ

すべてのテストは `~/dev/node/test` ディレクトリで実行されます。
各テスト実行前に必要なファイルは自動的にクリーンアップされます。

## 注意事項

- APIサーバー（ポート5000）が起動している必要があります
- テスト実行時は`~/dev/node/test`ディレクトリの内容が変更される可能性があります
- 長時間実行されるテストがあるため、タイムアウトは60秒に設定されています

## トラブルシューティング

### テストがタイムアウトする場合
- APIサーバーが正しく起動しているか確認
- Claude API Keyが正しく設定されているか確認
- ネットワーク接続を確認

### 認証エラーが発生する場合
- API_KEY環境変数が正しく設定されているか確認
- APIサーバーの設定を確認
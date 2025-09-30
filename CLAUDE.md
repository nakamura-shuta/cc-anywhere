# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

このプロジェクトは、Claude Code SDKを使用してHTTP経由で指示を実行できるサーバーアプリケーションです。
外部からHTTPリクエストを受け取り、Claude Code SDKを通じて様々なタスクを実行し、結果を返すAPIサーバーとして機能します。

### 主な機能
- HTTPサーバーとしてリクエストを受信
- Claude Code SDKを使用してタスクを実行
- RESTful APIエンドポイントの提供
- 非同期タスク実行のサポート

## アーキテクチャ

### 技術スタック
- **言語**: TypeScript/Node.js
- **フレームワーク**: Fastify (高性能HTTPサーバー)
- **Claude SDK**:
  - @anthropic-ai/claude-agent-sdk (Claude Agent SDK)
  - @anthropic-ai/sdk (通常のClaude API)
- **テスト**: Vitest (ESMネイティブ対応)
- **ログ**: Winston + pino-pretty
- **認証**: API Key認証


## 共通コマンド

### 起動スクリプト
プロジェクトの起動には用途に応じたスクリプトを使用してください。
詳細は [`docs/scripts-overview.md`](docs/scripts-overview.md) を参照してください。

**主要スクリプト**:
- `./scripts/start-dev.sh` - 開発環境（ホットリロード有効）
- `./scripts/start-clamshell.sh` - モバイルアクセス用（ngrok/Cloudflare Tunnel）
- `./scripts/start-production.sh` - 本番環境（PM2管理）
- `./scripts/build-all.sh` - フロントエンド・バックエンド統合ビルド
- `./scripts/stop-all.sh` - すべてのプロセス停止

### テスト・品質管理
- `npm run test:unit` - ユニットテストを一度実行
- `npm run test:integration` - 統合テストを一度実行
- `npm run test:watch` - テストをwatchモードで実行（必要な場合のみ）
- `npm run lint` - ESLintによるコード品質チェック
- `npm run lint:fix` - Lintエラーの自動修正
- `npm run type-check` - TypeScript型チェック

**注意**:
- `npm test`は誤ってwatchモードでテストが実行されることを防ぐため、エラーメッセージを表示します。常に`npm run test:unit`や`npm run test:integration`を使用してください。
- テスト実行後は必ずプロセスが正常に終了したことを確認してください。異常終了した場合、vitestプロセスが残ることがあります。
- もしvitestプロセスが残った場合は `pkill -f vitest` で停止してください。

### その他のツール
- `rg` (ripgrep), `grep` - ファイル内容検索
- Github操作には`gh`使用を推奨


## コードスタイル

- 可能な限り分割代入を活用
- 関数名は snake_case、クラス名は PascalCase で統一

## ワークフロー

### 作業の進め方

1.Explore
まずはコードベースや関連ファイルなどを
理解するフェーズ。

ex.
```
> find the files that handle user authentication
```

2.Plan
実装の計画や設計について深く考るフェーズ。
ここでは#ultrathink を使用。

ex.
```
> how to implement Role Based User Authentication #ultrathink 
```

ここで設計や計画を行い、.work/${sessionId}/task.mdを作成して(内部的、リポジトリ共有しない)設計方針や実装方針、計画などを記述する。
また、./docs以下には(リポジトリに共有される)ドキュメントを作成・更新する。

3.Code
計画に基づき、具体的なコード実装するフェーズ。
後述するTDD方式で実装していく。

ex.
```
> implement its solution
```

./.work/${sessionId}/task.mdに進捗状況を記述していく。

4.Document

./docs以下にドキュメントを作成・更新する。

5.Commit
実装された変更内容をコミットするフェーズ。

ex.
```
> commit this
```

6.cleanup

./.work/sandboxなどに作成した使用済みファイルなどをcleanupする。

### TDDで進める

1.テストを実装
まずは、実装したい機能のテストコードを実装する。
このテストは、最初は失敗するように（機能が未実装なので）実装。
実際にテストが失敗することを確認する。

2.テストをパスするように実装する
次に、テストコードを修正せずに、
そのテストがパスするように実装コードを書く。
テストを再度実行してパスすればOK.

### その他注意事項

- 変更完了後は必ず型チェックを実行
- 全テストではなく単体テストを優先して実行

## 権限設定

`.claude/settings.local.json`ファイルで以下のBashコマンドが許可されています：


## API設計

### エンドポイント

APIの情報は、./backend/openapi.yamlを参照してください。
新しいエンドポイントを追加した場合、このドキュメントも更新してください。

### 認証
- APIキーベースの認証（ヘッダー: `X-API-Key`）

## Playwright MCP使用ルール

### 絶対的な禁止事項

1. **いかなる形式のコード実行も禁止**

   - Python、JavaScript、Bash等でのブラウザ操作
   - MCPツールを調査するためのコード実行
   - subprocessやコマンド実行によるアプローチ

2. **利用可能なのはMCPツールの直接呼び出しのみ**

   - playwright:browser_navigate
   - playwright:browser_screenshot
   - 他のPlaywright MCPツール

3. **エラー時は即座に報告**
   - 回避策を探さない
   - 代替手段を実行しない
   - エラーメッセージをそのまま伝える

## 環境変数の管理

- **統一された.env管理**: プロジェクトルートの`.env`ファイルで全ての環境変数を管理
- backend/.envは使用しない（削除済み）
- backendは`config/index.ts`でルートの.envを読み込むよう設定済み
- .envファイルは絶対にコミットしない（.gitignoreに含まれている）
- 新しい環境変数を追加する場合は`.env.example`も更新すること

## その他注意事項

- 特に指定がない限り、回答は日本語で簡潔に行ってください
- テストのwatchモードなど、プロセスが残りそうなものはなるべく実行しない。実行したいときはユーザーへ注意喚起する

### [重要事項]Fastifyレスポンススキーマの注意事項

**重要**: Fastifyはレスポンススキーマに定義されていないプロパティを自動的に削除します。新しいフィールドをAPIレスポンスに追加する際は、必ず以下の手順を実行してください：

1. ルートハンドラーでレスポンスにフィールドを追加
2. **レスポンススキーマにも同じフィールドを追加する**（routes/*.tsファイル内のschema.response定義）
3. テストを実行して、フィールドが正しく返されることを確認

よくある問題：
- レスポンスオブジェクトにフィールドを追加したが、クライアントに返されない
- テストで「expected to have property」エラーが発生する
- デバッグすると値は存在するが、最終的なレスポンスには含まれていない

これらの症状が出た場合は、レスポンススキーマの定義を確認してください。

## 参考にするドキュメント

設計・実装時には、以下のドキュメントやコード例を参考にしてください。

* Claude Code(github) : https://github.com/anthropics/claude-code


* Claude Code SDKの CAHNGELOG : https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md

* Claude Code SDKを使用した例(github)：
https://github.com/anthropics/claude-code-action

* Claude Code公式ドキュメント : https://docs.anthropic.com/ja/docs/claude-code/sdk

* Agent SDK リファレンス：https://docs.claude.com/en/api/agent-sdk/typescript

- vitestでテストを実行する場合、かならず--runオプションを付与する
- 簡単な検証プログラムやスクリプトは.work/sandboxにコードを記述してください。環境変数は.work/sandbox/.envを使用してください。
- APIエンドポイントを追加したときは@backend/openapi.yamlも更新すること
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **OpenAPI/Swagger統合**: APIドキュメントの自動生成と対話的テスト機能
  - OpenAPI 3.1.0仕様に基づいたAPIドキュメント（`/backend/openapi.yaml`）
  - Swagger UIによる対話的APIドキュメント（`http://localhost:5000/api/docs`）
  - 全APIエンドポイントのスキーマ定義
  - APIキー認証の永続化機能
  - Try it out機能による直接的なAPIテスト

### Changed
- **Claude Code SDK更新**: v1.0.64 から v1.0.69 にアップデート

### Documentation
- **README.md更新**: 認証機能に関する説明を現在の実装に合わせて修正
  - QR認証機能の説明を削除（実際には存在しない）
  - API認証の説明を詳細化
  - 認証とセキュリティセクションを追加
- **.env.example更新**: 環境変数の説明を正確に記載
  - API_KEY認証の動作を正しく説明
  - QR_AUTH_ENABLEDがQRコード表示機能であることを明記

### Removed
- **未使用の環境変数を削除**:
  - LOG_FORMAT - 実際にはコード内で使用されていない
  - CLAUDE_CODE_WORKSPACE_DIR - 実際にはコード内で使用されていない
  - CLAUDE_CODE_TIMEOUT - 実際にはコード内で使用されていない
  - CLAUDE_CODE_MAX_TURNS - DEFAULT_MAX_TURNSに統合
  - USE_CLAUDE_CODE_SDK - 常にClaude Code SDKを使用するため不要

### Fixed
- タスク完了後に「まだ処理中です...」が表示される問題を修正
- TODOリストのステータスが正しく表示されない問題を修正
- ターン数表示が「5/3」のように最大値を超える問題を修正
- タスク詳細を開き直した際に進捗情報が失われる問題を修正
- **Worktree隔離性の修正**: Claude Code SDKのタスク実行時にworktreeディレクトリが作業ディレクトリとして正しく設定されるよう修正
  - `path`モジュールのインポート漏れを修正
  - ファイル操作がメインリポジトリに影響を与えないことを確認
- **フロントエンドlintエラー修正**: 未使用変数のlintエラーを修正（deleted-files.svelte.ts）

### Changed
- 完全に@anthropic-ai/claude-code SDKに移行し、@anthropic-ai/sdkを削除
- Claude Code SDK を v1.0.51 に更新
- 権限モードの実装を改善（ask → default, allow → bypassPermissions, deny → plan）
- Web UIを SDK の権限モードに合わせて更新
- テストのパフォーマンス最適化（beforeAll/afterAllの使用により実行時間を60秒から11秒に短縮）
- デフォルトのmaxTurnsを3から50に変更
- 進捗データ（progressData）をデータベースに永続化
- **テスト環境の改善**: 統合テストでのAPI認証設定を修正
  - `.env.test`にAPI_KEY設定を追加
  - sdk-continue.test.tsのAPIキー取得方法を環境変数ベースに変更

### Added
- Claude Code SDK 1.0.51の新機能をTODO.mdに追加
  - Webサーチ機能の統合
  - @メンション機能
  - Todoリスト機能の活用
  - /doctor診断機能
  - 並列Web検索
  - MCPサーバー実行
  - プログレスメッセージ改善
- **タスク継続API**: `POST /api/tasks/:taskId/continue` エンドポイントを追加
  - 完了したタスクから会話を継続する新しいタスクを作成
  - 親タスクの会話履歴と実行結果を引き継ぎ
- **会話履歴保存機能**: タスク完了時にClaude Code SDKの会話履歴を自動保存
  - データベースに`conversation_history`カラムを追加
  - 成功・失敗両方のタスクで会話履歴を保存
- **会話フォーマッター**: SDKメッセージを人間が読める形式に変換するユーティリティ
  - システムプロンプト用のフォーマット機能
  - ツール使用情報の抽出
- **進捗データ永続化**: タスク実行中の進捗情報をデータベースに保存
  - TODOリスト、ターン数、ツール使用統計を保存
  - タスク詳細再表示時に進捗情報を復元

### Removed
- @anthropic-ai/sdk依存関係を削除
- ClaudeClientクラスと関連コードを削除
- USE_CLAUDE_CODE_SDK環境変数を削除（常にClaude Code SDKを使用）
- 不要なテストモックを削除

### Fixed
- ビルドエラーを修正（未使用のメソッドを削除）
- テストファイルのインポートエラーを修正
- 単体テストのAPIキー認証エラーを修正（環境変数を使用）
- WebSocketメッセージにmaxTurns情報が含まれない問題を修正

## [0.3.0] - 2025-01-14

### Added
- タスク実行ログ・結果表示の改善
  - ツール使用情報の詳細表示（Read/Write/Edit/Bash等）をリアルタイムで実装
  - タスク実行サマリーの生成（使用ツール統計、ファイル操作一覧、実行時間等）
  - WebSocket経由で構造化されたログ情報（tool_usage, progress, summary）を送信
  - 各ツールにアイコンを設定（📖読取、✏️作成、📝編集、💻コマンド等）
  - エラー時の詳細情報表示の改善
  - Markdown形式の結果を適切にレンダリング
  - ネストされたJSONレスポンス（task.result.result）に対応

### Changed
- フロントエンドのリファクタリング
  - JavaScript共通関数をutils.jsに集約
  - CSS共通スタイルをcommon.cssに集約
  - コードの重複を大幅に削減
  - メンテナンス性の向上
- スケジューラー画面のUI改善
  - タスク実行画面とスケジューラー画面のスタイルを完全に統一
  - ナビゲーションリンクにクエリパラメータを引き継ぐ機能を追加
  - 接続状態チェックのエンドポイントを修正
  - 不要なファイルを削除（index-simple.html, app-simple.js）

## [0.2.0] - 2025-01-13

### Added
- スケジューラー機能
  - Cron式による定期実行（5フィールド形式）
  - ワンタイム実行（指定日時での1回限り実行）
  - タイムゾーン対応（Cronスケジュール）
  - 実行履歴の記録と管理
  - スケジュールの有効化/無効化
  - REST APIによる完全な管理機能
  - Web UIからのスケジュール管理
- 権限モード実装の改善
  - Claude Code SDKの権限モードを正しく実装
  - Web UIも SDK に合わせて更新（default, acceptEdits, bypassPermissions, plan）
  - cc-anywhere経由でもファイル作成が可能に
- タスク一覧のページネーション
  - APIレベルでのページング対応
  - Web UIでのページナビゲーション
  - 表示件数選択機能（10, 20, 50, 100件）
  - 大量タスク時のパフォーマンス改善

## [0.1.0] - 2025-01-12

### Added
- 初期リリース
- Claude Code SDK統合
- HTTP API エンドポイント
- Web UI（レスポンシブデザイン）
- Git Worktree統合
- スラッシュコマンドサポート
- WebSocketによるリアルタイムログ
- タスクキュー管理
- バッチ実行機能
- 自動リトライ機能
- プリセット管理機能
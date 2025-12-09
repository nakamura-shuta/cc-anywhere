# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Compare Mode（LLM比較モード）** (2025-12-09)
  - 複数のLLM（Claude, Codex, Gemini）に同一タスクを同時実行させ、結果を比較する機能
  - **バックエンド機能:**
    - `POST /api/compare` - 比較タスク作成
    - `GET /api/compare` - 比較タスク一覧取得
    - `GET /api/compare/:id` - 比較タスク詳細取得
    - `GET /api/compare/:id/files` - 変更ファイル一覧取得
    - `DELETE /api/compare/:id` - 比較タスクキャンセル
    - 並列worktree作成によるLLM間の隔離実行
    - `bypassPermissions`モードによる自動実行（許可確認なし）
    - タスク完了時のステータス自動更新（EventBus連携）
    - worktree自動クリーンアップ（24時間後または手動削除時）
  - **フロントエンド機能:**
    - `/compare` - 比較タスク一覧画面
    - `/compare/:id` - 3カラム比較結果表示画面
    - リアルタイム進捗表示（WebSocket）
    - リポジトリ選択・タスク指示入力フォーム
  - **実装ファイル:**
    - `backend/src/services/compare/` - CompareService, CleanupJob, types
    - `backend/src/repositories/compare-task-repository.ts` - データベースリポジトリ
    - `backend/src/server/routes/compare.ts` - APIルート
    - `frontend/src/routes/compare/` - 比較画面UI
    - `frontend/src/lib/stores/compare.svelte.ts` - 状態管理
    - `frontend/src/lib/services/compare.service.ts` - APIクライアント

- **Gemini Executor** (2025-12-05)
  - Google Gemini API（Gemini 2.5 Pro/Flash）を使用した新しいExecutor
  - Function Callingによるファイル操作対応
    - `readFile`: ファイル読み取り
    - `createFile`: ファイル作成
    - `updateFile`: ファイル更新
    - `deleteFile`: ファイル削除
    - `listDirectory`: ディレクトリ一覧
  - 相対パス/絶対パスの柔軟な処理
  - リアルタイムストリーミング応答
  - フロントエンドUIでGemini選択可能
  - File Operations ON/OFF切り替え対応
  - 実装ファイル:
    - `backend/src/agents/gemini-agent-executor.ts` - メインExecutor
    - `backend/src/agents/gemini-file-tools.ts` - ファイル操作ツール
    - `backend/src/agents/gemini-task-executor-adapter.ts` - タスクアダプター

### Changed

- **pnpm移行** (2025-12-05)
  - パッケージマネージャをnpmからpnpmに移行
  - すべてのスクリプト（`./scripts`）をpnpm対応に更新
  - `backend/.npmrc` 追加（node-linker=hoisted設定）
  - ドキュメント更新（README, CLAUDE.md, docs）
  - TypeScript 5.5.3にバージョン固定（ビルド性能最適化）

- **Codex SDK 0.58.0アップデート & GPT-5.1-Codexモデル対応** (2025-11-13)
  - Codex SDK v0.58.0へアップグレード（v0.57.0から）
  - GPT-5.1-Codexモデルのサポート追加
    - 長時間実行されるAgenticコーディングタスクに最適化されたGPT-5.1ベースのモデル
    - タスク作成画面のモデル入力プレースホルダーを`gpt-5.1-codex`に更新
    - デフォルトモデルとしてgpt-5.1-codexを推奨
  - SDK 0.58.0の主な変更:
    - GPT-5.1モデルファミリーのサポート
    - アプリサーバーの機能強化（JSONスキーマジェネレータ、イベント処理改善）
    - UIショートカットのインライン表示
    - 各種バグ修正（Wayland、brew、クラウドタスク対応）

- **Codex SDK Web Search機能** (2025-11-13)
  - Codex SDK v0.57.0へアップグレード（v0.52.0から）
  - Web検索機能をデフォルトで有効化（`webSearchEnabled: true`）
  - ネットワークアクセスはセキュリティのためデフォルトで無効（`networkAccessEnabled: false`）
  - タスク依頼画面でWeb検索とネットワークアクセスを個別に制御可能
  - 実装ファイル:
    - `backend/src/agents/codex-agent-executor.ts` - デフォルト値設定とdebugログ追加
    - `.work/sandbox/codex-test/test-web-search.ts` - 検証プログラム
  - Codex CLI継続方法の表示追加:
    - タスク詳細画面でCodex実行時に`codex exec resume {threadId}`を表示
    - Claude実行時は従来通り`claude --resume {sessionId}`を表示
    - 継続オプションセクションでも適切なCLIコマンドを表示

### Changed

- **Agent Executorアーキテクチャのリファクタリング** (2025-11-12)
  - **BaseTaskExecutor導入**: ClaudeとCodex Executorの共通ロジックを統合
    - タスク追跡、キャンセル、ヘルパーメソッドを基底クラスに集約
    - `backend/src/agents/base-task-executor.ts` - 抽象基底クラス
    - `backend/src/agents/base-executor-helper.ts` - ヘルパーユーティリティ
    - `ClaudeAgentExecutor`と`CodexAgentExecutor`が`BaseTaskExecutor`を継承
  - **ProgressEventConverter統合**: イベント変換ロジックを一元化
    - `services/progress-formatter.ts` → `progress-event-converter.ts` にリネーム
    - ClaudeとCodex両SDKのイベント変換を統一的に処理
    - `convertProgressToEvent()`: Claude SDK Progress Event変換
    - `convertCodexEvent()`: Codex SDKイベント変換
    - 命名衝突を解消（`src/utils/progress-formatter.ts`と区別）
  - **テストカバレッジ強化**:
    - `tests/unit/services/progress-event-converter.test.ts` - 14テストケース追加
    - 全671単体テスト、42統合テストが成功
  - **ドキュメント更新**:
    - `docs/architecture/agent-execution-events.md` - アーキテクチャ図とファイル一覧を更新
  - **コード品質改善**:
    - ESLint自動修正適用
    - 型安全性向上（`import type`の適切な使用）
    - `-121行、+102行` のコード削減（重複排除による効率化）

### Added

- **セキュリティ脆弱性の修正** (2025-11-04) 🔒
  - HIGH: パストラバーサル脆弱性を修正（CVSS 8.6）
  - MEDIUM: 機密データ露出脆弱性を修正（CVSS 6.5）
  - 実装内容:
    - **PathValidator** (`backend/src/utils/path-validator.ts`): 作業ディレクトリの安全性検証
      - ホワイトリスト検証（path.relative()による安全な判定）
      - システムディレクトリブロック（/etc, /root, /sys等）
      - パス正規化とシンボリックリンク解決
      - パストラバーサル攻撃の防止
    - **SensitiveFileDetector** (`backend/src/utils/sensitive-file-detector.ts`): 機密ファイル検出
      - 機密ファイルパターン検出（.env*, *.key, *.pem, credentials*, secrets*等）
      - ログ出力時のパスマスキング（[REDACTED]）
      - カスタムパターン追加機能
    - **セキュリティ設定** (`backend/src/config/index.ts`):
      - ALLOWED_WORKING_DIRECTORIES: 許可ディレクトリのホワイトリスト（デフォルト: プロジェクトルート）
      - STRICT_PATH_VALIDATION: システムディレクトリブロックを有効化（デフォルト: true）
      - REQUIRE_WHITELIST: ホワイトリストチェックを必須化（デフォルト: true）
    - **TaskQueue統合** (`backend/src/queue/task-queue.ts`): パス検証の適用
    - **FileWatcherService統合** (`backend/src/services/file-watcher.service.ts`): 機密ファイル保護
  - テスト:
    - PathValidatorユニットテスト（類似プレフィックス攻撃、システムディレクトリ、シンボリックリンク等）
    - SensitiveFileDetectorユニットテスト（各種機密ファイルパターン）
  - ドキュメント: `.work/security-vulnerabilities-fix-sow.md`

- **セキュリティ脆弱性修正SoW作成** (2025-11-04)
  - パストラバーサル脆弱性（HIGH）と機密データ露出（MEDIUM）の対策計画を策定
  - 作成ファイル: `.work/security-vulnerabilities-fix-sow.md`
  - 主な対策:
    - PathValidator: パス検証ユーティリティ（ホワイトリスト、正規化、シンボリックリンク解決）
    - SensitiveFileDetector: 機密ファイル検出（.env, *.key, *.pem等）
    - デフォルトでプロジェクトルートのみを許可（セキュアなデフォルト）
    - path.relative()を使った安全な判定ロジック
  - 見積り: 6.5日（Phase 1: 3日、Phase 2: 2.5日、Phase 3: 1日）
  - 修正履歴:
    - デフォルト設定の脆弱性を修正（空配列 → プロジェクトルート）
    - ホワイトリスト判定ロジックの脆弱性を修正（startsWith → path.relative）
    - 無効なパストラバーサル検出を削除（includes("..")は無意味）
    - システムディレクトリブロックの誤判定を修正（類似パス許可）

- **Codex SDK v0.52.0 Token Usage表示機能** (2025-10-31)
  - Codex executorでのトークン使用量（Input/Output/Cached tokens）をタスク詳細画面に表示
  - プロンプトキャッシュによる節約率をパーセンテージで可視化
  - cached_input_tokensフィールドをprogressData.statistics.tokenUsageとして保存
  - Claude executorには影響なし（Codex executor専用機能）
  - 実装ファイル:
    - `frontend/src/lib/components/TokenUsageCard.svelte` - トークン使用量表示コンポーネント
    - `backend/src/queue/task-queue.ts` - tokenUsage保存処理追加
    - `backend/src/claude/types.ts`, `frontend/src/lib/types/api.ts` - tokenUsage型定義追加
  - UIデザイン:
    - キャッシュトークン > 0の場合：琥珀色背景でハイライト表示 + 節約率
    - Total (billed): 実際に課金されるトークン数を表示（Total - Cached）

- **ファイルパスリンク機能** (2025-10-27)
  - AI応答内のファイルパスを自動的にクリック可能なリンクに変換
  - ファイルパスリンクをクリックすると該当ファイルがファイルエクスプローラーに表示される
  - Claude Code、Codex両方の応答でファイルパスリンクに対応
  - バッククォートで囲まれたファイル名（例: `sample.txt`）もリンク化
  - 複数のファイルパスフォーマットに対応:
    - Markdownリンク: `[text](path/to/file.ext)`
    - インラインコード: `` `path/to/file.ext` `` または `` `file.ext` ``
    - プレーンパス: `path/to/file.ext` または `/absolute/path/to/file.ext`
    - 行番号付き: `path/to/file.ext:42`
  - ファイルエクスプローラーの自動展開機能（ファイルパスの親ディレクトリまで）
  - ブラウザ履歴との統合（戻る・進むボタンでファイル間を移動可能）
  - 実装ファイル:
    - `frontend/src/lib/components/FilePathText.svelte` - ファイルパスリンク変換コンポーネント
    - `frontend/src/lib/utils/file-path-linker.ts` - ファイルパス検出・リンク化ロジック
    - `frontend/src/lib/components/repository-explorer/RepositoryExplorer.svelte` - ファイルエクスプローラー表示制御

### Changed

- **Codex executor セッション継続機能の実装状況を明確化** (2025-11-04)
  - ExecutorCapabilities の codex.sessionResume を true → false に変更
  - Codex SDK の `resumeThread()` 機能は動作確認済み（`.work/sandbox/codex-test/codex-thread-runner.ts`）
  - しかし、cc-anywhere への統合実装は未完了
  - TODO.md に「Codex executor セッション継続機能実装」を優先度高として追加
  - 修正ファイル: `backend/src/agents/types.ts`

### Fixed
- **Codexファイル変更検知WebSocket対応** (2025-10-22)
  - TaskQueueでFileWatcherServiceを自動起動するように修正
  - WebSocketブロードキャストリスナーを`setWebSocketServer()`で登録
  - Codex executorでファイル変更がブラウザのファイルエクスプローラーにリアルタイム表示されるように改善
  - ファイル変更インジケーター（[+], [M], [D], [R]）がCodexタスクでも正常に動作
  - 修正ファイル: backend/src/queue/task-queue.ts

### Changed
- **Claude Agent SDKへの移行** (2025-09-30)
  - パッケージを`@anthropic-ai/claude-code@2.0.1`から`@anthropic-ai/claude-agent-sdk@0.1.1`に移行
  - Anthropic公式のSDK名称変更に対応（Claude Code SDK → Claude Agent SDK）
  - 既存機能との完全な互換性を維持（全526ユニットテスト、27統合テストが成功）
  - Breaking Changes対応済み：システムプロンプトと設定の明示的な指定が必要
  - ドキュメントとREADMEを更新
- **Claude Code SDK 2.0.1へのメジャーアップグレード** (2025-01-30)
  - 安定版の最新メジャーバージョンに更新
  - 新パッケージ`@anthropic-ai/claude-agent-sdk`はまだ0.1.xのため、現行の`@anthropic-ai/claude-code@2.0.1`を採用
  - 既存機能との互換性を完全に維持
- **OpenAPI仕様の更新** (2025-01-30)
  - APIバージョンを1.0.0に更新
  - Claude Code SDK 2.0.1の情報を明記
  - API説明を充実化（主要機能リストを追加）

### Fixed
- **スケジューラーの有効/無効切り替え機能のバグ修正** (2025-01-30)
  - `ScheduleRepository.serializeEntity`メソッドに`override`キーワードを追加
  - metadataの二重JSON化問題を解決（BaseRepositoryのメソッドと重複実行されていた）
  - Date型チェックを強化してデータベース更新エラーを防止
  - トーストメッセージの表示ロジックを修正（boolean → string）
  - デバッグログを追加して問題診断を容易化
- **タスクグループのリアルタイム更新**: WebSocket通信の問題を修正
  - セッションIDがリアルタイムで正しく表示されるように修正
  - タスクステータスが「pending」→「running」→「completed」と正しく遷移するように修正
  - WebSocketブロードキャスターをリファクタリングして20以上のメソッドを統合
  - フロントエンドのWebSocketハンドラーでセッションIDとタスク情報を正しく反映

### Added
- **ドキュメント整備**: 起動スクリプトと環境変数のドキュメントを追加
  - `docs/scripts-overview.md` - スクリプト使い分けガイド
  - `docs/environment-variables.md` - 環境変数リファレンス
- **システムテスト環境の構築**: E2EテストとAPIテストの包括的な環境を追加
  - Playwrightベースのテスト環境（`/system-tests`）
  - APIインテグレーションテスト（タスク実行、エラーハンドリング、認証）
  - タスク実行結果検証テスト（ファイル作成、修正、エラー処理）
  - タスクグループ実行検証テスト（順次・並列実行、依存関係）
  - 11のテストケースすべてが正常に動作
- **CLIセッション継続機能**: Claude Code SDK v1.0.83のセッション継続機能をサポート
  - `sdkSessionId`を使用した会話の継続が可能に
  - 前回のセッションコンテキストを引き継いで新しいタスクを作成
  - APIレスポンスに`sdkSessionId`フィールドを追加
  - 統合テストを追加して動作を検証

### Changed
- **環境変数の整理**: 未使用の環境変数を`.env.example`から削除
  - `DATABASE_URL`（PostgreSQL用・未実装）を削除
  - `REDIS_URL`（Redis用・未実装）を削除
- **README.md改善**: 起動方法を用途別に整理し分かりやすく改善
- **Claude Code SDK更新**: v1.0.83の最新機能に対応
  - `options.resume`パラメータによるセッション継続のサポート

### Fixed
- **テスト生成ファイルの配置問題**: テスト時のファイル生成場所を修正
  - タスクグループAPIでworkingDirectoryを正しくcontextレベルで処理
  - backendディレクトリへの誤ったファイル生成を防止
  - .gitignoreを更新してテストファイルを除外

## [0.5.0] - 2025-08-18

### Added
- **SDK 1.0.82新機能の調査と実装計画**
  - Request Cancellation Support: 既に実装済み（AbortController使用）
  - additionalDirectories Option: 実装計画を策定、優先度高で実装予定
  - Improved Slash Command Processing: 独自実装との統合計画を策定
- **OpenAPI/Swagger統合**: APIドキュメントの自動生成と対話的テスト機能
  - OpenAPI 3.1.0仕様に基づいたAPIドキュメント（`/backend/openapi.yaml`）
  - Scalar UIによる対話的APIドキュメント（`http://localhost:5000/api/docs`）
  - 全APIエンドポイントのスキーマ定義
  - APIキー認証の永続化機能
  - Try it out機能による直接的なAPIテスト

### Changed
- **Claude Code SDK更新**: v1.0.69 から v1.0.83 にアップデート
- **SDK Continue機能への完全一本化**
  - 継続タスク機能を削除し、SDK Continue機能に統合
  - UIの簡素化と使いやすさの向上
  - 詳細設定を折りたたみ式UIに変更（SDK Continueモード時）
  - 前タスクの設定を自動的に引き継ぐよう改善

### Removed
- **継続タスク機能の削除**
  - `/api/tasks/:taskId/continue` エンドポイントを削除
  - 継続タスク作成UIを削除（`/tasks/[id]/continue/`）
  - ConversationFormatterクラスを削除（不要になったため）
  - 関連テストファイルを削除

### Fixed
- **タスクキャンセルボタンの修正**: APIエンドポイントの不一致を修正
  - フロントエンドが正しいエンドポイント（`DELETE /api/tasks/:taskId`）を呼ぶよう修正
- **30分タイムアウトの確認**: 既存のタイムアウト設定が正しく動作することを確認

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
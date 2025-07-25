
# CC-Anywhere TODO List

計画・実装時は以下のドキュメントの仕様に従って実装してください。
* https://docs.anthropic.com/ja/docs/claude-code/sdk

## 優先テスト

* セッション継続テスト(会話の継続)

## 🔧 修正が必要な問題

## 🎯 優先実装したい機能

### 最優先度 🔥

1. **Web UI アーキテクチャの再構築**
   - 現在のバニラJavaScriptベースのアーキテクチャを最新のフレームワークへ移行
   - **フレームワーク選定**:
     - React/Next.js - 豊富なエコシステムとSSR対応
     - Vue 3/Nuxt 3 - シンプルで学習曲線が緩やか
     - SvelteKit - 高パフォーマンスでコンパクト
   - **状態管理**:
     - Zustand/Jotai（React）
     - Pinia（Vue）
     - Svelte Store（Svelte）
   - **UI コンポーネントライブラリ**:
     - Shadcn/ui（React）- カスタマイズ性が高い
     - Vuetify 3（Vue）- Material Design準拠
     - Skeleton（Svelte）- モダンなデザイン
   - **ビルドツール**: Vite への統一
   - **型安全性**: TypeScript の全面採用
   - **リアルタイム通信**: Socket.io-client への移行検討

2. **バックエンド アーキテクチャのリファクタリング**
   - **レイヤードアーキテクチャの徹底**:
     - Controller層: HTTPリクエスト/レスポンスの処理
     - Service層: ビジネスロジックの実装
     - Repository層: データアクセスの抽象化
     - Domain層: ビジネスエンティティの定義
   - **依存性注入（DI）の導入**:
     - tsyringe または InversifyJS の採用
     - テスタビリティの向上
   - **エラーハンドリングの統一**:
     - カスタムエラークラスの階層化
     - エラーミドルウェアの強化
   - **データベース層の改善**:
     - TypeORMまたはPrismaへの移行検討
     - マイグレーション管理の自動化
   - **キューシステムの最適化**:
     - BullMQへの移行検討
     - ジョブの優先度管理強化

3. **Claude Code SDK `continue`オプションの対応**
   - Claude Code SDK v1.0.53で動作確認済みの`continue`オプションをcc-anywhereで実装
   - 現在の`continueSession`は新しいセッションを作成してしまうため、実際の会話継続ができない
   - `resume`オプションはSDKのバグで使用不可のため、`continue`オプションの実装が必須
   - セッションAPIとの統合により、真の会話継続機能を実現

### 高優先度 🔴

4. **開発者体験（DX）の向上**
   - **API ドキュメントの自動生成**:
     - OpenAPI/Swagger の導入
     - TypeDoc によるコードドキュメント生成
   - **開発環境の改善**:
     - Docker Compose による統一開発環境
     - ホットリロードの最適化
     - デバッグ設定の共有（.vscode/launch.json）
   - **CI/CD パイプラインの構築**:
     - GitHub Actions による自動テスト
     - 自動リリースワークフロー
     - コードカバレッジの可視化

5. **モニタリング・可観測性の強化**
   - **構造化ログの改善**:
     - OpenTelemetry の導入
     - トレーシングの実装
   - **メトリクスの収集**:
     - Prometheus互換メトリクス
     - カスタムメトリクスの定義
   - **ヘルスチェックエンドポイント**:
     - 詳細な依存関係チェック
     - Kubernetes対応のreadiness/liveness probe

6. **逐次実行モード**
   - 複数タスクの順次実行
   - 前のタスクの結果を次のタスクに渡す
   - パイプライン機能

### 中優先度 🟡

7. **テスト戦略の強化**
   - **E2Eテストの導入**:
     - Playwright によるUI自動テスト
     - APIシナリオテスト
   - **統合テストの拡充**:
     - WebSocketテストの改善
     - データベース統合テスト
   - **パフォーマンステスト**:
     - 負荷テストの自動化
     - ベンチマークスイート

8. **タスクテンプレート機能**
   - よく使うタスクをテンプレート化
   - パラメータ化されたテンプレート

9. **実行結果の可視化**
   - 統計ダッシュボード
   - 実行時間の分析
   - エラー率の可視化

10. **認証・権限管理の強化**
    - ユーザー管理機能
    - ロールベースアクセス制御
    - APIキーの詳細な権限設定

### 低優先度 🟢

1. **インタラクティブな確認処理** - WebSocketを活用した双方向通信 [PENDING]
   - Claude Code SDKの確認プロンプトに対する応答機能
   - リアルタイムでの承認/拒否の送信
   - 確認履歴の記録と表示
   - タイムアウト設定とリトライ機能
   - **注意**: 現在のClaude Code SDKにはプログラム的な確認APIが存在しないため、実装は時期尚早
   - **待機事項**: SDKがインタラクティブな確認のためのコールバックAPIを提供するまで保留

2. **Claude Code SDK 1.0.51の新機能活用**
   - **Webサーチ機能の統合** - タスク実行時にWeb検索を実行可能に
   - **@メンション機能** - プロンプトで@を使ってファイルを参照
   - **Todoリスト機能の活用** - SDKのTodoリスト機能をWeb UIで可視化
   - **/doctor診断機能** - SDK設定の診断結果をAPIで提供
   - **並列Web検索** - 複数のWeb検索を並列実行
   - **MCPサーバー実行** - ワンオフMCPサーバーの実行サポート
   - **プログレスメッセージ改善** - Bashツールの進捗表示を活用

3. **`permissionPromptTool`** - カスタム権限確認ツール
   - カスタム権限確認ロジックの実装
   - 高度なセキュリティ要件への対応

4. **ストリーミング入力サポート**
   - 大規模な入力データのストリーミング処理
   - メモリ効率の改善

5. **多言語対応**
   - コメントを英語化
   - ドキュメントを英日両方用意
   - WEBページをロケールにより切り替え可能にする

## 🚀 最近の実装成果

### WebSocket接続とログ表示の改善 ✅ (2025-01-17)
- WebSocketハートビート機能の修正
  - クライアント側からpingメッセージを送信する仕様に変更
  - サーバー側のpong応答を適切に処理
  - 接続タイムアウトエラーを解消
- Claude Code SDK実行ログの完全表示
  - すべてのツール実行（tool:start, tool:end）をリアルタイム表示
  - Claude応答メッセージ（claude:response）の表示
  - タスク進捗（task:progress）の表示
  - TodoWriteツールの更新内容を詳細表示
- ターン進捗の全ターン表示
  - 初回ターンだけでなく、すべてのターンで進捗を表示
  - `turnCount === 1`条件を削除し、全ターンで送信
- ログメッセージのスタイリング改善
  - メッセージタイプごとに色分けとアイコン表示
  - ツール別の視覚的な識別（Read: 青、Bash: 紫、Edit: 緑など）
  - HTMLエスケープ処理の追加でセキュリティ向上

### フロントエンドアーキテクチャの全面改善 ✅ (2025-01-16)
- モジュラーなJavaScriptアーキテクチャを実装
  - `logger.js` - 構造化されたフロントエンドロギングシステム
  - `websocket-manager.js` - 中央集権的なWebSocket接続管理（自動再接続、イベント駆動）
  - `state-manager.js` - グローバル状態管理システム
  - `error-handler.js` - 統一されたエラーハンドリング機構
- バグ修正
  - タスク詳細モーダルのキャッシュ問題を修正
  - タスク統計の0%成功率表示を修正（ツール未使用時は"N/A"を表示）
  - WebSocketサブスクリプション管理を改善
- WebSocketイベントの拡充
  - `task:tool:start` / `task:tool:end` - ツール実行の詳細追跡
  - `task:claude:response` - Claude応答のリアルタイム表示
  - `task:statistics` - タスク統計情報の更新
  - `todo:update` - TODO進捗の追跡
- タスク詳細モーダルのキャッシュ問題を修正
- タスク統計の0%成功率表示を修正（ツール未使用時は"N/A"を表示）

### フロントエンドのリファクタリング ✅ 
- JavaScript共通関数をutils.jsに集約
  - クエリパラメータ処理、HTML エスケープ、日時フォーマット
  - 通知表示、ナビゲーションリンク更新、接続状態監視
- CSS共通スタイルをcommon.cssに集約
  - 通知、接続状態、モーダル、ボタン、フォーム、ページネーション
- コードの重複を大幅に削減
- メンテナンス性の向上

### スケジューラー機能のUI改善 ✅ 
- タスク実行画面とスケジューラー画面のスタイルを完全に統一
- ナビゲーションリンクにクエリパラメータを引き継ぐ機能を追加
- 接続状態チェックのエンドポイントを修正
- 不要なファイルを削除（index-simple.html, app-simple.js）

### タイマー投稿（スケジュール実行）機能 ✅
- Cron式による定期実行（5フィールド形式）
- ワンタイム実行（指定日時での1回限り実行）
- タイムゾーン対応（Cronスケジュール）
- 実行履歴の記録と管理
- スケジュールの有効化/無効化
- REST APIによる完全な管理機能
- Web UIからのスケジュール管理
- 詳細: [スケジューラー機能ドキュメント](./docs/features/scheduler.md)

### 権限モード実装の改善
- Claude Code SDKの権限モードを正しく実装
- `ask` → `default`, `allow` → `bypassPermissions`, `deny` → `plan` へのマッピング
- Web UIも SDK に合わせて更新（default, acceptEdits, bypassPermissions, plan）
- cc-anywhere経由でもファイル作成が可能に（permissionMode: "allow"指定で）

### タスク実行ログ・結果表示の改善 ✅
- ツール使用情報の詳細表示（Read/Write/Edit/Bash等）をリアルタイムで実装
- タスク実行サマリーの生成（使用ツール統計、ファイル操作一覧、実行時間等）
- WebSocket経由で構造化されたログ情報（tool_usage, progress, summary）を送信
- 各ツールにアイコンを設定（📖読取、✏️作成、📝編集、💻コマンド等）
- エラー時の詳細情報表示の改善
- Markdown形式の結果を適切にレンダリング
- ネストされたJSONレスポンス（task.result.result）に対応

### 自己組織化型並列実行
- 司令塔パターンによるタスクの自律的な並列実行を実現
- タスクがHTTP API経由で他のタスクを作成・管理
- Git worktreeを使用した独立環境での安全な並列実行
- 詳細: [自己組織化型並列実行ドキュメント](./docs/self-organized-parallel-execution.md)

## 📋 実装済み機能一覧

<details>
<summary>Claude Code SDK オプション（全実装済み）</summary>

### 基本オプション ✅
- `maxTurns` - 会話ターン数の制限（1-50）
- `allowedTools` / `disallowedTools` - ツール使用の制限
- `systemPrompt` - カスタムシステムプロンプト（最大10,000文字）
- `permissionMode` - 編集権限の制御（ask/allow/deny/plan）
- `executable` / `executableArgs` - 実行環境の指定
- `mcpConfig` - Model Context Protocol設定
- `continueSession` / `resumeSession` - セッション継続機能
- `verbose` - 詳細ログ出力

### プリセット管理 ✅
- 設定の保存/読み込み機能
- システムプリセットとユーザープリセット
- Web UIからの管理機能

### Web UI改善 ✅
- SDKオプション対応版をデフォルトに
- レスポンシブデザイン対応
- スマートフォン操作性向上

### タスク一覧のページネーション ✅
- APIレベルでのページング対応
- Web UIでのページナビゲーション
- 表示件数選択機能（10, 20, 50, 100件）
- 大量タスク時のパフォーマンス改善

</details>

## 🛠️ その他の改善項目

### Web UI改善 ✅
- もっと使いやすいUIに改善
- フロントエンドのリファクタリング実施（2025-01-14）
- タスク実行画面とスケジューラー画面のスタイル統一（2025-01-14）

### エラーハンドリングの強化
- Claude Code SDK特有のエラーパターンへの対応
- より詳細なエラーメッセージの提供
- エラーリカバリー機能

### パフォーマンスの最適化
- 大規模プロジェクトでの実行速度改善
- メモリ使用量の削減
- 並列実行の効率化

### セキュリティの強化
- API認証の改善
- ツール実行権限の細かい制御
- 監査ログ機能

## 📝 Git Worktree機能の動作仕様

### 基本動作
- Worktreeは独立した作業ディレクトリとして作成
- メインリポジトリとは別の場所で作業を実行
- デフォルトではタスク完了後に自動クリーンアップ

### クリーンアップ時の動作
1. **デフォルト動作**（autoCleanup: true）
   - 未コミットの変更は自動的にパッチファイルとして保存
   - パッチは `.worktree-backups/` ディレクトリに保存
   - worktreeとブランチは削除

2. **keepAfterCompletion有効時**
   - Worktreeは削除されない
   - 作成・修正したファイルはそのまま保持
   - 手動でコミット・マージ等の操作が可能

### 設定例
```typescript
{
  options: {
    worktree: {
      enabled: true,
      branchName: "feature/task-123",
      keepAfterCompletion: true  // タスク完了後も保持
    }
  }
}
```
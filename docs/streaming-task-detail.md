# ストリーミングタスク詳細実装ガイド

## 概要

このドキュメントでは、cc-anywhereでタスク実行の詳細情報をリアルタイムでストリーミング表示する機能の実装について説明します。

## 最新の修正内容（2024年11月）

### 修正された問題
タスク詳細を開いたときに、別のタスクの結果が表示される問題を修正しました。

### 問題の原因
1. **タスクIDのデフォルト値**: URLパラメータが未指定の場合に `'test-task-id'` が使用されていた
2. **不十分なメッセージフィルタリング**: WebSocketメッセージのタスクIDチェックが不足していた
3. **サブスクリプション管理の不備**: 既存のサブスクリプションが適切にクリアされていなかった
4. **初期ログの残存**: 前のタスクのログが残ったまま新しいタスクを表示していた

### 実装した修正（第1弾）
1. **タスクID必須化**:
   - URLパラメータにタスクIDが必須となり、未指定の場合はエラーメッセージを表示
   - デフォルト値を削除

2. **WebSocketサブスクリプション管理の改善**:
   - 現在のサブスクリプションIDを追跡する `currentSubscribedTaskId` 変数を追加
   - 新しいタスクをサブスクライブする前に既存のサブスクリプションをクリア
   - WebSocket再接続時にサブスクリプション状態をリセット

3. **メッセージフィルタリング強化**:
   - すべてのWebSocketメッセージハンドラーでタスクIDを確認
   - 現在表示中のタスクに関連するメッセージのみを処理

4. **初期化処理の改善**:
   - ページ読み込み時にログコンテナをクリア
   - エラーハンドリングを強化
   - より詳細なタスク情報を表示

### 実装した修正（第2弾）- 前回データ残存問題
1. **UIリセット関数の追加**:
   - `resetUI()` 関数を追加し、すべてのUI要素を初期状態にリセット
   - ログ、ステータス、プログレスバー、TODO、統計情報をすべてクリア
   - 内部状態（`startTime`、`toolTimings`）もリセット

2. **WebSocket接続管理の改善**:
   - 既存の接続がある場合は新しい接続を作る前に閉じる
   - ページを離れる際（`beforeunload`）にサブスクリプションを解除して接続をクリーンアップ

3. **URLパラメータ変更の監視**:
   - タブ切り替え時（`visibilitychange`）にタスクIDの変更を検出
   - ブラウザの戻る/進む（`popstate`）でタスクIDが変更された場合にページをリロード
   - 異なるタスクを表示する際に前のデータが残らないよう対応

## アーキテクチャ

### 1. バックエンド構成

#### WebSocketイベントタイプ（拡張済み）
- `task:tool:start` - ツール実行開始
- `task:tool:end` - ツール実行終了
- `task:tool:progress` - ツール進捗
- `task:claude:response` - Claudeの応答
- `task:statistics` - 統計情報
- `task:todo_update` - Todo更新（既存）

#### 実装ファイル
- `/src/websocket/types.ts` - 新しいイベントタイプの定義
- `/src/websocket/websocket-server.ts` - ブロードキャストメソッドの追加
- `/src/claude/claude-code-client.ts` - 詳細なイベント生成
- `/src/queue/task-queue.ts` - イベントのディスパッチ

### 2. データフロー

```
Claude Code SDK
    ↓ (onProgress callback)
Claude Code Client
    ↓ (structured events)
Task Queue
    ↓ (WebSocket broadcast)
WebSocket Server
    ↓ (real-time streaming)
Frontend Client
```

### 3. イベント詳細

#### Tool Start Event
```javascript
{
  type: "task:tool:start",
  payload: {
    taskId: "task-123",
    toolId: "tool-456",
    tool: "Write",
    input: { file_path: "test.txt", content: "Hello" },
    timestamp: "2024-01-20T10:00:00Z"
  }
}
```

#### Tool End Event
```javascript
{
  type: "task:tool:end",
  payload: {
    taskId: "task-123",
    toolId: "tool-456",
    tool: "Write",
    output: "File written successfully",
    error: null,
    duration: 125,
    success: true,
    timestamp: "2024-01-20T10:00:00.125Z"
  }
}
```

#### Claude Response Event
```javascript
{
  type: "task:claude:response",
  payload: {
    taskId: "task-123",
    text: "I'll create a hello world file for you...",
    turnNumber: 1,
    timestamp: "2024-01-20T10:00:00Z"
  }
}
```

#### Statistics Event
```javascript
{
  type: "task:statistics",
  payload: {
    taskId: "task-123",
    statistics: {
      totalTurns: 3,
      totalToolCalls: 5,
      toolStats: {
        "Write": {
          count: 2,
          successes: 2,
          failures: 0,
          totalDuration: 250,
          avgDuration: 125
        }
      },
      currentPhase: "complete",
      elapsedTime: 5000
    }
  }
}
```

## フロントエンド実装

### 1. WebSocket接続

```javascript
const ws = new WebSocket('ws://localhost:5000/ws');

// 認証
ws.send(JSON.stringify({
  type: 'auth',
  payload: { apiKey: API_KEY }
}));

// タスクへのサブスクライブ
ws.send(JSON.stringify({
  type: 'subscribe',
  payload: { taskId: TASK_ID }
}));
```

### 2. イベントハンドリング

```javascript
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  
  switch (message.type) {
    case 'task:tool:start':
      // ツール実行開始の表示
      showToolStart(message.payload);
      break;
      
    case 'task:tool:end':
      // ツール実行結果の表示
      showToolResult(message.payload);
      break;
      
    case 'task:claude:response':
      // Claudeの応答表示
      showClaudeResponse(message.payload);
      break;
      
    case 'task:statistics':
      // 統計情報の更新
      updateStatistics(message.payload);
      break;
  }
};
```

### 3. UI表示例

主な表示要素：
- リアルタイムログ表示（ターミナル風）
- ツール実行状況（アイコン、実行時間）
- Claudeの応答（ターン番号付き）
- Todo進捗
- 最終統計（ツール使用回数、成功率、実行時間）

## 使用方法

### 1. バックエンドでの有効化

タスク実行時に自動的にストリーミングイベントが送信されます。

### 2. フロントエンドでの実装

1. WebSocket接続を確立
2. 認証とタスクへのサブスクライブ
3. イベントハンドラーの実装
4. UIコンポーネントへの反映

### 3. デバッグ

WebSocketメッセージを確認：
```javascript
ws.onmessage = (event) => {
  console.log('WebSocket message:', JSON.parse(event.data));
};
```

## パフォーマンス考慮事項

1. **メッセージサイズ**: 大きなツール出力は要約して送信
2. **頻度制限**: 高頻度のイベントはバッファリング
3. **接続管理**: 自動再接続の実装推奨

## 今後の拡張

1. **イベントフィルタリング**: クライアント側で必要なイベントのみ受信
2. **履歴再生**: 過去のタスク実行の再生機能
3. **カスタムイベント**: プラグイン用のカスタムイベントサポート
# TODO機能テスト用タスク

## テスト手順

1. ブラウザで http://localhost:5000/?apiKey=hoge にアクセス

2. 以下の内容でタスクを作成：
   - **実行内容**: "TODOリストを作成してテストしてください。3つのタスクを作り、順番に処理してください"
   - **作業ディレクトリ**: /Users/nakamura.shuta/dev/node/test
   - **権限モード**: すべて自動
   
3. タスクを実行して以下を確認：
   - サーバーログに "TodoWrite" 関連のメッセージが出力されるか
   - ブラウザコンソールに "task:todo_update" メッセージが表示されるか
   - タスク詳細画面でTODOリストが表示されるか

## 期待される動作

1. Claude Code SDKがTodoWriteツールを使用
2. サーバーが todo_update メッセージを処理
3. WebSocketで todo_update メッセージが送信
4. ブラウザでTODOリストが表示される

## デバッグポイント

サーバーログで以下を確認：
- "TodoWrite raw result"
- "Sending todo_update progress notification"
- "Processing todo_update progress in task queue"
- "Broadcasting todo update via WebSocket"

ブラウザコンソールで以下を確認：
- "[WebSocket] task:todo_update処理:"
- "Todo update received:"
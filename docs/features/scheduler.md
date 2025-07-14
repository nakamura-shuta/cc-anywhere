# スケジューラー機能

cc-anywhereのスケジューラー機能を使用すると、タスクを定期的または特定の時刻に実行することができます。

## 概要

スケジューラー機能は以下をサポートしています：

- **Cronスケジュール**: Cron式を使用した定期実行
- **ワンタイム実行**: 指定した日時での1回限りの実行
- **タイムゾーン対応**: Cronスケジュールでのタイムゾーン指定
- **実行履歴**: 各スケジュールの実行履歴とステータス追跡

## API エンドポイント

### スケジュール作成

```http
POST /api/schedules
```

#### リクエストボディ

```json
{
  "name": "日次バックアップ",
  "description": "毎日午前2時にバックアップを実行",
  "taskRequest": {
    "instruction": "プロジェクトのバックアップを作成してください",
    "context": {
      "workingDirectory": "/project"
    }
  },
  "schedule": {
    "type": "cron",
    "expression": "0 2 * * *",
    "timezone": "Asia/Tokyo"
  }
}
```

#### ワンタイム実行の例

```json
{
  "name": "デプロイ準備",
  "taskRequest": {
    "instruction": "本番環境へのデプロイ準備を実行"
  },
  "schedule": {
    "type": "once",
    "executeAt": "2024-01-15T10:00:00Z"
  }
}
```

### スケジュール一覧取得

```http
GET /api/schedules?limit=10&offset=0&status=active
```

クエリパラメータ：
- `limit`: 取得件数（デフォルト: 10、最大: 100）
- `offset`: オフセット（デフォルト: 0）
- `status`: フィルタするステータス（active/inactive）

### スケジュール詳細取得

```http
GET /api/schedules/:id
```

### スケジュール更新

```http
PUT /api/schedules/:id
```

更新可能なフィールド：
- `name`
- `description`
- `taskRequest`
- `schedule`
- `status`

### スケジュール削除

```http
DELETE /api/schedules/:id
```

### スケジュール有効化/無効化

```http
POST /api/schedules/:id/enable
POST /api/schedules/:id/disable
```

### 実行履歴取得

```http
GET /api/schedules/:id/history
```

## Cron式の書き方

Cron式は5つのフィールドで構成されます：

```
分 時 日 月 曜日
```

例：
- `0 * * * *` - 毎時0分に実行
- `0 2 * * *` - 毎日午前2時に実行
- `0 9 * * 1-5` - 平日の午前9時に実行
- `*/15 * * * *` - 15分ごとに実行
- `0 0 1 * *` - 毎月1日の午前0時に実行

## スケジュールのライフサイクル

1. **作成時**: ステータスは `active`（デフォルト）または `inactive` で作成
2. **実行時**: 
   - Cronスケジュール: 次回実行時刻を計算し、継続的に実行
   - ワンタイムスケジュール: 実行後、ステータスが `completed` に変更
3. **更新**: 実行中のスケジュールも更新可能（次回実行から反映）
4. **削除**: 実行中のジョブは停止され、スケジュールは削除

## タスクステータス

スケジュールされたタスクは以下のステータスを持ちます：

- `SCHEDULED`: スケジュール待機中
- `DELAYED`: 遅延実行待機中  
- `PENDING`: 実行待機中
- `RUNNING`: 実行中
- `COMPLETED`: 完了
- `FAILED`: 失敗
- `CANCELLED`: キャンセル済み

## 使用例

### 日次レポート生成

```javascript
const schedule = {
  name: "日次レポート生成",
  description: "毎日午前6時にレポートを生成",
  taskRequest: {
    instruction: "売上レポートを生成してメール送信してください",
    context: {
      workingDirectory: "/reports"
    },
    options: {
      sdk: {
        permissionMode: "allow"
      }
    }
  },
  schedule: {
    type: "cron",
    expression: "0 6 * * *",
    timezone: "Asia/Tokyo"
  }
};

// APIリクエスト
fetch('/api/schedules', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'your-api-key'
  },
  body: JSON.stringify(schedule)
});
```

### 定期的なコード品質チェック

```javascript
const schedule = {
  name: "コード品質チェック",
  description: "4時間ごとにlintとテストを実行",
  taskRequest: {
    instruction: "npm run lint && npm run test を実行し、結果をSlackに通知してください",
    context: {
      workingDirectory: "/project"
    }
  },
  schedule: {
    type: "cron",
    expression: "0 */4 * * *"
  }
};
```

## 注意事項

1. **タイムゾーン**: Cronスケジュールでタイムゾーンを指定しない場合、サーバーのタイムゾーンが使用されます
2. **同時実行**: 同じスケジュールのタスクが重複して実行されることはありません
3. **エラーハンドリング**: タスク実行が失敗しても、スケジュール自体は継続されます
4. **パフォーマンス**: 大量のスケジュールを作成する場合は、実行時刻が分散するように設計してください

## トラブルシューティング

### スケジュールが実行されない

1. スケジュールのステータスが `active` であることを確認
2. Cron式が正しいことを確認（オンラインのCron式テスターを使用）
3. タイムゾーンの設定を確認
4. サーバーログでエラーメッセージを確認

### 実行履歴が記録されない

実行履歴は正常に開始されたタスクのみ記録されます。タスク作成時のエラーは記録されません。

## Web UI

スケジューラー機能はWeb UIからも利用できます。`/scheduler.html`にアクセスすることで、ブラウザから簡単にスケジュールを管理できます。

### Web UIの機能

1. **スケジュール作成**
   - 直感的なフォームでスケジュールを作成
   - Cron式の例示ボタン（毎時、毎日2時、平日9時、15分毎）
   - リポジトリ選択
   - 権限モード設定

2. **スケジュール一覧**
   - ステータス別フィルタリング（すべて/有効/無効）
   - スケジュール情報の表示（タイプ、実行回数、次回実行時刻）
   - アクション（有効化/無効化、履歴表示、削除）

3. **実行履歴**
   - 各スケジュールの実行履歴をモーダルで表示
   - 実行日時、ステータス、タスクIDの確認
   - エラー情報の表示

4. **ヘルプ機能**
   - Cron式の書き方ヘルプモーダル
   - フィールド説明と例示

## 今後の拡張予定

- Webhookトリガーのサポート
- スケジュール実行の依存関係管理
- 実行結果に基づく条件分岐
- スケジュールのインポート/エクスポート機能
- Web UIでのバルク操作機能
# スケジューラー機能

タスクを定期的または特定の時刻に自動実行する機能です。

## 主な機能

- **Cron定期実行**: 繰り返し実行（例: 毎日2時）
- **ワンタイム実行**: 指定日時に1回だけ実行
- **実行履歴**: 実行結果の記録と確認
- **Web UI**: ブラウザから簡単に管理
- **タイムゾーン対応**: Cronスケジュールでタイムゾーン指定可能
- **権限モード設定**: タスク実行時の権限モードを指定可能

## Web UIでの使用

1. ブラウザで `http://localhost:5000/scheduler.html?apiKey=your-api-key` を開く
2. 「新規スケジュール」フォームで設定を入力
3. Cron式の例：
   - `* * * * *` - 毎分
   - `*/5 * * * *` - 5分ごと
   - `0 * * * *` - 毎時0分
   - `0 2 * * *` - 毎日午前2時
   - `0 9 * * 1-5` - 平日午前9時
   - `*/15 * * * *` - 15分ごと
4. 権限モードを選択：
   - 確認あり (default) - すべての操作前に確認
   - 編集のみ自動 (acceptEdits) - ファイル編集は自動、その他は確認
   - すべて自動 (bypassPermissions) - すべての操作を自動実行
   - 計画のみ (plan) - 実行せず計画のみ作成

## API使用例

### Cron定期実行の作成
```bash
curl -X POST http://localhost:5000/api/schedules \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "日次バックアップ",
    "description": "毎日午前2時にバックアップを作成",
    "taskRequest": {
      "instruction": "バックアップを作成",
      "context": {
        "workingDirectory": "/path/to/project"
      },
      "options": {
        "sdk": {
          "permissionMode": "bypassPermissions",
          "maxTurns": 5
        }
      }
    },
    "schedule": {
      "type": "cron",
      "expression": "0 2 * * *",
      "timezone": "Asia/Tokyo"
    }
  }'
```

### ワンタイム実行の作成
```bash
curl -X POST http://localhost:5000/api/schedules \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "リリース作業",
    "taskRequest": {
      "instruction": "v1.0.0をリリース"
    },
    "schedule": {
      "type": "once",
      "executeAt": "2025-02-01T10:00:00Z"
    }
  }'
```

## Cron式の書き方

```
分 時 日 月 曜日
│  │  │  │  │
│  │  │  │  └─ 曜日 (0-7, 0と7は日曜)
│  │  │  └──── 月 (1-12)
│  │  └─────── 日 (1-31)
│  └────────── 時 (0-23)
└───────────── 分 (0-59)
```

特殊文字：
- `*` - すべての値
- `,` - リスト（例: `1,3,5`）
- `-` - 範囲（例: `1-5`）
- `/` - 間隔（例: `*/15` = 15分ごと）

## その他のAPI

```bash
# スケジュール一覧
GET /api/schedules

# スケジュールの有効化/無効化
PUT /api/schedules/{id}/status

# スケジュールの削除
DELETE /api/schedules/{id}

# 実行履歴の確認
GET /api/schedules/{id}/history
```
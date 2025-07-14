# スケジューラー機能

タスクを定期的または特定の時刻に自動実行する機能です。

## 主な機能

- **Cron定期実行**: 繰り返し実行（例: 毎日2時）
- **ワンタイム実行**: 指定日時に1回だけ実行
- **実行履歴**: 実行結果の記録と確認
- **Web UI**: ブラウザから簡単に管理

## Web UIでの使用

1. ブラウザで `http://localhost:5000/scheduler.html` を開く
2. 「新規スケジュール」フォームで設定を入力
3. Cron式の例：
   - `* * * * *` - 毎分
   - `0 2 * * *` - 毎日午前2時
   - `0 9 * * 1-5` - 平日午前9時

## API使用例

### Cron定期実行の作成
```bash
curl -X POST http://localhost:5000/api/schedules \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "日次バックアップ",
    "taskRequest": {
      "instruction": "バックアップを作成",
      "options": {
        "sdk": {
          "permissionMode": "bypassPermissions"
        }
      }
    },
    "schedule": {
      "type": "cron",
      "expression": "0 2 * * *"
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
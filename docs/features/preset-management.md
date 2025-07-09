# プリセット管理機能

## 概要

cc-anywhereでは、Claude Code SDKのオプション設定をプリセットとして保存・管理できます。これにより、頻繁に使用する設定の組み合わせを簡単に再利用できます。

## 機能

### プリセットの種類

1. **システムプリセット**
   - あらかじめ用意された標準的な設定
   - 読み取り専用（編集・削除不可）
   - 例：デフォルト設定、セーフモード、開発モード

2. **ユーザープリセット**
   - ユーザーが作成・保存した設定
   - 編集・削除可能
   - 設定名と説明を自由に設定可能

### 保存される設定項目

- **SDKオプション**
  - 最大ターン数（maxTurns）
  - 権限モード（permissionMode）
  - 許可ツール（allowedTools）
  - 禁止ツール（disallowedTools）
  - システムプロンプト（systemPrompt）
  - 出力形式（outputFormat）
  - 詳細ログ（verbose）
  - その他のSDK設定

- **実行オプション**
  - タイムアウト時間
  - Git Worktree使用設定
  - Worktreeブランチ名
  - タスク完了後のWorktree保持設定

## API エンドポイント

### GET /api/presets
全プリセット一覧を取得

```json
{
  "presets": [
    {
      "id": "default",
      "name": "デフォルト設定",
      "description": "一般的なタスク用の標準設定",
      "isSystem": true,
      "settings": {
        "sdk": {
          "maxTurns": 3,
          "permissionMode": "ask",
          "allowedTools": ["Read", "Write", "Edit"]
        },
        "timeout": 600000,
        "useWorktree": false
      }
    }
  ],
  "userPresets": [
    {
      "id": "user-123",
      "name": "開発用設定",
      "description": "開発作業用のカスタム設定",
      "isSystem": false,
      "settings": { ... },
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

### GET /api/presets/:id
特定のプリセットを取得

### POST /api/presets
新しいユーザープリセットを作成

リクエスト:
```json
{
  "name": "新しいプリセット",
  "description": "説明文",
  "settings": {
    "sdk": { ... },
    "timeout": 900000,
    "useWorktree": true
  }
}
```

### PUT /api/presets/:id
ユーザープリセットを更新（システムプリセットは更新不可）

### DELETE /api/presets/:id
ユーザープリセットを削除（システムプリセットは削除不可）

## Web UI での使用方法

### プリセットの適用

1. タスク作成フォームの「設定プリセット」セクションでドロップダウンから選択
2. 選択すると、そのプリセットの設定が自動的にフォームに反映される

### プリセットの保存

1. タスク作成フォームで希望の設定を行う
2. 「保存」ボタンをクリック
3. プリセット名と説明（オプション）を入力
4. 保存を実行

### プリセットの管理

1. 「管理」ボタンをクリック
2. 保存されたユーザープリセット一覧が表示される
3. 各プリセットで以下の操作が可能：
   - 適用：そのプリセットの設定をフォームに反映
   - 削除：プリセットを削除（確認ダイアログあり）

## 設定ファイル

プリセットは `/config/task-presets.json` に保存されます。

### ファイル構造

```json
{
  "presets": [
    // システムプリセット（読み取り専用）
  ],
  "userPresets": [
    // ユーザー作成のプリセット
  ]
}
```

### デフォルトのシステムプリセット

1. **デフォルト設定**
   - 一般的なタスク用の標準設定
   - maxTurns: 3, permissionMode: "ask"
   - 基本的なツールのみ許可

2. **セーフモード**
   - 読み取り専用の安全な設定
   - maxTurns: 1, permissionMode: "deny"
   - 書き込み系ツールを禁止

3. **開発モード**
   - 開発作業に適した設定
   - maxTurns: 10, permissionMode: "allow"
   - すべてのツールを許可、Worktree有効

## 実装詳細

- プリセットIDは自動生成（UUID v4）
- システムプリセットは `isSystem: true` フラグで識別
- ユーザープリセットには作成日時・更新日時を記録
- 同名のプリセットは作成不可（重複チェックあり）
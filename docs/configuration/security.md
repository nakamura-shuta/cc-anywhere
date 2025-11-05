# セキュリティ設定

## 概要

CC-Anywhereのセキュリティ設定は、作業ディレクトリのアクセス制御を中心に構成されています。不正なパスへのアクセスを防ぎ、システムの安全性を確保します。

## 作業ディレクトリのホワイトリスト

### 自動許可されるディレクトリ

以下のディレクトリは自動的に許可リストに追加されます：

1. **プロジェクトルート** - CC-Anywhereプロジェクト自身のディレクトリ
2. **環境変数で指定されたディレクトリ** - `ALLOWED_WORKING_DIRECTORIES`
3. **repositories.jsonのリポジトリ** - `backend/config/repositories.json`に記載されたすべてのリポジトリ

### repositories.json自動読み込み

`backend/config/repositories.json`に記載されたリポジトリは、自動的にセキュリティホワイトリストに追加されます：

```json
{
  "repositories": [
    {
      "name": "test",
      "path": "/Users/nakamura.shuta/dev/node/test"
    },
    {
      "name": "mcp-bookmark",
      "path": "/Users/nakamura.shuta/dev/rust/mcp-bookmark"
    }
  ]
}
```

この設定により、各リポジトリへのアクセスが自動的に許可されます。

## 環境変数

### ALLOWED_WORKING_DIRECTORIES

追加で許可するディレクトリをカンマ区切りで指定します：

```bash
# .env
ALLOWED_WORKING_DIRECTORIES=/path/to/dir1,/path/to/dir2
```

空の場合、プロジェクトルートとrepositories.jsonのリポジトリのみが許可されます。

### STRICT_PATH_VALIDATION

厳格なパス検証を有効化します（デフォルト: `true`）：

```bash
# .env
STRICT_PATH_VALIDATION=true
```

`true`の場合、以下のシステムディレクトリへのアクセスがブロックされます：
- `/etc`
- `/root`
- `/sys`
- `/proc`
- その他の重要なシステムディレクトリ

### REQUIRE_WHITELIST

ホワイトリストチェックを必須にします（デフォルト: `true`）：

```bash
# .env
REQUIRE_WHITELIST=true
```

`true`の場合、許可リストに含まれていないディレクトリへのアクセスは拒否されます。

## パス検証の仕組み

### 検証フロー

1. 指定されたパスを絶対パスに解決
2. シンボリックリンクを解決
3. 厳格モードの場合、システムディレクトリをチェック
4. ホワイトリスト必須の場合、許可リストに含まれるかチェック

### PathValidator

```typescript
import { PathValidator } from './utils/path-validator';

// パスの検証
const validatedPath = await PathValidator.validateWorkingDirectory(
  '/path/to/directory'
);
```

### エラーハンドリング

パス検証に失敗した場合、`PathValidationError`がスローされます：

```typescript
try {
  const validatedPath = await PathValidator.validateWorkingDirectory(path);
} catch (error) {
  if (error instanceof PathValidationError) {
    // パス検証エラーの処理
    console.error('Invalid path:', error.message);
  }
}
```

## セキュリティベストプラクティス

### 1. 最小権限の原則

必要なディレクトリのみを許可リストに追加してください：

```bash
# 推奨
ALLOWED_WORKING_DIRECTORIES=/Users/username/projects

# 非推奨（広すぎる）
ALLOWED_WORKING_DIRECTORIES=/Users/username
```

### 2. システムディレクトリの保護

`STRICT_PATH_VALIDATION=true`を維持してください。これにより、重要なシステムディレクトリへのアクセスが防止されます。

### 3. ホワイトリストの必須化

本番環境では`REQUIRE_WHITELIST=true`を必ず設定してください。

### 4. 定期的な監査

`repositories.json`と環境変数の設定を定期的にレビューし、不要なディレクトリが含まれていないか確認してください。

## デバッグ

開発環境では、許可されたディレクトリのリストがログに出力されます：

```
🔐 Allowed working directories:
  - /Users/nakamura.shuta/dev/cc-anywhere
  - /Users/nakamura.shuta/dev/node/test
  - /Users/nakamura.shuta/dev/rust/mcp-bookmark
```

## トラブルシューティング

### "Working directory is not in the allowed list"エラー

**原因**: 指定されたディレクトリが許可リストに含まれていません。

**解決方法**:
1. `repositories.json`にリポジトリを追加
2. または環境変数`ALLOWED_WORKING_DIRECTORIES`に追加
3. サーバーを再起動

### repositories.jsonの変更が反映されない

**原因**: サーバーの再起動が必要です。

**解決方法**:
```bash
./scripts/stop-all.sh
./scripts/start-dev.sh
```

## 関連ファイル

- `backend/src/config/index.ts` - 設定の読み込みとマージ処理
- `backend/src/utils/path-validator.ts` - パス検証ロジック
- `backend/config/repositories.json` - リポジトリ設定
- `.env` - 環境変数設定

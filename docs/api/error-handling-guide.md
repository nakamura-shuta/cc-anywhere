# エラーハンドリングガイドライン

## 概要

このドキュメントは、cc-anywhereバックエンドのエラーハンドリング統一方針とベストプラクティスを説明します。

## エラークラス階層

### 基底クラス

```typescript
import { AppError } from "../utils/errors.js";
```

- `AppError` - すべてのカスタムエラーの基底クラス
  - `statusCode`: HTTPステータスコード
  - `code`: エラーコード（大文字のSNAKE_CASE）
  - `details`: 追加の詳細情報

### 標準エラークラス

```typescript
import { 
  ValidationError,      // 400 - バリデーションエラー
  AuthenticationError,  // 401 - 認証エラー
  AuthorizationError,   // 403 - 認可エラー
  NotFoundError,       // 404 - リソース未発見
  ConflictError,       // 409 - 競合エラー
  RateLimitError,      // 429 - レート制限
  SystemError          // 500 - システムエラー
} from "../utils/errors.js";
```

### ドメイン固有エラークラス

#### タスク関連

```typescript
import { 
  TaskNotFoundError,
  InvalidTaskRequestError,
  TaskExecutionError,
  TaskCancellationError,
  WorkerNotAvailableError
} from "../utils/task-errors.js";
```

#### スケジュール関連

```typescript
import { 
  ScheduleNotFoundError,
  InvalidScheduleError,
  InvalidCronExpressionError,
  ScheduleExecutionError
} from "../utils/schedule-errors.js";
```

## 使用方法

### ❌ 避けるべきパターン

```typescript
// 手動でエラーレスポンスを作成しない
const errorResponse: ErrorResponse = {
  error: {
    message: "Task not found",
    statusCode: 404,
    code: "TASK_NOT_FOUND",
  },
};
return reply.status(404).send(errorResponse);
```

### ✅ 推奨パターン

```typescript
// 適切なエラークラスをthrowする
throw new TaskNotFoundError(taskId);
```

## ルートハンドラの実装

### 基本的な例

```typescript
fastify.get("/tasks/:taskId", async (request, reply) => {
  const { taskId } = request.params;
  const task = repository.getById(taskId);
  
  if (!task) {
    // エラーをthrowするだけ
    throw new TaskNotFoundError(taskId);
  }
  
  return task;
});
```

### try-catchが必要な場合

```typescript
fastify.post("/tasks/:taskId/retry", async (request, reply) => {
  try {
    const result = await someAsyncOperation();
    return result;
  } catch (error) {
    // 元のエラーを含めて新しいエラーをthrow
    throw new TaskExecutionError(
      "Failed to retry task",
      request.params.taskId,
      error instanceof Error ? error : undefined
    );
  }
});
```

## カスタムエラークラスの作成

新しいエラータイプが必要な場合：

```typescript
export class CustomBusinessError extends AppError {
  constructor(message: string, customField: string) {
    super(message, 400, "CUSTOM_BUSINESS_ERROR", {
      customField
    });
    this.name = "CustomBusinessError";
  }
}
```

## エラーレスポンス形式

すべてのエラーは統一された形式で返されます：

```json
{
  "error": {
    "message": "人間が読めるエラーメッセージ",
    "statusCode": 404,
    "code": "TASK_NOT_FOUND",
    "details": {
      "taskId": "task-123"
    }
  }
}
```

開発環境では追加情報が含まれます：
- `stack`: スタックトレース
- `timestamp`: エラー発生時刻
- `originalMessage`: 元のエラーメッセージ（500エラーの場合）

## ベストプラクティス

1. **具体的なエラークラスを使用する**
   - 汎用的な`AppError`より、`TaskNotFoundError`などの具体的なクラスを優先

2. **エラーコンテキストを含める**
   - エラーに関連するID、フィールド名などの情報を含める

3. **ログ出力はミドルウェアに任せる**
   - ルートハンドラでエラーログを出力する必要はない

4. **エラーの再throw時は元のエラーを保持**
   ```typescript
   catch (error) {
     throw new TaskExecutionError(
       "操作に失敗しました",
       taskId,
       error instanceof Error ? error : undefined
     );
   }
   ```

5. **バリデーションはスキーマで行う**
   - Fastifyのスキーマバリデーションを活用し、手動バリデーションは最小限に

## エラーモニタリング

開発環境では `/api/internal/error-metrics` でエラーメトリクスを確認できます：

```bash
curl http://localhost:3001/api/internal/error-metrics
```

レスポンス例：
```json
{
  "totalErrors": 42,
  "errorsByCode": {
    "TASK_NOT_FOUND": 15,
    "VALIDATION_ERROR": 10
  },
  "errorsByStatus": {
    "404": 15,
    "400": 20,
    "500": 7
  },
  "errorsByRoute": {
    "/api/tasks/abc": 5,
    "/api/schedules/xyz": 3
  }
}
```

## 移行ガイド

既存のエラーハンドリングを移行する手順：

1. 手動のErrorResponse作成を探す
2. 適切なエラークラスに置き換える
3. try-catchブロックを削除（必要な場合を除く）
4. テストを実行して動作確認

## 参考リンク

- [エラーハンドリング実装詳細](../.work/error-handling-refactoring.md)
- [Fastifyエラーハンドリング](https://www.fastify.io/docs/latest/Reference/Errors/)
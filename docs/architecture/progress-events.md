# Progress Event Type System

## 概要

このドキュメントは、cc-anywhereプロジェクトにおける型安全なProgress Eventシステムについて説明します。

## 背景

以前のProgress Eventシステムでは、`any`型や緩い型定義(`{ type: string; message: string }`)を使用していたため、以下の問題がありました：

- 型安全性の欠如によるランタイムエラーのリスク
- IDEのオートコンプリートやタイプヒントが不十分
- リファクタリング時の影響範囲が不明確
- データ構造の不整合が発生しやすい

## 設計

### Discriminated Union Types

TypeScriptのDiscriminated Union（判別可能なユニオン型）を使用して、10種類のProgress Eventを型安全に扱います。

```typescript
export type ProgressEvent =
  | LogProgressEvent
  | ToolStartProgressEvent
  | ToolEndProgressEvent
  | ClaudeResponseProgressEvent
  | ReasoningProgressEvent
  | TodoUpdateProgressEvent
  | GeneralProgressEvent
  | SummaryProgressEvent
  | StatisticsProgressEvent
  | ToolUsageProgressEvent;
```

### イベントタイプ

各イベントタイプは`type`フィールドで判別され、それぞれ固有の`data`構造を持ちます：

#### 1. LogProgressEvent
シンプルなログメッセージイベント。

```typescript
interface LogProgressEvent {
  type: "log";
  message: string;
}
```

#### 2. ToolStartProgressEvent
ツール実行開始イベント。

```typescript
interface ToolStartProgressEvent {
  type: "tool:start";
  message: string;
  data: {
    toolId?: string;
    tool: string;
    input?: unknown;
    formattedInput?: string;
  };
}
```

#### 3. ToolEndProgressEvent
ツール実行完了イベント。

```typescript
interface ToolEndProgressEvent {
  type: "tool:end";
  message: string;
  data: {
    toolId?: string;
    tool: string;
    output?: unknown;
    error?: Error | string;
    duration?: number;
    success?: boolean;
  };
}
```

#### 4. ClaudeResponseProgressEvent
Claude APIからのレスポンスイベント。

```typescript
interface ClaudeResponseProgressEvent {
  type: "claude:response";
  message: string;
  data?: {
    text?: string;
    turnNumber?: number;
    maxTurns?: number;
  };
}
```

#### 5. ReasoningProgressEvent
Extended Thinking/Reasoningイベント（Codex SDK v0.52.0+対応）。

```typescript
interface ReasoningProgressEvent {
  type: "reasoning";
  message: string;
  data: {
    id?: string;
    text: string;
  };
}
```

#### 6. TodoUpdateProgressEvent
TODOリスト更新イベント。

```typescript
interface TodoUpdateProgressEvent {
  type: "todo_update";
  message: string;
  data: {
    todos: ProgressTodoItem[];
  };
}
```

#### 7-10. その他のイベント
- `GeneralProgressEvent`: 一般的な進捗メッセージ
- `SummaryProgressEvent`: サマリーメッセージ
- `StatisticsProgressEvent`: 統計情報
- `ToolUsageProgressEvent`: ツール使用情報（後方互換性のため）

### Type Guards

各イベントタイプに対応するType Guard関数を提供しています：

```typescript
if (isToolStartEvent(event)) {
  // TypeScriptがevent.data.toolが存在することを認識
  console.log(event.data.tool);
}
```

## 使用方法

### Type Narrowing

Switch文やif文で`type`フィールドをチェックすることで、TypeScriptが自動的に型を絞り込みます：

```typescript
function handleProgress(event: ProgressEvent) {
  switch (event.type) {
    case "tool:start":
      // ここではeventはToolStartProgressEvent型
      console.log(event.data.tool);
      break;
    case "log":
      // ここではeventはLogProgressEvent型
      console.log(event.message);
      break;
  }
}
```

### Progress Callback

Progress callbackの型は`ProgressEvent`を受け取るように統一されています：

```typescript
interface TaskRequest {
  instruction: string;
  options?: {
    onProgress?: (progress: ProgressEvent) => void | Promise<void>;
  };
}
```

## 実装されているファイル

### 型定義
- `backend/src/types/progress-events.ts`: メインの型定義

### 使用箇所
- `backend/src/services/progress-handler.ts`: Progress eventハンドラー
- `backend/src/claude/types.ts`: Claude実行タスクのリクエスト型
- `backend/src/claude/claude-code-client.ts`: Claude Code SDKクライアント
- `backend/src/claude/executor.ts`: タスクエグゼキューター
- `backend/src/queue/task-queue.ts`: タスクキュー
- `backend/src/agents/claude-agent-executor.ts`: Claude Agentエグゼキューター

## 後方互換性

既存のコードとの互換性を保つため、以下の対応を実施：

1. **Index Signature**: 柔軟な追加プロパティをサポート
   ```typescript
   data: {
     tool: string;
     [key: string]: unknown; // 追加プロパティを許可
   }
   ```

2. **Legacy Conversion**: レガシーイベントから型安全なイベントへの変換関数
   ```typescript
   export function convertLegacyProgressEvent(legacy: LegacyProgressEvent): ProgressEvent
   ```

3. **ProgressTodoItem**: 既存の`TodoItem`型との区別
   - `TodoItem`: 完全な定義（id, priorityあり）
   - `ProgressTodoItem`: Progress event用の簡易版

## テスト

全てのProgress eventの型安全性は以下のテストでカバーされています：

- `tests/unit/services/progress-handler.test.ts`: 21テスト
- `tests/unit/claude/claude-code-client.test.ts`: 13テスト
- その他関連ユニットテスト

## 今後の改善案

1. **WebSocket経由のProgress Event配信の強化**
   - 現在TODO状態の箇所（executor.tsから削除済み）を実装

2. **Progress Event統計の詳細化**
   - より詳細なツール使用統計
   - パフォーマンスメトリクスの追加

3. **エラーハンドリングの強化**
   - エラー型の詳細化
   - エラーリカバリーメカニズムの追加

## 参考資料

- TypeScript Handbook: [Discriminated Unions](https://www.typescriptlang.org/docs/handbook/typescript-in-5-minutes-func.html#discriminated-unions)
- [Type Guards and Differentiating Types](https://www.typescriptlang.org/docs/handbook/advanced-types.html#type-guards-and-differentiating-types)

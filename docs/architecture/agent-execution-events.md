# Agent Execution Event Type System

## 概要

Agent Execution Eventシステムは、Claude Agent SDKとCodex SDKの両方を統一的に扱うためのイベント型定義を提供します。このドキュメントでは、型安全なAgent Execution Eventシステムについて説明します。

## 背景

Agent Executorは、外部（WebSocket、APIエンドポイント等）に対してタスクの実行状態を通知するためのイベントシステムを持っています。以前は`any`型を使用していたため、型安全性が不十分でした。

## 設計

### Discriminated Union Types

TypeScriptのDiscriminated Unionを使用して、9種類のAgent Execution Eventを型安全に扱います。

```typescript
export type AgentExecutionEvent =
  | AgentStartEvent
  | AgentProgressEvent
  | AgentToolStartEvent
  | AgentToolEndEvent
  | AgentResponseEvent
  | AgentStatisticsEvent
  | AgentCompletedEvent
  | AgentFailedEvent
  | AgentReasoningEvent;
```

### イベントタイプ

#### 1. AgentStartEvent
エグゼキューター開始イベント。

```typescript
interface AgentStartEvent {
  type: "agent:start";
  executor: ExecutorType; // "claude" | "codex"
  timestamp: Date;
}
```

#### 2. AgentProgressEvent
進捗イベント。

```typescript
interface AgentProgressEvent {
  type: "agent:progress";
  message: string;
  data?: {
    currentTurn?: number;
    maxTurns?: number;
    [key: string]: unknown; // 追加プロパティを許可
  };
  timestamp: Date;
}
```

#### 3. AgentToolStartEvent
ツール実行開始イベント。

```typescript
interface AgentToolStartEvent {
  type: "agent:tool:start";
  tool: string;
  toolId?: string;
  input?: unknown; // 型安全性を保ちつつ柔軟性を維持
  timestamp: Date;
}
```

#### 4. AgentToolEndEvent
ツール実行完了イベント。

```typescript
interface AgentToolEndEvent {
  type: "agent:tool:end";
  tool: string;
  toolId?: string;
  output?: unknown; // 型安全性を保ちつつ柔軟性を維持
  error?: string;
  duration?: number;
  success: boolean;
  timestamp: Date;
}
```

#### 5. AgentResponseEvent
Agentレスポンスイベント。

```typescript
interface AgentResponseEvent {
  type: "agent:response";
  text: string;
  turnNumber?: number;
  timestamp: Date;
}
```

#### 6. AgentStatisticsEvent
統計情報イベント。

```typescript
interface AgentStatisticsEvent {
  type: "agent:statistics";
  totalTurns: number;
  totalToolCalls: number;
  toolStats: Record<string, ToolStatistics>;
  elapsedTime: number;
  tokenUsage?: TokenUsage;
  timestamp: Date;
}
```

#### 7. AgentCompletedEvent
完了イベント。

```typescript
interface AgentCompletedEvent {
  type: "agent:completed";
  output: unknown;
  sessionId?: string;
  conversationHistory?: unknown[]; // 型安全性を保ちつつ柔軟性を維持
  todos?: TodoItem[];
  duration: number;
  timestamp: Date;
}
```

#### 8. AgentFailedEvent
失敗イベント。

```typescript
interface AgentFailedEvent {
  type: "agent:failed";
  error: Error;
  timestamp: Date;
}
```

#### 9. AgentReasoningEvent
Reasoningイベント（Codex SDK v0.52.0+対応）。

```typescript
interface AgentReasoningEvent {
  type: "agent:reasoning";
  id: string;
  text: string;
  timestamp: Date;
}
```

### Type Guards

各イベントタイプに対応するType Guard関数を提供しています：

```typescript
if (isAgentToolStartEvent(event)) {
  // TypeScriptがevent.toolが存在することを認識
  console.log(event.tool);
  console.log(event.input); // unknown型として安全にアクセス
}
```

利用可能なType Guard関数：
- `isAgentStartEvent()`
- `isAgentProgressEvent()`
- `isAgentToolStartEvent()`
- `isAgentToolEndEvent()`
- `isAgentResponseEvent()`
- `isAgentStatisticsEvent()`
- `isAgentCompletedEvent()`
- `isAgentFailedEvent()`
- `isAgentReasoningEvent()`

## 使用方法

### Type Narrowing

Switch文やif文で`type`フィールドをチェックすることで、TypeScriptが自動的に型を絞り込みます：

```typescript
function handleAgentEvent(event: AgentExecutionEvent) {
  switch (event.type) {
    case "agent:tool:start":
      // ここではeventはAgentToolStartEvent型
      console.log(`Tool ${event.tool} started`);
      break;
    case "agent:completed":
      // ここではeventはAgentCompletedEvent型
      console.log(`Task completed in ${event.duration}ms`);
      break;
  }
}
```

### Type Guard関数の使用

```typescript
async function processAgentEvent(event: AgentExecutionEvent) {
  if (isAgentToolEndEvent(event)) {
    if (event.success) {
      console.log(`Tool ${event.tool} succeeded`);
      // event.outputはunknown型なので、必要に応じて型チェック
      if (typeof event.output === "string") {
        console.log("Output:", event.output);
      }
    }
  }
}
```

## 実装されているファイル

### 型定義
- `backend/src/agents/types.ts`: メインの型定義とType Guard関数

### 使用箇所
- `backend/src/agents/claude-agent-executor.ts`: Claude Agent Executor実装
- `backend/src/agents/codex-agent-executor.ts`: Codex Agent Executor実装
- `backend/src/agents/codex-task-executor-adapter.ts`: Codex Executor Adapter

## Progress Eventとの関係

このプロジェクトには2つの異なるイベント型システムがあります：

### 1. ProgressEvent (`types/progress-events.ts`)
- **用途**: 内部的な進捗処理
- **発生元**: Claude Code SDK
- **使用箇所**: Progress Handler、Task Queue内部

### 2. AgentExecutionEvent (`agents/types.ts`)
- **用途**: 外部公開イベント（API/WebSocket）
- **発生元**: Agent Executor
- **使用箇所**: WebSocket配信、API レスポンス

### 変換フロー

```
Claude Code SDK
  ↓ (ProgressEvent)
Progress Handler
  ↓
Task Queue
  ↓ (AgentExecutionEvent)
Agent Executor → convertProgressToEvent()
  ↓
WebSocket / API
```

`claude-agent-executor.ts`の`convertProgressToEvent()`メソッドで、`ProgressEvent`を`AgentExecutionEvent`に変換しています。

## 型安全性の改善ポイント

### Before
```typescript
interface AgentToolStartEvent {
  input?: any; // ❌ 型安全性なし
}

interface AgentToolEndEvent {
  output?: any; // ❌ 型安全性なし
}

interface AgentCompletedEvent {
  conversationHistory?: any[]; // ❌ 型安全性なし
}
```

### After
```typescript
interface AgentToolStartEvent {
  input?: unknown; // ✅ 型安全
}

interface AgentToolEndEvent {
  output?: unknown; // ✅ 型安全
}

interface AgentCompletedEvent {
  conversationHistory?: unknown[]; // ✅ 型安全
}
```

`unknown`型を使用することで：
- 型安全性を保ちつつ柔軟性を維持
- 使用時に明示的な型チェックが必要
- ランタイムエラーのリスクを低減

## テスト

全てのAgent Execution Eventの型安全性は以下のテストでカバーされています：

- `tests/unit/agents/claude-agent-executor.test.ts`: 11テスト
- `tests/unit/agents/codex-agent-executor.test.ts`: 16テスト
- `tests/unit/agents/agent-executor-factory.test.ts`: 7テスト

## 今後の改善案

1. **イベントのより詳細な型定義**
   - ツール別の入出力型定義
   - Executor別の固有イベント型

2. **イベントフィルタリング機能**
   - Type Guard関数を利用した高度なフィルタリング
   - WebSocket購読時のイベントタイプ選択

3. **イベント統計の強化**
   - イベント発生頻度の追跡
   - パフォーマンスメトリクスの詳細化

## 参考資料

- [Progress Event Type System](./progress-events.md): 関連する内部イベント型システム
- TypeScript Handbook: [Discriminated Unions](https://www.typescriptlang.org/docs/handbook/typescript-in-5-minutes-func.html#discriminated-unions)
- [Type Guards and Differentiating Types](https://www.typescriptlang.org/docs/handbook/advanced-types.html#type-guards-and-differentiating-types)

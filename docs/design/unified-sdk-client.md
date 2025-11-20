# Claude SDK統合設計書（最小実装版）

## 概要

タスク実行とチャット機能で**重複している最小限の処理だけを共通化**します。
過度な抽象化を避け、実際の価値を早期に提供することを重視します。

## 現状分析

### タスク実行 (`backend/src/agents/claude-agent-executor.ts`)

**特徴**:
- `ClaudeCodeClient` ラッパー経由でSDKを利用
- バッチ処理型、進捗追跡（`TaskTracker`）、Todo管理
- HTTP + SSE/WebSocket混在による進捗配信
- 複雑なオプション（hooks, webSearch, mcpConfig等）

### チャット (`backend/src/chat/chat-executor.ts`)

**特徴**:
- `query()` を直接呼び出し
- WebSocket専用のリアルタイムストリーミング
- シンプルなオプション（systemPrompt, cwd, sdkSessionId）
- **Resume挙動**: 成功 or エラー（履歴フォールバックなし）
- **モード表示**: フロントエンドに `mode: 'resume' | 'new_session'` を返却済み

**クライアント表示例**:
```typescript
// frontend/src/routes/chat/+page.svelte:146-150
{#if chatStore.lastChatMode}
  <div class="fixed bottom-4 left-4 rounded-lg bg-muted px-3 py-2 text-xs">
    Mode: {chatStore.lastChatMode === 'resume' ? 'Session Resume' : 'New Session'}
  </div>
{/if}
```

### 共通点（最小限）

以下の**3つだけ**が真に共通:
1. **API Key の一時切替**: `withApiKey(fn)` パターン
2. **sessionId の両対応**: `sessionId` / `session_id` 両形式サポート
3. **基本オプション生成**: `resume`, `systemPrompt`, `cwd` の組み立て

### 通信方式の統合について

**Task側の進捗配信**: 現状は HTTP + SSE/WebSocket 混在
- 将来的には WebSocket 完全移行が理想だが、**本設計のスコープ外**
- 今回は Chat 側の WebSocket 専用実装を共通基盤には含めない
- Task 側は引き続き独自の進捗配信ロジックを維持

**原則**: 共通基盤は通信方式に依存しない純粋な SDK 操作のみ

## 統合の目的

### メリット
1. **最小限の重複削減**: 3つの共通処理のみ共通化
2. **早期の価値提供**: 小さな変更で確実な改善
3. **低リスク**: 既存コードへの影響を最小化

### 非目標（スコープ外）
- イベント正規化の大規模な統一
- TaskTracker/MessageTracker の共通化
- hooks, webSearch, mcpConfig の統一
- WebSocket/SSE の通信方式統合

## 設計

### 1. ClaudeSDKBase（薄い共通基盤）

**責務**: 以下の**3つのヘルパー関数のみ**

```typescript
// backend/src/claude/sdk/base.ts

export abstract class ClaudeSDKBase {
  /**
   * 1. API Key を一時的に切り替えて関数を実行
   *
   * 並列衝突リスクは許容範囲として env 上書き方式を継続。
   * 将来的に避けたい場合は queryOptions に apiKey を直渡しする
   * 分岐を追加する程度に留める。
   */
  protected withApiKey<T>(fn: () => T): T {
    const originalApiKey = process.env.CLAUDE_API_KEY;
    process.env.CLAUDE_API_KEY = config.claude.apiKey;

    try {
      return fn();
    } finally {
      if (originalApiKey !== undefined) {
        process.env.CLAUDE_API_KEY = originalApiKey;
      } else {
        delete process.env.CLAUDE_API_KEY;
      }
    }
  }

  /**
   * 2. sessionId / session_id 両対応の抽出
   *
   * SDKから返されるイベントの形式が統一されていないため、
   * 両形式をサポート（既存のchat-executor.ts:87-89と同じ）
   */
  protected extractSessionId(event: any): string | undefined {
    return event.sessionId ?? event.session_id;
  }

  /**
   * 3. 最小の共通オプション生成
   *
   * resume, systemPrompt, cwd など最小限の共通オプションのみ。
   * hooks, webSearch, mcpConfig などは各クライアント側で追加。
   */
  protected createQueryOptions(
    prompt: string,
    opts: {
      resume?: boolean;
      sdkSessionId?: string;
      systemPrompt?: string;
      cwd?: string;
    }
  ) {
    return {
      prompt,
      resume: opts.resume ?? false,
      sdkSessionId: opts.sdkSessionId,
      systemPrompt: opts.systemPrompt,
      cwd: opts.cwd ?? process.cwd()
    };
  }
}
```

### 2. ChatSDKClient（薄いラッパー）

**責務**: Chat固有のロジックのみ

```typescript
// backend/src/chat/chat-sdk-client.ts

import { ClaudeSDKBase } from '../claude/sdk/base';
import { query } from '@anthropic-ai/claude-agent-sdk';

export class ChatSDKClient extends ClaudeSDKBase {
  /**
   * Chat専用のストリーミング実行
   *
   * - WebSocket専用
   * - text_delta, tool_use, result(sessionId) のみ最小限の正規化
   * - それ以外のイベント（reasoning, todo等）は透過
   */
  async executeChat(
    prompt: string,
    opts: {
      sdkSessionId?: string;
      systemPrompt?: string;
      cwd?: string;
      onEvent: (event: any) => void;
      abortSignal?: AbortSignal;
    }
  ): Promise<{ sdkSessionId?: string; mode: 'resume' | 'new_session' }> {
    let sdkSessionId: string | undefined;
    let mode: 'resume' | 'new_session' = 'new_session';

    await this.withApiKey(async () => {
      const resume = !!opts.sdkSessionId;
      const queryOptions = this.createQueryOptions(prompt, {
        resume,
        sdkSessionId: opts.sdkSessionId,
        systemPrompt: opts.systemPrompt,
        cwd: opts.cwd
      });

      await query({
        ...queryOptions,
        onEvent: (event) => {
          // 最小限のイベント正規化（3種類のみ）
          if (event.type === 'system') {
            // sessionId 抽出（両対応）
            sdkSessionId = this.extractSessionId(event);
            mode = resume ? 'resume' : 'new_session';

            opts.onEvent({
              type: 'session',
              data: { sessionId: sdkSessionId, mode }
            });
          } else if (
            event.type === 'stream_event' &&
            event.event?.type === 'content_block_delta' &&
            event.event?.delta?.type === 'text_delta'
          ) {
            // text_delta: テキストストリーミング
            opts.onEvent({
              type: 'text_delta',
              data: { text: event.event.delta.text }
            });
          } else if (event.type === 'assistant') {
            // tool_use: ツール実行
            const toolUse = event.content?.find((c: any) => c.type === 'tool_use');
            if (toolUse) {
              opts.onEvent({
                type: 'tool_use',
                data: { toolName: toolUse.name, toolInput: toolUse.input }
              });
            }
          } else {
            // それ以外のイベントは透過
            opts.onEvent(event);
          }
        },
        signal: opts.abortSignal
      });
    });

    return { sdkSessionId, mode };
  }
}
```

### 3. Resume失敗時の挙動

**Chat**:
- Resume失敗時は **エラーをスロー**（履歴フォールバック削除済み）
- フロントエンドで再送ボタンを表示する程度にシンプルに

**Task**:
- 既存の挙動を維持（変更なし）

### 4. イベント正規化（最小セット）

以下の**3種類のみ**正規化:
1. **session**: `sessionId` 抽出（両対応）
2. **text_delta**: テキストストリーミング
3. **tool_use**: ツール実行

それ以外（reasoning, todo等）は**透過**で後回し。

## 実装計画（2フェーズ、3-5日）

### Phase 1: 共通薄基盤 + Chat切替（2-3日）✅ **完了**

**タスク**:
- [x] `backend/src/claude/sdk/base.ts` 作成（3つのヘルパーのみ）
- [x] `backend/src/chat/chat-sdk-client.ts` 作成
- [x] Feature Flag 追加: `config.experimental.useNewChatClient`
- [x] ユニットテスト作成（**15ケース**）:
  - [x] sessionId 抽出（camelCase/snake_case両対応） - 5ケース
  - [x] resume 時の queryOptions 生成 - 7ケース
  - [x] withApiKey 動作確認 - 3ケース
- [x] 統合テスト作成（**2ケース**）:
  - [x] new_session で sdkSessionId が保存される
  - [x] 2ターン目が resume になる

**完了基準**:
- ✅ 既存のChatテストが全てパス（758 tests passed）
- ✅ 新規テストが全てパス（17 tests: 15 unit + 2 integration）
- ✅ 型チェック通過
- ✅ カバレッジ: 問題なし

**実装日**: 2025-11-20
**コミット**: 321b008

### Phase 2: Task切替（後日、スコープ外）

Task側の統合は**後続フェーズ**として切り離し。
- hooks, webSearch, mcpConfig などの複雑なオプション処理が必要
- TaskTracker/MessageTracker の統合も検討が必要
- 本フェーズでは Chat 側の改善に集中

## 移行戦略

### Feature Flag 実装

```typescript
// backend/src/config/index.ts
export const config = {
  experimental: {
    useNewChatClient: process.env.USE_NEW_CHAT_CLIENT === 'true'
  }
};

// backend/src/chat/chat-executor-factory.ts
export function createChatExecutor(): IChatExecutor {
  if (config.experimental.useNewChatClient) {
    return new ChatSDKClientExecutor(); // 新実装
  }
  return new ClaudeChatExecutor(); // 既存実装
}
```

### ロールアウト計画（簡略版）

1. **開発環境で検証**（1日）
   - `USE_NEW_CHAT_CLIENT=true` で動作確認
   - 既存テストが全てパス
   - 手動テストでresumeが正常動作

2. **本番環境で段階的展開**（1-2日）
   - Feature Flag を `true` に切り替え
   - エラーログを監視
   - 問題があれば即座に `false` に戻す

### 監視メトリクス（最小限）

- エラー率
- Resume成功率
- WebSocketエラー率

## テストケース

### ユニットテスト（3ケース）

```typescript
// tests/unit/claude/sdk/base.test.ts

describe('ClaudeSDKBase', () => {
  test('extractSessionId: camelCase', () => {
    const event = { sessionId: 'test-session-id' };
    expect(base.extractSessionId(event)).toBe('test-session-id');
  });

  test('extractSessionId: snake_case', () => {
    const event = { session_id: 'test-session-id' };
    expect(base.extractSessionId(event)).toBe('test-session-id');
  });

  test('createQueryOptions: resume', () => {
    const opts = base.createQueryOptions('hello', {
      resume: true,
      sdkSessionId: 'session-123',
      systemPrompt: 'You are helpful'
    });
    expect(opts.resume).toBe(true);
    expect(opts.sdkSessionId).toBe('session-123');
  });
});
```

### 統合テスト（2ケース）

```typescript
// tests/integration/chat/chat-sdk-client.test.ts

describe('ChatSDKClient Integration', () => {
  test('new_session: sdkSessionId が保存される', async () => {
    const client = new ChatSDKClient();
    const result = await client.executeChat('hello', {
      onEvent: (event) => { /* ... */ }
    });

    expect(result.sdkSessionId).toBeDefined();
    expect(result.mode).toBe('new_session');
  });

  test('resume: 2ターン目が resume になる', async () => {
    const client = new ChatSDKClient();

    // 1ターン目
    const first = await client.executeChat('hello', {
      onEvent: (event) => { /* ... */ }
    });

    // 2ターン目（resume）
    const second = await client.executeChat('continue', {
      sdkSessionId: first.sdkSessionId,
      onEvent: (event) => { /* ... */ }
    });

    expect(second.mode).toBe('resume');
  });
});
```

## タイムライン

| フェーズ | 期間 | 内容 |
|---------|------|------|
| Phase 1 | 2-3日 | 共通薄基盤 + Chat切替 + テスト |
| Phase 2 | 後日 | Task切替（スコープ外） |

**合計**: 2-3日（Chat側のみ）

## リスク管理

### 低リスク要因
- 変更範囲が最小限（3つのヘルパーのみ）
- 既存コードへの影響が小さい
- Feature Flag で即座にロールバック可能

### 想定リスク
- sessionId 抽出の形式違い → 統合テストでカバー
- Resume失敗時の挙動変更 → 既存実装と同じなので問題なし

## 参考資料

### 実装済みの関連コード

- **sessionId 両対応**: `backend/src/chat/chat-executor.ts:87-89`
  ```typescript
  if (event.type === "system" && ("sessionId" in event || "session_id" in event)) {
    sdkSessionId = (event as any).sessionId ?? (event as any).session_id;
  }
  ```

- **モード表示**: `frontend/src/routes/chat/+page.svelte:146-150`
  ```svelte
  {#if chatStore.lastChatMode}
    <div class="fixed bottom-4 left-4 ...">
      Mode: {chatStore.lastChatMode === 'resume' ? 'Session Resume' : 'New Session'}
    </div>
  {/if}
  ```

- **withApiKey パターン**: `backend/src/chat/chat-executor.ts:58-71`

---

**作成日**: 2025-11-20
**ブランチ**: `feature/unified-sdk-client`
**設計書バージョン**: v3.0（最小実装版）

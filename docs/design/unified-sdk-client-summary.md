# Claude SDK統合設計書 - 要約（最小実装版）

## 📋 設計書の概要

タスク実行とチャット機能で**重複している最小限の処理だけを共通化**する設計書です。
過度な抽象化を避け、実際の価値を早期に提供することを重視します。

**設計書本体**: `docs/design/unified-sdk-client.md` (415行)

## 🎯 設計の目的

### やること
- **3つのヘルパー関数のみ共通化**: API Key切替、sessionId両対応、基本オプション生成
- **Chat側のみ新実装に切替**: 2-3日で完了
- **低リスク・早期価値提供**: 小さな変更で確実な改善

### やらないこと（スコープ外）
- イベント正規化の大規模な統一
- TaskTracker/MessageTracker の共通化
- hooks, webSearch, mcpConfig の統一
- WebSocket/SSE の通信方式統合
- Task側の統合（後続フェーズ）

## 🏗️ アーキテクチャ（薄い2層構造）

```
┌─────────────────────────────────────────────┐
│         Frontend (WebSocket/HTTP)          │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│          ChatSDKClient (薄いラッパー)        │ ← Chat固有ロジック
│  - WebSocket統合                            │
│  - 最小限のイベント正規化（3種類のみ）      │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│        ClaudeSDKBase (薄い共通基盤)         │ ← 3つのヘルパーのみ
│  1. withApiKey(fn): API Key一時切替         │
│  2. extractSessionId(event): 両対応         │
│  3. createQueryOptions(): 基本オプション生成 │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│  @anthropic-ai/claude-agent-sdk (SDK)      │
└─────────────────────────────────────────────┘
```

## 🔑 重要な設計決定

### 1. 共通基盤は最小限（3つのヘルパーのみ）

```typescript
export abstract class ClaudeSDKBase {
  // 1. API Key 一時切替
  protected withApiKey<T>(fn: () => T): T { /* ... */ }

  // 2. sessionId 両対応（camelCase/snake_case）
  protected extractSessionId(event: any): string | undefined {
    return event.sessionId ?? event.session_id;
  }

  // 3. 基本オプション生成（resume, systemPrompt, cwd のみ）
  protected createQueryOptions(prompt: string, opts: { /* ... */ }) { /* ... */ }
}
```

### 2. イベント正規化は最小セット（3種類のみ）

正規化するのは以下の3種類だけ:
1. **session**: sessionId 抽出（両対応）
2. **text_delta**: テキストストリーミング
3. **tool_use**: ツール実行

それ以外（reasoning, todo等）は**透過**で後回し。

### 3. 通信方式の統合はスコープ外

- **Task側の進捗配信**: HTTP + SSE/WebSocket 混在 → **そのまま維持**
- WebSocket 完全移行は将来的な理想だが、今回は対象外
- **原則**: 共通基盤は通信方式に依存しない純粋な SDK 操作のみ

### 4. Chat側のモード表示（実装済み）

```svelte
<!-- frontend/src/routes/chat/+page.svelte:146-150 -->
{#if chatStore.lastChatMode}
  <div class="fixed bottom-4 left-4 rounded-lg bg-muted px-3 py-2 text-xs">
    Mode: {chatStore.lastChatMode === 'resume' ? 'Session Resume' : 'New Session'}
  </div>
{/if}
```

## 🚀 実装計画（2フェーズ、2-3日）

### Phase 1: 共通薄基盤 + Chat切替（2-3日）

**タスク**:
- [ ] `ClaudeSDKBase` 作成（3つのヘルパーのみ）
- [ ] `ChatSDKClient` 作成（薄いラッパー）
- [ ] Feature Flag 追加: `USE_NEW_CHAT_CLIENT`
- [ ] ユニットテスト（**3ケースのみ**）
- [ ] 統合テスト（**2ケースのみ**）

**完了基準**:
- 既存のChatテストが全てパス
- 新規テストが全てパス（カバレッジ >80% でOK）

### Phase 2: Task切替（後日、スコープ外）

Task側の統合は後続フェーズとして切り離し。

## 🎚️ 移行戦略（簡略版）

### Feature Flag

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

### ロールアウト

1. **開発環境で検証**（1日）
   - `USE_NEW_CHAT_CLIENT=true` で動作確認
   - 既存テスト全てパス

2. **本番環境で展開**（1-2日）
   - Feature Flag を `true` に切り替え
   - エラーログ監視
   - 問題あれば即座に `false` に戻す

## 📝 テストケース

### ユニットテスト（3ケース）

1. `extractSessionId: camelCase` - `sessionId` の抽出
2. `extractSessionId: snake_case` - `session_id` の抽出
3. `createQueryOptions: resume` - resume オプションの生成

### 統合テスト（2ケース）

1. `new_session: sdkSessionId が保存される`
2. `resume: 2ターン目が resume になる`

## 📊 監視メトリクス（最小限）

- エラー率
- Resume成功率
- WebSocketエラー率

## ✅ レビューポイント

1. ✅ **最小限の共通化**: 3つのヘルパーのみで十分か？
2. ✅ **イベント正規化**: 3種類（session, text_delta, tool_use）で十分か？
3. ✅ **通信方式**: Task側のHTTP+SSE/WebSocket混在をそのまま維持でOK？
4. ✅ **タイムライン**: 2-3日の見積もりは妥当か？
5. ✅ **スコープ**: Task側を後回しでOK？

## 🔍 次のステップ

設計レビュー承認後:

1. **Phase 1開始**: `backend/src/claude/sdk/base.ts` 作成（3つのヘルパーのみ）
2. **並行作業**:
   - `ChatSDKClient` 実装
   - テストコード作成（3+2ケース）
   - Feature Flag 追加

## 📚 参考資料

### 実装済みの関連コード

- **sessionId 両対応**: `backend/src/chat/chat-executor.ts:87-89`
- **モード表示**: `frontend/src/routes/chat/+page.svelte:146-150`
- **withApiKey パターン**: `backend/src/chat/chat-executor.ts:58-71`

---

**作成日**: 2025-11-20
**ブランチ**: `feature/unified-sdk-client`
**設計書バージョン**: v3.0（最小実装版）

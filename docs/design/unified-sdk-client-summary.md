# Claude SDK統合設計書 - 要約

## 📋 設計書の概要

このドキュメントは、タスク実行とチャット機能で分散しているClaude Code SDKの利用を統合するための設計書です。

**設計書本体**: `docs/design/unified-sdk-client.md` (1050行)

## 🎯 設計の目的

1. **コードの重複削減**: タスク/チャットで類似した処理を共通化
2. **保守性向上**: SDK呼び出しロジックを一元管理
3. **機能の再利用**: 各実装の強みを相互に活用可能に
4. **一貫性の確保**: セッション管理、エラーハンドリングの統一

## 🏗️ アーキテクチャ（3層構造）

```
┌─────────────────────────────────────────────┐
│         Frontend (WebSocket/HTTP)          │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│  TaskSDKClient  │  ChatSDKClient           │ ← 固有機能層
│  - TaskTracker  │  - WebSocket統合         │
│  - TodoManager  │  - ストリーミング最適化    │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│          ClaudeSDKBase (共通基盤)           │ ← 共通基盤層
│  - SDK query()呼び出し                      │
│  - セッション管理 (sessionId/session_id)   │
│  - イベント正規化 (NormalizedSDKEvent)     │
│  - API Key管理 (withApiKey)                │
│  - エラーハンドリング                       │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│  @anthropic-ai/claude-agent-sdk (SDK)      │ ← SDK層
└─────────────────────────────────────────────┘
```

## 🔑 重要な設計決定

### 1. イベント正規化

SDK生イベントを統一フォーマットに変換:

```typescript
interface NormalizedSDKEvent {
  type: 'session' | 'text_delta' | 'tool_use' | 'result' | 'error';
  timestamp: string;
  data: {
    sessionId?: string;
    text?: string;
    toolName?: string;
    toolInput?: any;
    error?: string;
  };
}
```

### 2. sessionId 両対応

camelCase (`sessionId`) と snake_case (`session_id`) の両方をサポート:

```typescript
protected extractSessionId(event: any): string | undefined {
  return event.sessionId ?? event.session_id;
}
```

### 3. API Key管理の統一

`withApiKey()` メソッドで環境変数を一時的に設定:

```typescript
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
```

**採用理由**: スレッドセーフ、テスト容易、柔軟性

### 4. Resume動作の明確化

**重要**: resume失敗時は**エラーをスロー**（履歴フォールバックなし）

- タスク: 既存の動作を維持
- チャット: 既に実装済み（`chat-executor.ts:129-130`）

## 📊 パフォーマンス目標

| 指標 | 目標値 | 測定方法 |
|------|--------|---------|
| チャット初回応答遅延 | <800ms | first_text イベントまでの時間 |
| Resume成功率 | >99% | 100回実行の成功率 |
| メモリオーバーヘッド | ±10% | 既存実装との比較 |

## 🚀 実装計画（4フェーズ、10-16日）

### Phase 1: 共通基盤の作成（2-3日）
- `ClaudeSDKBase` クラス実装
- イベント正規化の実装
- sessionId/session_id 両対応
- API Key管理の統一
- ユニットテスト（カバレッジ >90%）

### Phase 2: チャット移行（3-5日）
- `ChatSDKClient` 実装
- 既存実装との並行運用（Feature Flag）
- パフォーマンステスト
- 段階的ロールアウト（10% → 50% → 100%）

### Phase 3: タスク移行（4-6日）
- `TaskSDKClient` 実装
- 既存実装との並行運用（Feature Flag）
- パフォーマンステスト
- 段階的ロールアウト（10% → 50% → 100%）

### Phase 4: クリーンアップ（1-2日）
- 旧実装削除
- ドキュメント更新
- 最終テスト

**追加考慮事項**:
- E2Eテスト: Phase 2/3 各 +1日
- 回帰テスト: Phase 2/3 各 +0.5日

## 🎚️ 移行戦略

### Feature Flag実装

```typescript
export const config = {
  experimental: {
    useNewChatClient: process.env.USE_NEW_CHAT_CLIENT === 'true'
  }
};

export function createChatExecutor(executorType: string): IChatExecutor {
  if (config.experimental.useNewChatClient) {
    return new ChatSDKClientExecutor(); // 新実装
  }
  return new ClaudeChatExecutor(); // 既存実装
}
```

### ロールアウト計画

1. **10%ロールアウト** (1-2日)
   - 新規ユーザーの10%に新実装を適用
   - エラー率、レイテンシを監視

2. **50%ロールアウト** (1-2日)
   - 問題なければ50%に拡大
   - 継続監視

3. **100%ロールアウト** (1日)
   - 全ユーザーに展開
   - 旧実装削除準備

### ロールバック手順

問題発生時:
1. Feature Flag を即座に `false` に切り替え
2. エラーログとメトリクスを収集
3. 原因分析と修正
4. 再度段階的ロールアウト

### 監視メトリクス

- エラー率（target: <0.1%）
- レイテンシ（P50/P95/P99）
- Resume成功率（target: >99%）
- WebSocketエラー率

## 📝 レビューポイント

### 設計書確認事項

1. ✅ **アーキテクチャ**: 3層構造は明確か？
2. ✅ **イベント正規化**: NormalizedSDKEvent仕様は完全か？
3. ✅ **sessionId対応**: 両形式のサポート方法は適切か？
4. ✅ **API Key管理**: withApiKey方式の採用は妥当か？
5. ✅ **Resume動作**: エラースロー方式は適切か？
6. ✅ **パフォーマンス**: 目標値と測定方法は明確か？
7. ✅ **移行戦略**: Feature Flagとロールアウト計画は現実的か？
8. ✅ **タイムライン**: 10-16日の見積もりは妥当か？

## 🔍 次のステップ

設計レビュー承認後:

1. **Phase 1開始**: `backend/src/claude/sdk/base.ts` 作成
2. **並行作業可能**:
   - イベント正規化実装
   - テストコード作成
   - 型定義整備

## 📚 参考資料

- **設計書本体**: `docs/design/unified-sdk-client.md`
- **現在のチャット実装**: `backend/src/chat/chat-executor.ts`
- **現在のタスク実装**: `backend/src/agents/claude-agent-executor.ts`
- **Claude Code Client**: `backend/src/claude/claude-code-client.ts`

---

**作成日**: 2025-11-20
**ブランチ**: `feature/unified-sdk-client`
**設計書バージョン**: v2.0（第2回レビューフィードバック反映済み）

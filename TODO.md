# CC-Anywhere TODO List

## Claude Code SDK オプションパラメータ対応

Claude Code SDKの実行時に指定可能なオプションパラメータへの対応を、優先度順に整理します。

あと、そろそろUIの見直し（スマフォ版含む）も必要。

### 優先度: 高 🔴

#### 1. `maxTurns` - 会話ターン数の制限
- **現状**: ハードコード（3ターン）で部分対応済み
- **必要な対応**: APIリクエストで動的に指定可能にする
- **理由**: タスクの複雑さに応じてターン数を調整する必要がある

#### 2. `allowedTools` / `disallowedTools` - ツール使用の制限
- **現状**: 未対応（すべてのツールが利用可能）
- **必要な対応**: 許可/禁止するツールのリストを指定可能にする
- **理由**: セキュリティと実行環境の制御のため重要
- **例**: 本番環境では`Bash`を禁止、読み取り専用操作のみ許可など

#### 3. `systemPrompt` - カスタムシステムプロンプト
- **現状**: 未対応
- **必要な対応**: タスクごとにシステムプロンプトを指定可能にする
- **理由**: 特定のコーディング規約や言語設定などをタスク単位で制御

#### 4. `permissionMode` - 編集権限の制御
- **現状**: 未対応
- **必要な対応**: ファイル編集権限のモード設定（ask/allow/deny）
- **理由**: 自動実行時の安全性確保のため

### 優先度: 中 🟡

#### 5. `executable` / `executableArgs` - 実行環境の指定
- **現状**: 未対応（デフォルトのNode.js使用）
- **必要な対応**: node/bun/denoなどのランタイム選択
- **理由**: プロジェクトに応じた実行環境の最適化

#### 6. `mcpConfig` - Model Context Protocol設定
- **現状**: 未対応
- **必要な対応**: MCPサーバーの設定を受け取り、SDKに渡す
- **理由**: 外部ツールやサービスとの統合拡張

#### 7. `continueSession` / `resumeSession` - セッション継続機能
- **現状**: 未対応（毎回新規セッション）
- **必要な対応**: 前回の会話を継続する機能
- **理由**: 長時間タスクの中断・再開サポート

#### 8. 出力形式オプション
- **現状**: テキスト形式のみ
- **必要な対応**: `json`、`stream-json`形式のサポート
- **理由**: プログラマティックな結果処理の改善

### 優先度: 低 🟢

#### 9. `permissionPromptTool` - カスタム権限確認ツール
- **現状**: 未対応
- **必要な対応**: カスタム権限確認ロジックの実装
- **理由**: 高度なセキュリティ要件への対応

#### 10. `verbose` - 詳細ログ出力
- **現状**: 部分的に対応（内部ログあり）
- **必要な対応**: APIレベルでのverboseモード切り替え
- **理由**: デバッグとトラブルシューティングの改善

#### 11. ストリーミング入力サポート
- **現状**: 未対応
- **必要な対応**: 大規模な入力データのストリーミング処理
- **理由**: メモリ効率の改善

#### 12. `pathToClaudeCodeExecutable` - カスタム実行パス
- **現状**: 未対応
- **必要な対応**: Claude Code実行ファイルのパス指定
- **理由**: 特殊な環境での実行サポート

## 実装推奨事項

### APIリクエスト形式の拡張案

```typescript
interface TaskRequest {
  instruction: string;
  context?: TaskContext;
  options?: {
    // 既存のオプション
    timeout?: number;
    useWorktree?: boolean;
    worktree?: WorktreeOptions;
    
    // 新規追加するSDKオプション
    sdk?: {
      maxTurns?: number;              // 優先度: 高
      allowedTools?: string[];         // 優先度: 高
      disallowedTools?: string[];      // 優先度: 高
      systemPrompt?: string;           // 優先度: 高
      permissionMode?: 'ask' | 'allow' | 'deny'; // 優先度: 高
      executable?: string;             // 優先度: 中
      executableArgs?: string[];       // 優先度: 中
      mcpConfig?: Record<string, any>; // 優先度: 中
      continueSession?: string;        // 優先度: 中
      outputFormat?: 'text' | 'json' | 'stream-json'; // 優先度: 中
      verbose?: boolean;               // 優先度: 低
    };
  };
}
```

### 環境変数での既定値設定

```env
# Claude Code SDK既定値
DEFAULT_MAX_TURNS=3
DEFAULT_ALLOWED_TOOLS=all
DEFAULT_PERMISSION_MODE=ask
DEFAULT_EXECUTABLE=node
DEFAULT_OUTPUT_FORMAT=text
```

## 注意事項

1. **後方互換性**: 既存のAPIとの互換性を保ちながら拡張する
2. **セキュリティ**: 特に`allowedTools`と`permissionMode`は慎重に実装
3. **バリデーション**: 無効なオプションの組み合わせをチェック
4. **ドキュメント**: 各オプションの詳細な説明と使用例を提供
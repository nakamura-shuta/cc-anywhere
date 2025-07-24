# Claude Code SDK v1.0.59 新機能ガイド

## 概要

Claude Code SDK v1.0.59で追加された3つの重要な機能について説明します。

## 1. canUseTool コールバック

### 概要
ツール実行前に許可を求めることができる機能です。セキュリティとユーザー制御を強化します。

### 実装要件
- プロンプトは`AsyncIterable<SDKUserMessage>`形式である必要があります（文字列不可）
- `permissionPromptToolName`と同時使用不可

### 使用例
```typescript
const canUseTool = async (toolName: string, toolInput: any): Promise<boolean> => {
  // 危険なコマンドをブロック
  if (toolName === "Bash" && toolInput.command?.includes("rm -rf /")) {
    return false;
  }
  
  // ユーザー確認が必要な操作
  if (["Write", "Edit", "Delete"].includes(toolName)) {
    return await requestUserConfirmation(toolName, toolInput);
  }
  
  return true;
};
```

### cc-anywhereでの活用案

1. **セキュリティ強化**
   - 危険なコマンドの自動ブロック
   - ファイルシステムへの書き込み制限
   - ネットワークアクセスの制御

2. **ユーザー権限管理**
   - 権限レベルに応じたツール制限
   - 読み取り専用モードの実装
   - 管理者承認が必要な操作の定義

3. **監査ログ**
   - ツール使用履歴の記録
   - ブロックされた操作の追跡
   - コンプライアンス対応

## 2. 環境変数の指定（env）

### 概要
Claude Codeプロセスに環境変数を渡すことができます。

### 使用例
```typescript
const options = {
  env: {
    NODE_ENV: "development",
    PROJECT_ROOT: "/path/to/project",
    CUSTOM_API_KEY: "your-api-key",
    DEBUG: "true"
  }
};
```

### cc-anywhereでの活用案

1. **プロジェクト固有の設定**
   - APIキーやトークンの安全な受け渡し
   - プロジェクトパスの設定
   - デバッグモードの切り替え

2. **実行環境の分離**
   - 開発/本番環境の区別
   - テスト環境での特別な設定
   - サンドボックス環境の構築

## 3. エラーログのキャプチャ（stderr）

### 概要
Claude Codeプロセスの標準エラー出力をキャプチャできます。

### 使用例
```typescript
const options = {
  stderr: (data: string) => {
    console.error("Claude Code stderr:", data);
    // エラーログの記録
    logger.error("Claude Code error output", { stderr: data });
    // ユーザーへの通知
    websocket.send({
      type: "error",
      message: data
    });
  }
};
```

### cc-anywhereでの活用案

1. **デバッグの改善**
   - 詳細なエラー情報の収集
   - 問題の早期発見
   - エラーパターンの分析

2. **エラー通知**
   - リアルタイムエラー通知
   - エラーレポートの自動生成
   - 開発者へのアラート

3. **エラー追跡**
   - エラーの分類と集計
   - 頻発するエラーの特定
   - 改善ポイントの発見

## 実装上の注意点

1. **canUseTool使用時の制約**
   - プロンプトは必ずストリーム形式にする
   - 非同期処理に対応する
   - エラーハンドリングを適切に行う

2. **環境変数の安全性**
   - 機密情報は適切に暗号化
   - 環境変数の検証を行う
   - 不要な環境変数は渡さない

3. **エラーログの取り扱い**
   - 機密情報が含まれる可能性を考慮
   - ログのサイズ制限を設ける
   - 適切なログレベルの設定

## まとめ

これらの新機能により、cc-anywhereプロジェクトは以下の改善が可能です：

1. **セキュリティ**: canUseToolによる細かな制御
2. **柔軟性**: 環境変数による設定の外部化
3. **可観測性**: stderrキャプチャによるデバッグ性向上

既存のコードベースへの統合は段階的に行い、十分なテストを実施することを推奨します。
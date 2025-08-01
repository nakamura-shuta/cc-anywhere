# Claude Code SDK 主要機能

## canUseTool コールバック

ツール実行前に許可を求める機能。セキュリティ制御に使用。

```typescript
const canUseTool = async (toolName: string, toolInput: any): Promise<boolean> => {
  // 危険なコマンドをブロック
  if (toolName === "Bash" && toolInput.command?.includes("rm -rf /")) {
    return false;
  }
  return true;
};
```

**注意**: プロンプトは`AsyncIterable<SDKUserMessage>`形式が必要

## 環境変数の指定（env）

Claude Codeプロセスに環境変数を渡す。

```typescript
const options = {
  env: {
    NODE_ENV: "development",
    PROJECT_ROOT: "/path/to/project"
  }
};
```

## エラーログのキャプチャ（stderr）

標準エラー出力をキャプチャ。

```typescript
const options = {
  stderr: (data: string) => {
    logger.error("Claude Code error output", { stderr: data });
  }
};
```
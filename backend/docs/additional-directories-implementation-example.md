# additionalDirectories 実装例

## 概要
Claude Code SDK 1.0.82で追加された`additionalDirectories`機能の実装例です。

## 実装手順

### 1. 型定義の更新

```typescript
// backend/src/claude/types.ts
export interface SDKOptions {
  // 既存のオプション
  maxTurns?: number;
  allowedTools?: string[];
  disallowedTools?: string[];
  systemPrompt?: string;
  permissionMode?: SDKPermissionMode;
  
  // 新規追加
  additionalDirectories?: string[];  // 追加で検索対象にするディレクトリ
  
  // ... その他のオプション
}
```

### 2. バックエンドの更新

```typescript
// backend/src/claude/claude-code-client.ts
export interface ClaudeCodeOptions {
  // ... 既存のオプション
  additionalDirectories?: string[];  // 追加
}

// backend/src/claude/executor.ts の executeTask メソッド内
const sdkResult = await this.codeClient.executeTask(prompt, {
  maxTurns: sdkOptions.maxTurns,
  cwd: resolvedWorkingDirectory,
  additionalDirectories: sdkOptions.additionalDirectories,  // 追加
  abortController,
  // ... その他のオプション
});
```

### 3. APIスキーマの更新

```yaml
# backend/openapi.yaml
CreateTaskRequest:
  type: object
  properties:
    # ... 既存のプロパティ
    options:
      type: object
      properties:
        sdk:
          type: object
          properties:
            # ... 既存のSDKオプション
            additionalDirectories:
              type: array
              items:
                type: string
              description: "追加で検索対象にするディレクトリのパス"
              maxItems: 10  # 安全のため上限を設定
```

### 4. フロントエンドUI

```svelte
<!-- frontend/src/routes/tasks/new/+page.svelte -->
<script lang="ts">
  // 追加ディレクトリの状態管理
  let additionalDirectories = $state<string[]>([]);
  
  function addDirectory(path: string) {
    if (!additionalDirectories.includes(path)) {
      additionalDirectories = [...additionalDirectories, path];
    }
  }
  
  function removeDirectory(path: string) {
    additionalDirectories = additionalDirectories.filter(d => d !== path);
  }
</script>

<!-- UIコンポーネント -->
<div class="space-y-2">
  <Label>追加ディレクトリ（オプション）</Label>
  <div class="text-sm text-muted-foreground mb-2">
    メインの作業ディレクトリ以外に参照したいディレクトリを追加できます
  </div>
  
  <!-- ディレクトリ追加ボタン -->
  <DirectorySelector 
    bind:selectedDirectories={additionalDirectories}
    multiple={true}
    label="追加ディレクトリを選択"
  />
  
  <!-- 選択済みディレクトリの表示 -->
  {#if additionalDirectories.length > 0}
    <div class="mt-2 space-y-1">
      {#each additionalDirectories as dir}
        <div class="flex items-center justify-between p-2 bg-muted rounded">
          <span class="text-sm font-mono">{dir}</span>
          <Button 
            variant="ghost" 
            size="sm"
            onclick={() => removeDirectory(dir)}
          >
            <X class="h-4 w-4" />
          </Button>
        </div>
      {/each}
    </div>
  {/if}
</div>

<!-- タスク作成時のリクエスト -->
<script>
  async function handleSubmit(event: Event) {
    // ... 既存のコード
    
    const request: TaskRequest = {
      instruction: instruction.trim(),
      context: {
        workingDirectory: selectedDirectories[0],
        files: []
      },
      options: {
        sdk: {
          // ... 既存のSDKオプション
          additionalDirectories: additionalDirectories.length > 0 
            ? additionalDirectories 
            : undefined
        }
      }
    };
    
    // ... タスク作成処理
  }
</script>
```

## 使用例

### ユースケース1: モノレポ構成
```json
{
  "workingDirectory": "/path/to/monorepo/packages/app",
  "additionalDirectories": [
    "/path/to/monorepo/packages/shared",
    "/path/to/monorepo/packages/ui-components"
  ]
}
```

### ユースケース2: 設定ファイル参照
```json
{
  "workingDirectory": "/path/to/project",
  "additionalDirectories": [
    "/home/user/.config/myapp",
    "/etc/myapp"
  ]
}
```

### ユースケース3: 依存プロジェクト参照
```json
{
  "workingDirectory": "/path/to/frontend",
  "additionalDirectories": [
    "/path/to/backend",
    "/path/to/shared-types"
  ]
}
```

## セキュリティ考慮事項

1. **パス検証**: 
   - 絶対パスのみ許可
   - 親ディレクトリへの参照（..）を禁止
   - システムディレクトリへのアクセス制限

2. **数量制限**:
   - 最大10ディレクトリまで
   - 各パスの文字数制限（1024文字）

3. **権限チェック**:
   - 読み取り権限の確認
   - シンボリックリンクの適切な処理

## テスト項目

1. **基本機能**:
   - 単一の追加ディレクトリ
   - 複数の追加ディレクトリ
   - 存在しないディレクトリの処理

2. **エッジケース**:
   - 重複するディレクトリ
   - ネストされたディレクトリ
   - シンボリックリンク

3. **パフォーマンス**:
   - 大量ファイルを含むディレクトリ
   - ネットワークドライブ

## まとめ
`additionalDirectories`機能の実装により、より柔軟なプロジェクト構成に対応でき、ユーザー体験が大幅に向上します。特にモノレポやマルチプロジェクト環境での作業効率が改善されます。
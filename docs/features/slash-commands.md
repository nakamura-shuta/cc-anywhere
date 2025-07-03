# スラッシュコマンド

CC-Anywhereは、Claude Codeと互換性のあるカスタムスラッシュコマンドをサポートしています。

## 概要

スラッシュコマンドを使用すると、定義済みのテンプレートを使って複雑なタスクを簡単に実行できます。プロジェクト固有のコマンドとユーザー固有のコマンドの両方をサポートしています。

## コマンドの種類

### プロジェクトコマンド (`/project:`)
プロジェクトのリポジトリ内の `.claude/commands/` ディレクトリからコマンドを実行します。

### ユーザーコマンド (`/user:`)
ユーザーのホームディレクトリの `~/.claude/commands/` からコマンドを実行します。

## 使用方法

### Web UI での使用

タスク作成フォームの「実行内容」フィールドに以下のように入力します：

```
/project:analyze src
```

### API での使用

```bash
curl -X POST http://localhost:5000/api/tasks \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "instruction": "/project:test ほげほげ",
    "context": {
      "workingDirectory": "/path/to/project"
    }
  }'
```

## コマンドの作成

### ファイル構造

コマンドはMarkdownファイルとして定義され、YAMLフロントマターでメタデータを指定します。

例: `.claude/commands/analyze.md`

```markdown
---
description: Analyze code quality and security
parameters:
  - name: target
    type: string
    required: true
    description: Target directory or file
  - name: depth
    type: number
    required: false
    default: 2
    description: Analysis depth level
---
# Code Analysis Task

Analyze the code in {{target}} with the following criteria:
- Code quality assessment
- Security vulnerabilities
- Performance considerations

{{#if depth >= 2}}
## Deep Analysis
- Include detailed analysis of dependencies
- Check for code patterns and anti-patterns
{{/if}}

Arguments: $ARGUMENTS
```

### フロントマター

| フィールド | 説明 | 必須 |
|----------|------|------|
| description | コマンドの簡潔な説明 | Yes |
| parameters | パラメータ定義の配列 | No |

### パラメータ定義

各パラメータには以下の属性を指定できます：

| 属性 | 説明 | 必須 |
|-----|------|------|
| name | パラメータ名（小文字） | Yes |
| type | データ型（string, number, boolean） | Yes |
| required | 必須パラメータかどうか | Yes |
| default | デフォルト値 | No |
| description | パラメータの説明 | No |

## テンプレート構文

CC-Anywhereは2つのテンプレート構文をサポートしています：

### 1. Claude Code互換構文（環境変数スタイル）

[Claude公式ドキュメント](https://docs.anthropic.com/en/docs/claude-code/slash-commands)に準拠した構文です。

- `$ARGUMENTS` - すべての引数を表示
- `$VARIABLE_NAME` - 大文字の変数名（パラメータは小文字で定義）

例：
```
Target: $TARGET
Mode: $MODE
All arguments: $ARGUMENTS
```

### 2. Handlebars風構文

より高度な制御フローのための構文です。

#### 変数展開
```
{{variable}}
{{args.length}}
{{parameters.target}}
```

#### 条件分岐
```
{{#if condition}}
  条件が真の場合の内容
{{/if}}
```

#### ループ処理
```
{{#each items}}
  {{this}} - {{index}}
{{/each}}
```

#### 比較演算
```
{{#if eq type "file"}}
  ファイルの処理
{{/if}}

{{#if depth >= 2}}
  深い解析を実行
{{/if}}

{{#if includes allowedTypes "javascript"}}
  JavaScriptファイルを処理
{{/if}}
```

## 実例

### 基本的なコマンド

`.claude/commands/hello.md`:
```markdown
---
description: Simple greeting command
---
Hello! You said: $ARGUMENTS
```

### パラメータ付きコマンド

`.claude/commands/format.md`:
```markdown
---
description: Format code files
parameters:
  - name: path
    type: string
    required: true
    description: Path to format
  - name: style
    type: string
    required: false
    default: prettier
---
Format the code at $PATH using $STYLE.

{{#if eq style "prettier"}}
Use Prettier configuration from the project root.
{{/if}}
```

### 複雑なコマンド

`.claude/commands/refactor.md`:
```markdown
---
description: Refactor code with specific patterns
parameters:
  - name: pattern
    type: string
    required: true
  - name: targets
    type: string
    required: false
    default: "src"
  - name: preview
    type: boolean
    required: false
    default: true
---
# Refactoring Task

Search for the pattern "$PATTERN" in $TARGETS.

{{#if preview}}
## Preview Mode
Show the changes that would be made without actually applying them.
{{/if}}

{{#each args}}
Additional argument {{index}}: {{this}}
{{/each}}
```

## ベストプラクティス

1. **明確な説明**: コマンドの目的を明確に記述する
2. **パラメータ検証**: 必須パラメータとデフォルト値を適切に設定
3. **エラーハンドリング**: 条件分岐で異常ケースに対応
4. **ドキュメント**: コマンド内に使用例を含める

## トラブルシューティング

### コマンドが見つからない

- ファイルが正しいディレクトリに配置されているか確認
  - プロジェクト: `.claude/commands/`
  - ユーザー: `~/.claude/commands/`
- ファイル名が `.md` で終わっているか確認
- YAMLフロントマターが正しく記述されているか確認

### テンプレートが正しく展開されない

- 変数名の大文字・小文字を確認（`$ARGUMENTS`は大文字）
- パラメータ定義と使用箇所の名前が一致しているか確認
- 条件式の構文が正しいか確認

### 引数が渡されない

- Claude Code構文では `$ARGUMENTS` を使用
- 個別の引数にアクセスする場合は `{{args.0}}`, `{{args.1}}` など

## 関連ドキュメント

- [Claude Code公式ドキュメント](https://docs.anthropic.com/en/docs/claude-code/slash-commands)
- [API リファレンス](../api/api-reference.md)
- [使用例](../examples/README.md)
# Claude Code SDK v1.0.60 サブエージェント機能調査結果

## 概要

Claude Code SDK v1.0.60で「サブエージェント」機能が追加されました。この機能により、特定のタスクに特化したAIアシスタントを作成できるようになりました。

## 調査結果

### 1. SDKレベルでの実装状況

SDKの型定義ファイル（`sdk.d.ts`）を調査した結果：
- サブエージェント関連の新しい型定義は見つからない
- `/agent`や`subagent`に関連するAPI関数は追加されていない
- 既存のOptions型にもサブエージェント関連のパラメータは追加されていない

### 2. CLIレベルでの実装

[公式ドキュメント](https://docs.anthropic.com/en/docs/claude-code/sub-agents)によると、サブエージェント機能は以下の特徴を持つ：

- **設定方法**: Markdownファイル + YAMLフロントマター
- **配置場所**: 
  - プロジェクトレベル: `.claude/agents/`
  - ユーザーレベル: `~/.claude/agents/`
- **管理コマンド**: `/agents`（対話的な作成・編集・権限設定）

### 3. サブエージェントの仕様

```markdown
---
name: code-reviewer
description: "Expert code review specialist"
tools: Read, Grep, Glob, Bash
---

# System Prompt
You are an expert code reviewer...
```

#### 主な特徴：
- 独立したコンテキストウィンドウ
- 特定の目的・専門領域を持つ
- カスタムシステムプロンプト
- ツールアクセスの制限が可能
- 自動または明示的な呼び出し

## cc-anywhereへの実装提案

### 1. サブエージェント設定のAPI化

現在のClaude Code SDKには直接的なサブエージェントAPIがないため、cc-anywhereでは以下のアプローチを検討：

#### アプローチ1: ファイルベースの管理
```typescript
interface SubAgentConfig {
  name: string;
  description: string;
  tools: string[];
  systemPrompt: string;
}

class SubAgentManager {
  private agentsDir: string;
  
  constructor(projectPath: string) {
    this.agentsDir = path.join(projectPath, '.claude', 'agents');
  }
  
  async createAgent(config: SubAgentConfig): Promise<void> {
    const content = `---
name: ${config.name}
description: "${config.description}"
tools: ${config.tools.join(', ')}
---

${config.systemPrompt}`;
    
    await fs.writeFile(
      path.join(this.agentsDir, `${config.name}.md`),
      content
    );
  }
}
```

#### アプローチ2: カスタムシステムプロンプトでの実装
```typescript
// サブエージェントをシミュレートする
const executeWithSubAgent = async (
  instruction: string, 
  agentType: 'code-reviewer' | 'test-writer' | 'refactorer'
) => {
  const agentPrompts = {
    'code-reviewer': `You are a code review specialist. Focus on:
      - Code quality and best practices
      - Security vulnerabilities
      - Performance optimizations`,
    'test-writer': `You are a test writing specialist. Focus on:
      - Writing comprehensive test cases
      - Edge case coverage
      - Test performance`,
    'refactorer': `You are a refactoring specialist. Focus on:
      - Code structure improvements
      - Design pattern application
      - Reducing technical debt`
  };
  
  const options: Options = {
    customSystemPrompt: agentPrompts[agentType],
    allowedTools: getToolsForAgent(agentType),
    // その他のオプション
  };
  
  return await query({ prompt: instruction, options });
};
```

### 2. APIエンドポイントの設計

```typescript
// POST /api/tasks with sub-agent
{
  "instruction": "Review this code for security issues",
  "subAgent": "security-reviewer",
  "context": {
    "files": ["src/auth.ts"],
    "workingDirectory": "/project"
  }
}

// POST /api/sub-agents - サブエージェント管理
{
  "name": "security-reviewer",
  "description": "Security focused code reviewer",
  "tools": ["Read", "Grep", "Glob"],
  "systemPrompt": "You are a security expert..."
}
```

### 3. 実装上の考慮事項

1. **権限管理**
   - サブエージェントごとのツール制限
   - ユーザーごとのサブエージェント利用制限

2. **パフォーマンス**
   - サブエージェントの初期化コスト
   - コンテキストウィンドウの管理

3. **ユーザビリティ**
   - WebUIでのサブエージェント選択
   - サブエージェントのテンプレート提供

## 結論

Claude Code SDK v1.0.60のサブエージェント機能は、主にCLIレベルで実装されており、SDKレベルでの直接的なAPIは提供されていません。cc-anywhereでこの機能を活用するには：

1. ファイルベースの設定管理を実装する
2. カスタムシステムプロンプトで機能をシミュレートする
3. 将来的なSDKアップデートに備えた設計にする

これにより、専門的なタスクに特化した効率的なAIアシスタントをcc-anywhere経由で提供できるようになります。
# 開発環境セットアップ

CC-Anywhereの開発環境を構築する手順を説明します。

## 必要なツール

- Node.js 18以上（推奨: nodenvで管理）
- Git
- VSCode（推奨）または任意のエディタ
- SQLite3（デバッグ用）

## 初期セットアップ

### 1. リポジトリのフォーク＆クローン

```bash
# GitHubでフォーク後
git clone https://github.com/YOUR_USERNAME/cc-anywhere.git
cd cc-anywhere

# アップストリームを追加
git remote add upstream https://github.com/original-org/cc-anywhere.git
```

### 2. 依存関係のインストール

```bash
# 開発用依存関係も含めてインストール
npm install

# Git hooksのセットアップ（推奨）
npm run prepare
```

### 3. 環境設定

```bash
# 開発用環境設定
cp .env.example .env.development
vim .env.development
```

推奨開発設定：

```env
NODE_ENV=development
PORT=5000
LOG_LEVEL=debug
CLAUDE_API_KEY=sk-ant-api03-...
API_KEY=dev-test-key
TUNNEL_TYPE=none
ENABLE_WORKTREE=true
```

### 4. VSCode設定

推奨拡張機能（`.vscode/extensions.json`）：

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "ms-vscode.vscode-typescript-next",
    "orta.vscode-jest",
    "streetsidesoftware.code-spell-checker"
  ]
}
```

## 開発ワークフロー

### 1. ブランチ作成

```bash
# 最新のmainを取得
git checkout main
git pull upstream main

# 機能ブランチを作成
git checkout -b feature/your-feature-name
```

### 2. 開発サーバー起動

```bash
# TypeScriptのwatch modeとnodemon
npm run dev

# ログ出力を見やすくする
npm run dev | pino-pretty
```

### 3. テスト実行

```bash
# 全テスト
npm test

# ユニットテストのみ
npm run test:unit

# ウォッチモード
npm run test:watch

# カバレッジ
npm run test:coverage
```

### 4. コード品質チェック

```bash
# Lintチェック
npm run lint

# 自動修正
npm run lint:fix

# 型チェック
npm run typecheck

# すべてのチェック
npm run check
```

## デバッグ

### VSCodeでのデバッグ

`.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug CC-Anywhere",
      "program": "${workspaceFolder}/src/index.ts",
      "preLaunchTask": "npm: build",
      "outFiles": ["${workspaceFolder}/dist/**/*.js"],
      "env": {
        "NODE_ENV": "development",
        "LOG_LEVEL": "debug"
      }
    }
  ]
}
```

### ログデバッグ

```typescript
import { logger } from './utils/logger';

logger.debug('Detailed debug info', { 
  taskId, 
  context: task.context 
});
```

### データベースデバッグ

```bash
# SQLiteデータベースを直接確認
sqlite3 data/cc-anywhere.db

# 最近のタスクを確認
.headers on
.mode column
SELECT id, status, created_at FROM tasks ORDER BY created_at DESC LIMIT 10;
```

## テスト作成

### ユニットテスト

```typescript
// tests/unit/services/my-service.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { MyService } from '../../../src/services/my-service';

describe('MyService', () => {
  let service: MyService;

  beforeEach(() => {
    service = new MyService();
  });

  it('should do something', async () => {
    const result = await service.doSomething();
    expect(result).toBe(expected);
  });
});
```

### 統合テスト

```typescript
// tests/integration/api.test.ts
import { createApp } from '../../src/server/app';
import type { FastifyInstance } from 'fastify';

describe('API Integration', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should create a task', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: { instruction: 'test' }
    });
    
    expect(response.statusCode).toBe(200);
  });
});
```

## コーディング規約

### TypeScript

- strictモードを維持
- any型の使用を避ける
- インターフェースを活用

### 命名規則

- ファイル名: kebab-case
- クラス名: PascalCase
- 関数名: camelCase
- 定数: UPPER_SNAKE_CASE

### コミットメッセージ

```
feat: 新機能の追加
fix: バグ修正
docs: ドキュメントのみの変更
style: コードの意味に影響しない変更
refactor: バグ修正や機能追加を伴わないコード変更
test: テストの追加・修正
chore: ビルドプロセスやツールの変更
```

## トラブルシューティング

### 型エラー

```bash
# 型定義を再生成
npm run build

# 依存関係の型を更新
npm install --save-dev @types/node@latest
```

### テストが失敗する

```bash
# テスト環境をリセット
rm -rf data/test.db
npm run test:unit
```

### ホットリロードが効かない

```bash
# nodemonを再起動
npm run dev

# それでもダメな場合
pkill -f nodemon
npm run dev
```

## リソース

- [TypeScript ドキュメント](https://www.typescriptlang.org/docs/)
- [Fastify ドキュメント](https://www.fastify.io/docs/latest/)
- [Vitest ドキュメント](https://vitest.dev/)
- [Claude API ドキュメント](https://docs.anthropic.com/)
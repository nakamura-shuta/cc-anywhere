# OpenAPI Migration - Statement of Work (SOW)

## プロジェクト概要

現在のFastify APIサーバーにOpenAPI 3.1仕様を導入し、API定義、バリデーション、ドキュメント生成を統一的に管理する体制を構築する。

## 目的と期待される成果

### 目的
1. API仕様の一元管理と標準化
2. 自動バリデーションによる品質向上
3. API ドキュメントの自動生成
4. 型安全性の向上
5. クライアントSDKの自動生成基盤

### 期待される成果
- OpenAPI 3.1仕様に準拠したAPI定義
- Fastifyとの完全統合
- 自動生成されるAPIドキュメント
- バリデーションエラーの標準化
- 将来的なクライアントSDK生成の基盤

## 実装アプローチ

### フェーズ1: 基盤構築（優先度: 高）
**期間**: 2-3日

1. **OpenAPI仕様ファイルの作成**
   - `/openapi/openapi.yaml`の作成
   - 基本構造とメタデータの定義
   - セキュリティスキーマの定義

2. **Fastify統合**
   - `@fastify/swagger`と`@fastify/swagger-ui`の導入
   - 既存のFastifyスキーマとOpenAPIの統合
   - バリデーション設定の移行

3. **共通コンポーネントの定義**
   - エラーレスポンスの標準化
   - 共通パラメータの定義
   - セキュリティ定義（API Key認証）

### フェーズ2: 既存APIの移行（優先度: 高）
**期間**: 3-4日

1. **タスク管理API**
   - POST /api/tasks
   - GET /api/tasks/:taskId
   - DELETE /api/tasks/:taskId
   - GET /api/tasks/:taskId/logs

2. **リポジトリエクスプローラーAPI**
   - GET /api/repositories/tree
   - GET /api/repositories/file
   - POST /api/repositories/watch
   - DELETE /api/repositories/watch

3. **システムAPI**
   - GET /api/health
   - GET /api/metrics
   - WebSocket接続の定義

### フェーズ3: 高度な機能実装（優先度: 中）
**期間**: 2-3日

1. **バリデーション強化**
   - カスタムバリデータの実装
   - エラーメッセージのローカライゼーション
   - リクエスト/レスポンスの完全検証

2. **ドキュメント拡張**
   - 使用例の追加
   - コールバックの定義
   - WebHookの仕様化

3. **テスト強化**
   - OpenAPI仕様に基づくテスト生成
   - コントラクトテストの実装

### フェーズ4: 自動化とCI/CD（優先度: 低）
**期間**: 1-2日

1. **CI/CD統合**
   - OpenAPI仕様の自動検証
   - ドキュメントの自動デプロイ
   - 破壊的変更の検出

2. **クライアントSDK生成**
   - TypeScript SDKの自動生成
   - バージョニング戦略

## 技術スタック

### 必須パッケージ
```json
{
  "@fastify/swagger": "^8.14.0",
  "@fastify/swagger-ui": "^3.0.0",
  "fluent-json-schema": "^4.2.1"
}
```

### 開発ツール
```json
{
  "@apidevtools/swagger-cli": "^4.0.4",
  "openapi-typescript": "^6.7.3",
  "openapi-typescript-codegen": "^0.25.0"
}
```

## ファイル構成

```
cc-anywhere/
├── backend/
│   ├── openapi/
│   │   ├── openapi.yaml              # メインOpenAPI定義
│   │   ├── components/
│   │   │   ├── schemas/              # スキーマ定義
│   │   │   ├── parameters/           # 共通パラメータ
│   │   │   ├── responses/            # 共通レスポンス
│   │   │   └── securitySchemes/      # セキュリティ定義
│   │   └── paths/                    # エンドポイント定義
│   │       ├── tasks.yaml
│   │       ├── repositories.yaml
│   │       └── system.yaml
│   ├── src/
│   │   ├── plugins/
│   │   │   └── swagger.ts            # Swagger プラグイン
│   │   └── schemas/                  # TypeScript型定義（自動生成）
│   └── scripts/
│       ├── generate-types.ts         # 型生成スクリプト
│       └── validate-openapi.ts       # 検証スクリプト
```

## 実装詳細

### 1. OpenAPI定義の基本構造

```yaml
openapi: 3.1.0
info:
  title: CC-Anywhere API
  description: Claude Code SDK HTTP Server API
  version: 0.4.0
  contact:
    name: API Support
    email: support@example.com
  license:
    name: MIT
    url: https://opensource.org/licenses/MIT

servers:
  - url: http://localhost:5000
    description: Development server
  - url: https://api.cc-anywhere.com
    description: Production server

tags:
  - name: tasks
    description: Task management operations
  - name: repositories
    description: Repository explorer operations
  - name: system
    description: System health and metrics

components:
  securitySchemes:
    ApiKeyAuth:
      type: apiKey
      in: header
      name: X-API-Key
      description: API key for authentication

security:
  - ApiKeyAuth: []
```

### 2. Fastify統合コード

```typescript
// src/plugins/swagger.ts
import fp from 'fastify-plugin';
import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';
import { readFileSync } from 'fs';
import { load } from 'js-yaml';
import { resolve } from 'path';

export default fp(async function (fastify) {
  const openapiPath = resolve(process.cwd(), 'openapi/openapi.yaml');
  const openapiDocument = load(readFileSync(openapiPath, 'utf8'));

  await fastify.register(swagger, {
    mode: 'static',
    specification: {
      document: openapiDocument
    }
  });

  await fastify.register(swaggerUI, {
    routePrefix: '/api/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true
    }
  });
});
```

### 3. エンドポイント定義例

```yaml
# openapi/paths/tasks.yaml
/api/tasks:
  post:
    tags:
      - tasks
    summary: Create a new task
    operationId: createTask
    requestBody:
      required: true
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/CreateTaskRequest'
    responses:
      '201':
        description: Task created successfully
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/TaskResponse'
      '400':
        $ref: '#/components/responses/BadRequest'
      '401':
        $ref: '#/components/responses/Unauthorized'
      '500':
        $ref: '#/components/responses/InternalServerError'
```

## リスクと対策

### リスク
1. 既存APIとの互換性破壊
2. パフォーマンスへの影響
3. 開発工数の増加

### 対策
1. 段階的移行とバージョニング
2. パフォーマンステストの実施
3. 自動化ツールの積極活用

## タイムライン

| フェーズ | 期間 | 成果物 |
|---------|------|--------|
| フェーズ1 | 2-3日 | OpenAPI基盤構築完了 |
| フェーズ2 | 3-4日 | 全API移行完了 |
| フェーズ3 | 2-3日 | 高度な機能実装完了 |
| フェーズ4 | 1-2日 | CI/CD統合完了 |

**総期間**: 8-12日

## 成功基準

1. すべてのAPIがOpenAPI仕様で定義されている
2. 自動生成されたドキュメントが利用可能
3. バリデーションエラーが標準化されている
4. 型定義が自動生成されている
5. 既存のテストがすべてパスする

## 次のステップ

1. このSOWのレビューと承認
2. フェーズ1の実装開始
3. 段階的な移行とテスト

## 参考資料

- [OpenAPI 3.1 Specification](https://spec.openapis.org/oas/v3.1.0)
- [Fastify Swagger Plugin](https://github.com/fastify/fastify-swagger)
- [JSON Schema](https://json-schema.org/)
- [Fluent JSON Schema](https://github.com/fastify/fluent-json-schema)
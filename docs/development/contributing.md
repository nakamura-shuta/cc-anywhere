# コントリビューションガイド

CC-Anywhereへの貢献方法を説明します。すべての貢献を歓迎します！

## 貢献の種類

- 🐛 バグ報告
- 💡 機能提案
- 📝 ドキュメント改善
- 🔧 コード貢献
- 🌐 翻訳
- 💬 質問への回答

## はじめる前に

1. [Code of Conduct](./code-of-conduct.md)を読む
2. [既存のIssues](https://github.com/your-org/cc-anywhere/issues)を確認
3. 大きな変更の場合は、先にIssueで議論

## 開発プロセス

### 1. Issue作成または選択

```markdown
## 概要
機能Xを追加したい

## 動機
現在、Yができないため不便

## 提案する解決策
Zという方法で実装する

## 代替案
他の方法も検討した
```

### 2. フォークとブランチ作成

```bash
# フォーク後
git clone https://github.com/YOUR_USERNAME/cc-anywhere.git
cd cc-anywhere
git remote add upstream https://github.com/original-org/cc-anywhere.git

# ブランチ作成
git checkout -b feature/issue-123-add-feature-x
```

### 3. 開発

[開発環境セットアップ](./setup.md)を参照

### 4. テスト

```bash
# 必須：すべてのテストをパス
npm test

# 必須：Lintチェック
npm run lint

# 必須：型チェック
npm run typecheck
```

### 5. コミット

```bash
# 意味のある単位でコミット
git add src/features/new-feature.ts
git commit -m "feat: add new feature X

- Implement feature X
- Add tests for feature X
- Update documentation

Closes #123"
```

### 6. プルリクエスト

#### PRテンプレート

```markdown
## 概要
このPRは#123を解決します。

## 変更内容
- [ ] 機能Xを実装
- [ ] テストを追加
- [ ] ドキュメントを更新

## テスト方法
1. `npm run dev`でサーバーを起動
2. `/api/new-endpoint`にPOSTリクエスト
3. 期待される結果を確認

## スクリーンショット（UI変更の場合）
[該当する場合は追加]

## チェックリスト
- [ ] コードは既存のスタイルに従っている
- [ ] セルフレビューを実施した
- [ ] コメントを適切に追加した
- [ ] ドキュメントを更新した
- [ ] 破壊的変更がない（ある場合は明記）
- [ ] テストを追加し、すべてパスしている
```

## コーディングガイドライン

### TypeScript

```typescript
// Good ✅
interface TaskOptions {
  timeout?: number;
  retries?: number;
}

async function executeTask(
  instruction: string, 
  options: TaskOptions = {}
): Promise<TaskResult> {
  // 実装
}

// Bad ❌
async function executeTask(instruction: any, options: any) {
  // any型は避ける
}
```

### エラーハンドリング

```typescript
// Good ✅
try {
  const result = await riskyOperation();
  return { success: true, data: result };
} catch (error) {
  logger.error('Operation failed', { error, context });
  return { 
    success: false, 
    error: error instanceof Error ? error.message : 'Unknown error' 
  };
}

// Bad ❌
try {
  return await riskyOperation();
} catch (e) {
  console.log(e);
  throw e;
}
```

### テスト

```typescript
// Good ✅
describe('TaskExecutor', () => {
  describe('execute', () => {
    it('should execute task successfully', async () => {
      // Arrange
      const task = createMockTask();
      const executor = new TaskExecutor();
      
      // Act
      const result = await executor.execute(task);
      
      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
    
    it('should handle errors gracefully', async () => {
      // エラーケースもテスト
    });
  });
});
```

## レビュープロセス

1. **自動チェック**: CI/CDがテストとLintを実行
2. **コードレビュー**: メンテナーがコードをレビュー
3. **フィードバック**: 必要に応じて修正を依頼
4. **承認**: 2人以上の承認でマージ可能

## リリースプロセス

1. **バージョニング**: セマンティックバージョニング
2. **チェンジログ**: 自動生成
3. **リリースノート**: 主な変更点を記載

## 質問とサポート

- **Discord**: [コミュニティサーバー](https://discord.gg/cc-anywhere)
- **GitHub Discussions**: [Q&A](https://github.com/your-org/cc-anywhere/discussions)
- **Issue**: バグや機能要望

## 貢献者の認識

- READMEの貢献者リストに追加
- リリースノートでのクレジット
- 重要な貢献にはSpecial Thanksを贈呈

## ライセンス

貢献されたコードは、プロジェクトと同じ[MITライセンス](../../LICENSE)の下でライセンスされます。

ありがとうございます！ 🎉
# リポジトリ必須化の提案

## 現状の問題点

### 1. セキュリティリスク
- リポジトリ未指定時、サーバープロセスの作業ディレクトリで実行される
- 意図しないファイルへのアクセスや変更のリスク

### 2. ユーザビリティの問題
- どこで実行されるか不明確
- 誤操作のリスクが高い

### 3. 実装の不整合
- バッチタスクではリポジトリ必須
- 単一タスクではオプション

## 提案内容

### 1. UI/UXの改善案

#### A. デフォルトリポジトリの自動選択
```javascript
// app.jsの修正
async function loadRepositories() {
    try {
        const data = await apiClient.getRepositories();
        const select = document.getElementById('repositories');
        
        // リポジトリ一覧を追加
        data.repositories.forEach((repo, index) => {
            const option = document.createElement('option');
            option.value = repo.path;
            option.text = repo.name;
            // 最初のリポジトリをデフォルト選択
            if (index === 0) {
                option.selected = true;
            }
            select.appendChild(option);
        });
        
        // 選択変更時のヘルプテキスト更新
        updateRepositoryHelp();
    } catch (error) {
        console.error('Failed to load repositories:', error);
    }
}
```

#### B. UIの変更
```html
<!-- 現在: オプション表記 -->
<label for="repositories">リポジトリ（オプション）</label>

<!-- 提案: 必須表記に変更 -->
<label for="repositories">
    作業リポジトリ
    <span class="required">*</span>
</label>
<select 
    id="repositories" 
    name="repositories"
    required
    class="repository-select"
>
    <option value="">-- リポジトリを選択してください --</option>
    <!-- 動的に追加 -->
</select>
<small id="repository-help">選択したリポジトリのディレクトリでタスクが実行されます</small>
```

### 2. APIの変更案

#### A. 段階的移行（推奨）
```typescript
// Phase 1: 警告を出す（現在）
if (!request.body.context?.workingDirectory) {
    logger.warn("No working directory specified, using server process directory");
}

// Phase 2: デフォルトを設定（移行期）
if (!request.body.context?.workingDirectory) {
    // repositories.jsonの最初のリポジトリをデフォルトに
    const defaultRepo = getDefaultRepository();
    request.body.context = {
        ...request.body.context,
        workingDirectory: defaultRepo.path
    };
    logger.info(`Using default repository: ${defaultRepo.name}`);
}

// Phase 3: 必須化（最終）
schema: {
    body: {
        type: "object",
        properties: {
            instruction: { type: "string", minLength: 1 },
            context: {
                type: "object",
                properties: {
                    workingDirectory: { type: "string", minLength: 1 },
                    files: { type: "array", items: { type: "string" } },
                },
                required: ["workingDirectory"] // 必須に
            },
        },
        required: ["instruction", "context"]
    }
}
```

### 3. 実装優先順位

#### Phase 1（即時実施）
- UIでデフォルトリポジトリを自動選択
- 必須フィールドとして視覚的に表示
- ヘルプテキストの改善

#### Phase 2（1週間後）
- APIでデフォルトリポジトリの自動設定
- 未指定時の警告ログ

#### Phase 3（1ヶ月後）
- API仕様でworkingDirectoryを必須化
- エラーレスポンスの返却

## メリット

1. **セキュリティ向上**: 意図しないディレクトリでの実行を防止
2. **明確性**: どこで実行されるか常に明確
3. **一貫性**: バッチタスクと単一タスクの動作統一
4. **エラー防止**: 設定忘れによるトラブル削減

## デメリットと対策

1. **後方互換性**: 
   - 対策: 段階的移行で既存クライアントに猶予期間

2. **追加の手間**:
   - 対策: デフォルト選択で手間を最小化

3. **単純なタスクでも指定必要**:
   - 対策: よく使うリポジトリを上位に配置

## 代替案

### カレントディレクトリオプション
```javascript
// 特別な値として"."を許可
const CURRENT_DIR_INDICATOR = ".";

if (workingDirectory === CURRENT_DIR_INDICATOR) {
    // 明示的にカレントディレクトリを指定
    workingDirectory = process.cwd();
}
```

ただし、これもセキュリティリスクがあるため非推奨。

## 結論

リポジトリ指定を必須にすることで、より安全で予測可能な動作を実現できます。
段階的な移行により、既存ユーザーへの影響を最小限に抑えながら改善を進められます。
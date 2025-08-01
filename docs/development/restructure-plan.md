# CC-Anywhere プロジェクト構造再編成計画

## 現在の構成分析

### ルートディレクトリのファイル
```
/Users/nakamura.shuta/dev/cc-anywhere/
├── バックエンド関連
│   ├── src/                    # バックエンドソースコード
│   ├── tests/                  # バックエンドテスト
│   ├── config/                 # 設定ファイル
│   ├── scripts/                # ユーティリティスクリプト
│   ├── data/                   # データディレクトリ
│   ├── logs/                   # ログディレクトリ
│   ├── dist/                   # ビルド出力
│   ├── package.json            # バックエンド依存関係
│   ├── package-lock.json       # ロックファイル
│   ├── tsconfig.json           # TypeScript設定
│   ├── vitest.config.ts        # テスト設定
│   ├── ecosystem.config.js     # PM2設定
│   ├── .eslintrc.json          # ESLint設定
│   └── .prettierrc.json        # Prettier設定
│
├── フロントエンド関連
│   └── frontend-svelte/        # Svelteプロジェクト
│
├── プロジェクト共通
│   ├── docs/                   # ドキュメント
│   ├── .git/                   # Git管理
│   ├── .gitignore              # Git無視設定
│   ├── README.md               # プロジェクトREADME
│   ├── CHANGELOG.md            # 変更履歴
│   ├── LICENSE                 # ライセンス
│   ├── SECURITY.md             # セキュリティポリシー
│   └── TODO.md                 # TODOリスト
│
├── 環境設定
│   ├── .env                    # 環境変数（gitignore対象）
│   ├── .env.example            # 環境変数サンプル
│   └── cloudflared-config.yml  # Cloudflare設定
│
├── その他
│   ├── .claude/                # Claude設定
│   ├── .vscode/                # VSCode設定
│   ├── .work/                  # 作業ディレクトリ
│   ├── web.backup-*            # 旧フロントエンドバックアップ
│   └── server.log              # サーバーログ
```

## 移行詳細計画

### 1. バックエンドディレクトリへの移動対象

#### 必須移動ファイル/ディレクトリ
- `src/` → `backend/src/`
- `tests/` → `backend/tests/`
- `config/` → `backend/config/`
- `scripts/` → `backend/scripts/`
- `data/` → `backend/data/`
- `logs/` → `backend/logs/`
- `dist/` → `backend/dist/`
- `package.json` → `backend/package.json`
- `package-lock.json` → `backend/package-lock.json`
- `tsconfig.json` → `backend/tsconfig.json`
- `tsconfig.test.json` → `backend/tsconfig.test.json`
- `vitest.config.ts` → `backend/vitest.config.ts`
- `ecosystem.config.js` → `backend/ecosystem.config.js`
- `.eslintrc.json` → `backend/.eslintrc.json`
- `.prettierrc.json` → `backend/.prettierrc.json`
- `.nvmrc` → `backend/.nvmrc`
- `.eslintignore` → `backend/.eslintignore`
- `.prettierignore` → `backend/.prettierignore`
- `.tsbuildinfo` → `backend/.tsbuildinfo`

### 2. フロントエンドディレクトリの整理
- `frontend-svelte/` → `frontend/`

### 3. ルートに残すファイル
- `.git/`
- `.gitignore`（更新が必要）
- `README.md`（更新が必要）
- `CHANGELOG.md`
- `LICENSE`
- `SECURITY.md`
- `.env.example`
- `docs/`（プロジェクト全体のドキュメント）

### 4. 新規作成するファイル/ディレクトリ

#### ルートレベル
```json
// package.json (ワークスペース管理用)
{
  "name": "cc-anywhere",
  "private": true,
  "workspaces": [
    "backend",
    "frontend"
  ],
  "scripts": {
    "dev": "concurrently \"npm run dev:backend\" \"npm run dev:frontend\"",
    "dev:backend": "npm run dev -w backend",
    "dev:frontend": "npm run dev -w frontend",
    "build": "npm run build -w backend && npm run build -w frontend",
    "test": "npm run test -w backend && npm run test -w frontend",
    "lint": "npm run lint --workspaces",
    "format": "npm run format --workspaces"
  },
  "devDependencies": {
    "concurrently": "^8.2.2"
  }
}
```

#### shared/types/
- `shared/types/task.ts` - タスク関連の共通型定義
- `shared/types/api.ts` - API関連の共通型定義
- `shared/types/index.ts` - エクスポート用

### 5. 設定ファイルの更新

#### backend/package.json
- scriptsのパス調整
- distディレクトリのパス調整

#### backend/tsconfig.json
- パスエイリアスの調整
- 共有型定義へのパス追加

#### frontend/tsconfig.json
- 共有型定義へのパス追加

#### .gitignore（ルート）
```gitignore
# Dependencies
node_modules/

# Environment
.env
.env.local

# Build outputs
backend/dist/
frontend/dist/
frontend/.svelte-kit/

# Logs
*.log
backend/logs/

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# OS
.DS_Store
Thumbs.db

# Temporary
.work/
*.backup-*
```

## 実行手順チェックリスト

### Phase 0: 準備
- [ ] 現在の作業をコミット
- [ ] プロジェクト全体のバックアップ作成
- [ ] 開発サーバーの停止

### Phase 1: ディレクトリ作成
- [ ] `backend`ディレクトリ作成
- [ ] `shared`ディレクトリ作成
- [ ] `shared/types`ディレクトリ作成

### Phase 2: ファイル移動
- [ ] バックエンドファイルの移動（上記リスト参照）
- [ ] `frontend-svelte`を`frontend`にリネーム
- [ ] 不要なバックアップディレクトリの削除

### Phase 3: 設定更新
- [ ] ルートの`package.json`作成
- [ ] `backend/package.json`のパス更新
- [ ] `backend/tsconfig.json`のパス更新
- [ ] `.gitignore`の更新

### Phase 4: 動作確認
- [ ] バックエンドの起動確認
- [ ] フロントエンドの起動確認
- [ ] テストの実行確認
- [ ] ビルドの実行確認

### Phase 5: ドキュメント更新
- [ ] README.mdの更新
- [ ] 開発ガイドの更新
- [ ] APIドキュメントのパス更新

## 注意事項

1. **import文の更新**
   - 相対パスが変わるため、全てのimport文を確認
   - 特に`../`や`../../`を使用している箇所

2. **設定ファイルのパス**
   - データベースファイルのパス
   - ログファイルのパス
   - 静的ファイルのパス

3. **環境変数**
   - `.env`ファイルの配置場所
   - 環境変数で指定されているパス

4. **CI/CD**
   - GitHub Actionsのワークフローファイル更新
   - デプロイスクリプトのパス更新

5. **Docker対応（将来）**
   - Dockerfileの作成場所
   - docker-compose.ymlの構成
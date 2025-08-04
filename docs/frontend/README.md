# フロントエンド開発ガイド

CC-AnywhereのWeb UI開発に関するガイドです。

## 🛠 技術スタック

- **フレームワーク**: SvelteKit
- **UI**: shadcn-svelte + Tailwind CSS
- **言語**: TypeScript
- **ビルド**: Vite
- **デプロイ**: Static Adapter

## 🚀 開発環境

### セットアップ

```bash
cd frontend
npm install
npm run dev
```

開発サーバー: http://localhost:4444

### ディレクトリ構造

```
frontend/
├── src/
│   ├── routes/          # ページコンポーネント
│   │   ├── +page.svelte # トップページ
│   │   ├── tasks/       # タスク関連ページ
│   │   └── scheduler/   # スケジューラー
│   ├── lib/
│   │   ├── components/  # UIコンポーネント
│   │   ├── stores/      # Svelteストア
│   │   ├── api/         # APIクライアント
│   │   └── config/      # 設定
│   └── app.html        # HTMLテンプレート
└── static/             # 静的ファイル
```

## 📝 主要コンポーネント

### ページ

- `/` - ダッシュボード
- `/tasks` - タスク一覧
- `/tasks/new` - タスク作成
- `/tasks/[id]` - タスク詳細
- `/scheduler` - スケジューラー
- `/settings` - 設定

### ストア（Svelte 5 Runes）

```typescript
// Svelte 5の新しいRunes APIを使用
class TaskStore {
  tasks = $state<Task[]>([]);
  loading = $state(false);
  
  async loadTasks() {
    this.loading = true;
    this.tasks = await apiClient.get('/api/tasks');
    this.loading = false;
  }
}

export const taskStore = new TaskStore();
```

### APIクライアント

```typescript
// 動的ベースURL（ngrok/Cloudflare対応）
class ApiClient {
  constructor() {
    this.baseUrl = typeof window !== 'undefined' 
      ? window.location.origin 
      : 'http://localhost:5000';
  }
}
```

## 🎨 UIコンポーネント

### shadcn-svelte

```svelte
<script>
  import { Button } from '$lib/components/ui/button';
  import { Card } from '$lib/components/ui/card';
</script>

<Card>
  <Card.Header>
    <Card.Title>タスク作成</Card.Title>
  </Card.Header>
  <Card.Content>
    <Button on:click={createTask}>実行</Button>
  </Card.Content>
</Card>
```

### Tailwind CSS

```svelte
<div class="container mx-auto p-4">
  <h1 class="text-2xl font-bold mb-4">タスク一覧</h1>
  <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
    <!-- コンテンツ -->
  </div>
</div>
```

## 📱 レスポンシブデザイン

### モバイル対応

```css
/* モバイルファースト */
.container {
  padding: 1rem;
}

/* タブレット以上 */
@media (min-width: 768px) {
  .container {
    padding: 2rem;
  }
}
```

### タッチ対応

```svelte
<button
  class="p-4 min-h-[44px] touch-manipulation"
  on:click={handleClick}
>
  タップ可能なボタン
</button>
```

## 🔄 リアルタイム通信

### WebSocket接続

```typescript
import { EnhancedWebSocketStore } from '$lib/stores/websocket-enhanced.svelte';

const ws = new EnhancedWebSocketStore({
  url: getWebSocketUrl(),
  reconnect: true,
  heartbeatInterval: 30000
});

// タスクのサブスクライブ
ws.subscribeToTask(taskId);
```

### Server-Sent Events

```typescript
// タスクログのストリーミング
const response = await fetch(`/api/tasks/${taskId}/logs`, {
  headers: { 'Accept': 'text/event-stream' }
});

const reader = response.body.getReader();
// ストリーム処理
```

## 🔒 認証

### QR認証対応

```typescript
// 認証ストア
class AuthStore {
  authenticated = $state(false);
  token = $state<string | null>(null);
  
  async authenticate(token: string) {
    const response = await fetch(`/api/auth/verify?api_key=${token}`);
    if (response.ok) {
      this.token = token;
      this.authenticated = true;
      localStorage.setItem('cc-anywhere-api-key', token);
    }
  }
}
```

### プライベートブラウジング対応

```typescript
// ストレージフォールバック
try {
  localStorage.setItem(key, value);
} catch {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // メモリに保持
  }
}
```

## 🏗 ビルド設定

### SvelteKit設定

```javascript
// svelte.config.js
import adapter from '@sveltejs/adapter-static';

export default {
  kit: {
    adapter: adapter({
      pages: 'build',
      assets: 'build',
      fallback: 'index.html'
    })
  }
};
```

### SPAモード

```typescript
// +layout.ts
export const ssr = false;  // SSR無効
export const csr = true;   // CSR有効
export const prerender = false;
```

## 🧪 テスト

```bash
# ユニットテスト
npm run test:unit

# E2Eテスト
npm run test:e2e
```

## 🚀 デプロイ

### ビルド

```bash
npm run build
```

### バックエンドへの統合

```bash
# 自動統合
npm run deploy:frontend

# または全体ビルド
cd .. && ./scripts/build-all.sh
```

## 💡 開発のヒント

1. **型安全性**: TypeScriptの型を活用
2. **コンポーネント分割**: 再利用可能な小さい単位に
3. **ストア管理**: グローバル状態は最小限に
4. **エラーハンドリング**: ユーザーフレンドリーなメッセージ
5. **パフォーマンス**: 不要な再レンダリングを避ける

## 🐛 トラブルシューティング

### ビルドエラー

```bash
# キャッシュクリア
rm -rf .svelte-kit build node_modules
npm install
npm run build
```

### 型エラー

```bash
# 型チェック
npm run check
```

### スタイルが反映されない

```bash
# Tailwind再ビルド
npm run dev
```

## 📖 追加ドキュメント

- [状態管理ガイド](./state-management-guide.md) - Svelte 5 Runesを使った状態管理
- [テストガイド](./testing-guide.md) - フロントエンドのテスト方法
- [Svelteセットアップ](./svelte/setup-guide.md) - Svelte環境構築ガイド
- [Svelte用語集](./svelte/terminology.md) - Svelte固有の用語説明
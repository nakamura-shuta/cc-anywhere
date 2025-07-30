# CC-Anywhere フロントエンドアーキテクチャ

## 概要

CC-AnywhereのフロントエンドはSvelteKit + shadcn-svelteで構築されており、モダンなSPA（Single Page Application）として動作します。

## ディレクトリ構造

```
frontend/
├── src/
│   ├── app.css                 # グローバルスタイル（Tailwind CSS）
│   ├── app.html                # HTMLテンプレート
│   ├── lib/                    # 共有ライブラリ
│   │   ├── api/               # API通信層
│   │   ├── components/        # UIコンポーネント
│   │   │   ├── providers/     # コンテキストプロバイダー
│   │   │   └── ui/           # shadcn-svelteコンポーネント
│   │   ├── config/           # 設定ファイル
│   │   ├── hooks/            # カスタムフック
│   │   ├── services/         # ビジネスロジック層
│   │   ├── stores/           # グローバル状態管理
│   │   ├── types/            # TypeScript型定義
│   │   ├── utils/            # ユーティリティ関数
│   │   └── websocket/        # WebSocket通信
│   └── routes/               # ページコンポーネント
│       ├── +layout.svelte    # 共通レイアウト
│       ├── +page.svelte      # ホームページ
│       ├── api/              # API Explorer
│       ├── logs/             # ログビューア
│       ├── tasks/            # タスク管理
│       └── ...
├── static/                   # 静的アセット
├── tests/                    # テストファイル
└── build/                    # ビルド出力
```

## アーキテクチャの層構造

### 1. プレゼンテーション層（Routes）

ページコンポーネントはユーザーインターフェースを提供します：

```svelte
<!-- routes/tasks/+page.svelte -->
<script lang="ts">
  import type { PageData } from './$types';
  import { taskService } from '$lib/services/task.service';
  import { Button } from '$lib/components/ui/button';
  import * as Card from '$lib/components/ui/card';
  
  // load関数から受け取るデータ
  let { data }: { data: PageData } = $props();
  
  // UIロジック
  function refreshTasks() {
    window.location.reload();
  }
</script>

<div class="space-y-6">
  <Card.Root>
    <Card.Header>
      <Card.Title>タスク一覧</Card.Title>
    </Card.Header>
    <Card.Content>
      <!-- タスクリスト表示 -->
    </Card.Content>
  </Card.Root>
</div>
```

### 2. データ取得層（+page.ts）

SvelteKitのload関数でデータを取得：

```typescript
// routes/tasks/+page.ts
import type { PageLoad } from './$types';
import { taskService } from '$lib/services/task.service';

export const load: PageLoad = async ({ url }) => {
  const page = Number(url.searchParams.get('page')) || 1;
  const limit = Number(url.searchParams.get('limit')) || 20;
  
  try {
    const response = await taskService.list({ page, limit });
    
    return {
      tasks: response.data,
      pagination: response.pagination
    };
  } catch (err) {
    console.error('Failed to load tasks:', err);
    throw error(500, 'タスクの読み込みに失敗しました');
  }
};
```

### 3. サービス層（Business Logic）

APIとの通信を抽象化し、ビジネスロジックを実装：

```typescript
// lib/services/task.service.ts
import { apiClient } from '$lib/api/client';
import type { TaskRequest, TaskResponse } from '$lib/types/api';

export const taskService = {
  // タスク一覧の取得
  async list(params?: ListParams) {
    const response = await apiClient.get<{
      tasks: TaskResponse[];
      total: number;
      limit: number;
      offset: number;
    }>('/api/tasks', { params });
    
    // データ変換
    const tasks = response.tasks.map(task => ({
      ...task,
      id: task.taskId // APIレスポンスの正規化
    }));
    
    return {
      data: tasks,
      pagination: {
        page: params?.page || 1,
        limit: response.limit,
        total: response.total,
        totalPages: Math.ceil(response.total / response.limit)
      }
    };
  },
  
  // タスクの作成
  async create(request: TaskRequest): Promise<TaskResponse> {
    const task = await apiClient.post<TaskResponse>('/api/tasks', request);
    return { ...task, id: task.taskId };
  },
  
  // タスクのキャンセル
  async cancel(taskId: string): Promise<void> {
    try {
      await apiClient.delete(`/api/tasks/${taskId}`);
    } catch (error) {
      // フォールバック: POSTメソッドを試す
      await apiClient.post(`/api/tasks/${taskId}/cancel`);
    }
  }
};
```

### 4. API通信層

Axiosベースの統一されたAPIクライアント：

```typescript
// lib/api/client.ts
import axios from 'axios';
import { API_BASE_URL, getApiKey } from '$lib/config/api';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// リクエストインターセプター
apiClient.interceptors.request.use((config) => {
  const apiKey = getApiKey();
  if (apiKey) {
    config.headers['X-API-Key'] = apiKey;
  }
  return config;
});

// レスポンスインターセプター
apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    console.error('API Error:', error);
    throw error;
  }
);
```

### 5. 状態管理（Stores）

グローバルな状態管理にはSvelte 5のRunesを使用：

```typescript
// lib/stores/task.svelte.ts
import { taskService } from '$lib/services/task.service';
import type { TaskResponse } from '$lib/types/api';

class TaskStore {
  // リアクティブな状態
  tasks = $state<TaskResponse[]>([]);
  loading = $state(false);
  error = $state<Error | null>(null);
  
  // 現在のタスク
  currentTask = $state<TaskResponse | null>(null);
  
  // タスク一覧の取得
  async fetchTasks(params?: any) {
    this.loading = true;
    this.error = null;
    
    try {
      const response = await taskService.list(params);
      this.tasks = response.data;
    } catch (err) {
      this.error = err as Error;
    } finally {
      this.loading = false;
    }
  }
  
  // 単一タスクの取得
  async fetchTask(id: string) {
    try {
      this.currentTask = await taskService.get(id);
    } catch (err) {
      this.error = err as Error;
    }
  }
}

export const taskStore = new TaskStore();
```

### 6. WebSocket通信

リアルタイムアップデートのためのWebSocket実装：

```typescript
// lib/websocket/websocket.svelte.ts
export class WebSocketConnection {
  // リアクティブな状態
  connected = $state(false);
  messages = $state<WebSocketMessage[]>([]);
  
  private ws: WebSocket | null = null;
  
  connect() {
    if (this.connected) return;
    
    this.ws = new WebSocket(API_ENDPOINTS.websocket);
    
    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      this.messages = [...this.messages, message];
      
      // タスク更新の処理
      if (message.type === 'task:update') {
        this.handleTaskUpdate(message.data);
      }
    };
  }
  
  subscribe(taskId: string) {
    if (this.connected) {
      this.send({ type: 'subscribe', taskId });
    }
  }
}
```

### 7. 型定義

TypeScriptによる厳密な型管理：

```typescript
// lib/types/api.ts
export interface TaskResponse {
  id: string;
  taskId: string;
  status: TaskStatus;
  instruction: string;
  createdAt: string;
  updatedAt: string;
  result?: any;
  error?: {
    message: string;
    code: string;
  };
}

export type TaskStatus = 
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface PaginationParams {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}
```

## レイアウトシステム

### 共通レイアウト

```svelte
<!-- routes/+layout.svelte -->
<script lang="ts">
  import '../app.css';
  import { Button } from '$lib/components/ui/button';
  import WebSocketProvider from '$lib/components/providers/websocket-provider.svelte';
  
  let { children } = $props();
  
  const navItems = [
    { href: '/', label: 'ホーム' },
    { href: '/tasks', label: 'タスク一覧' },
    { href: '/scheduler', label: 'スケジューラー' },
    { href: '/settings', label: '設定' }
  ];
</script>

<WebSocketProvider>
  <div class="h-screen flex flex-col overflow-hidden">
    <!-- ヘッダー -->
    <header class="border-b">
      <nav class="container mx-auto px-4 py-4">
        <div class="flex items-center justify-between">
          <a href="/" class="text-xl font-bold">CC-Anywhere</a>
          <div class="flex gap-2">
            {#each navItems as item}
              <Button href={item.href} variant="ghost" size="sm">
                {item.label}
              </Button>
            {/each}
          </div>
        </div>
      </nav>
    </header>
    
    <!-- メインコンテンツ -->
    <main class="flex-1 overflow-y-auto">
      <div class="container mx-auto px-4 py-8">
        {@render children?.()}
      </div>
    </main>
    
    <!-- フッター -->
    <footer class="border-t">
      <div class="container mx-auto px-4 py-4 text-center text-sm">
        CC-Anywhere © 2024
      </div>
    </footer>
  </div>
</WebSocketProvider>
```

## ビルドとデプロイ

### ビルド設定

```javascript
// svelte.config.js
import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      pages: 'build',
      assets: 'build',
      fallback: 'index.html', // SPAモード
      precompress: false,
      strict: true
    })
  }
};

export default config;
```

### ビルドプロセス

```bash
# 開発サーバー
npm run dev

# プロダクションビルド
npm run build

# ビルド後のファイルはbackend/webに配置
npm run build:integrate
```

## パフォーマンス最適化

### 1. コード分割

SvelteKitは自動的にルートベースのコード分割を行います：
- 各ページは個別のJSチャンクとして分割
- 共通コンポーネントは共有チャンクに

### 2. 遅延読み込み

```typescript
// 重いコンポーネントの遅延読み込み
const HeavyComponent = await import('$lib/components/HeavyComponent.svelte');
```

### 3. 画像最適化

```svelte
<!-- 静的アセットの最適化 -->
<img 
  src="/images/logo.webp" 
  alt="Logo"
  loading="lazy"
  width="200"
  height="50"
/>
```

## セキュリティ

### CSP（Content Security Policy）

```html
<!-- app.html -->
<meta http-equiv="Content-Security-Policy" 
  content="default-src 'self'; 
  script-src 'self' 'unsafe-inline'; 
  style-src 'self' 'unsafe-inline';">
```

### APIキー管理

```typescript
// lib/config/api.ts
export function getApiKey(): string | null {
  // LocalStorageから取得（開発環境）
  if (typeof window !== 'undefined') {
    return localStorage.getItem('apiKey');
  }
  return null;
}
```

## まとめ

CC-Anywhereのフロントエンドアーキテクチャの特徴：

1. **層構造の明確な分離**: プレゼンテーション、ビジネスロジック、API通信
2. **型安全性**: TypeScriptによる厳密な型管理
3. **リアクティブな状態管理**: Svelte 5のRunesによる効率的な更新
4. **コンポーネントの再利用性**: shadcn-svelteによる統一されたUI
5. **パフォーマンス**: コード分割と最適化されたビルド

次のドキュメントでは、実際のコンポーネント実装例を詳しく見ていきます。
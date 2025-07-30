# CC-Anywhere 実装例

このドキュメントでは、CC-Anywhereで実際に使用されているSvelte 5とshadcn-svelteの実装パターンを紹介します。

## 1. タスク一覧ページの実装

### 完全なコンポーネント例

`routes/tasks/+page.svelte`の実装を詳しく見てみましょう：

```svelte
<script lang="ts">
  import type { PageData } from './$types';
  import { Button } from '$lib/components/ui/button';
  import { Badge } from '$lib/components/ui/badge';
  import * as Card from '$lib/components/ui/card';
  import * as Table from '$lib/components/ui/table';
  import { format } from 'date-fns';
  import { ja } from 'date-fns/locale';
  import { Plus, RefreshCw, Eye, XCircle } from 'lucide-svelte';
  
  // Svelte 5: $props()でデータを受け取る
  let { data }: { data: PageData } = $props();
  
  // ステータスに応じたバッジのスタイル決定
  function getStatusVariant(status: string) {
    switch (status) {
      case 'completed': return 'default';
      case 'running': return 'secondary';
      case 'failed': return 'destructive';
      case 'cancelled': return 'outline';
      default: return 'secondary';
    }
  }
  
  // 日付のフォーマット（日本語対応）
  function formatDate(date: string | undefined) {
    if (!date) return '-';
    return format(new Date(date), 'yyyy/MM/dd HH:mm', { locale: ja });
  }
  
  // Svelte 5: onclick属性を使用（on:clickではない）
  function viewTask(taskId: string) {
    window.location.href = `/tasks/${taskId}`;
  }
  
  // 非同期処理の例
  async function cancelTask(taskId: string) {
    if (!confirm('このタスクをキャンセルしますか？')) return;
    
    try {
      const response = await fetch(`http://localhost:5000/api/tasks/${taskId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        window.location.reload();
      }
    } catch (error) {
      console.error('Failed to cancel task:', error);
    }
  }
</script>

<!-- UIの実装 -->
<div class="space-y-6">
  <!-- ページヘッダー -->
  <div class="flex justify-between items-center">
    <div>
      <h2 class="text-3xl font-bold tracking-tight">タスク一覧</h2>
      <p class="text-muted-foreground">実行中のタスクを管理</p>
    </div>
    <div class="flex gap-2">
      <!-- shadcn-svelteのButtonコンポーネント -->
      <Button variant="outline" onclick={refresh}>
        <RefreshCw class="mr-2 h-4 w-4" />
        更新
      </Button>
      <Button onclick={goToNewTask}>
        <Plus class="mr-2 h-4 w-4" />
        新しいタスク
      </Button>
    </div>
  </div>

  <!-- Cardコンポーネントでラップ -->
  <Card.Root>
    <Card.Header>
      <Card.Title>実行中のタスク</Card.Title>
      <Card.Description>
        {data.pagination?.total || 0} 件のタスク
      </Card.Description>
    </Card.Header>
    <Card.Content>
      <!-- Tableコンポーネント -->
      <Table.Root>
        <Table.Header>
          <Table.Row>
            <Table.Head>ステータス</Table.Head>
            <Table.Head>指示内容</Table.Head>
            <Table.Head>作成日時</Table.Head>
            <Table.Head>更新日時</Table.Head>
            <Table.Head class="text-right">操作</Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          <!-- Svelte 5: #if と #each ディレクティブ -->
          {#if data.tasks && data.tasks.length > 0}
            {#each data.tasks as task}
              <Table.Row>
                <Table.Cell>
                  <!-- Badgeコンポーネントで状態表示 -->
                  <Badge variant={getStatusVariant(task.status)}>
                    {task.status}
                  </Badge>
                </Table.Cell>
                <Table.Cell class="max-w-md truncate">
                  {task.instruction}
                </Table.Cell>
                <Table.Cell>
                  {formatDate(task.createdAt)}
                </Table.Cell>
                <Table.Cell>
                  {formatDate(task.updatedAt)}
                </Table.Cell>
                <Table.Cell class="text-right">
                  <div class="flex gap-2 justify-end">
                    <!-- アイコンボタン -->
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onclick={() => viewTask(task.taskId)}
                    >
                      <Eye class="h-4 w-4" />
                    </Button>
                    <!-- 条件付きレンダリング -->
                    {#if task.status === 'running' || task.status === 'pending'}
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onclick={() => cancelTask(task.taskId)}
                      >
                        <XCircle class="h-4 w-4" />
                      </Button>
                    {/if}
                  </div>
                </Table.Cell>
              </Table.Row>
            {/each}
          {:else}
            <Table.Row>
              <Table.Cell colspan={5} class="text-center text-muted-foreground">
                タスクがありません
              </Table.Cell>
            </Table.Row>
          {/if}
        </Table.Body>
      </Table.Root>
    </Card.Content>
  </Card.Root>
</div>
```

### 重要なポイント

1. **Svelte 5のイベントハンドリング**
   ```svelte
   <!-- ❌ Svelte 4の書き方（動作しない） -->
   <Button on:click={handleClick}>

   <!-- ✅ Svelte 5の書き方 -->
   <Button onclick={handleClick}>
   ```

2. **$props()でのデータ受け取り**
   ```svelte
   // PageDataの型情報を維持しながら受け取る
   let { data }: { data: PageData } = $props();
   ```

3. **shadcn-svelteコンポーネントの組み合わせ**
   - Card, Table, Button, Badgeを組み合わせて複雑なUIを構築
   - バリアントやサイズプロパティで見た目をカスタマイズ

## 2. データ取得パターン（+page.ts）

### SvelteKitのload関数

`routes/tasks/+page.ts`の実装：

```typescript
import type { PageLoad } from './$types';
import { taskService } from '$lib/services/task.service';
import { error } from '@sveltejs/kit';

// PageLoad型で型安全性を確保
export const load: PageLoad = async ({ url, fetch }) => {
  // URLパラメータの取得
  const page = Number(url.searchParams.get('page')) || 1;
  const limit = Number(url.searchParams.get('limit')) || 20;
  
  try {
    // サービス層を通じてAPIを呼び出し
    const response = await taskService.list({ 
      page, 
      limit 
    }, fetch); // fetchをサービスに渡す
    
    // データを返す（自動的に.svelteファイルで利用可能）
    return {
      tasks: response.data,
      pagination: response.pagination
    };
  } catch (err) {
    console.error('Failed to load tasks:', err);
    // エラーページへ遷移
    throw error(500, 'タスクの読み込みに失敗しました');
  }
};
```

### ポイント

1. **型安全性**: `PageLoad`型で戻り値の型が自動推論される
2. **エラーハンドリング**: `error()`関数でエラーページへ遷移
3. **サーバーサイドでも動作**: SSR有効時はサーバーで実行される

## 3. グローバルレイアウトの実装

### +layout.svelte

```svelte
<script lang="ts">
  import '../app.css';
  import { Button } from '$lib/components/ui/button';
  import { page } from '$app/stores';
  import { Wifi, WifiOff } from 'lucide-svelte';
  import WebSocketProvider from '$lib/components/providers/websocket-provider.svelte';
  import { useWebSocketStatus } from '$lib/hooks/use-websocket.svelte';
  
  // 子コンポーネントのスロット
  let { children } = $props();
  
  // WebSocket接続状態（リアクティブ）
  let wsStatus = $state<ReturnType<typeof useWebSocketStatus> | null>(null);
  
  // ナビゲーションメニュー
  const navItems = [
    { href: '/', label: 'ホーム' },
    { href: '/tasks', label: 'タスク一覧' },
    { href: '/scheduler', label: 'スケジューラー' },
    { href: '/settings', label: '設定' },
  ];
  
  // $effect: WebSocket状態の監視
  $effect(() => {
    wsStatus = useWebSocketStatus();
  });
</script>

<!-- 全体をプロバイダーでラップ -->
<WebSocketProvider>
  <div class="h-screen flex flex-col overflow-hidden">
    <!-- ヘッダー -->
    <header class="border-b">
      <div class="container mx-auto px-4 py-4">
        <nav class="flex items-center justify-between">
          <!-- ロゴとWebSocket状態表示 -->
          <div class="flex items-center gap-4">
            <a href="/" class="text-xl font-bold">
              CC-Anywhere
            </a>
            
            <!-- WebSocket接続インジケーター -->
            {#if wsStatus}
              <div class="flex items-center gap-2 text-sm">
                {#if wsStatus.connected}
                  <Wifi class="h-4 w-4 text-green-500" />
                  <span class="text-muted-foreground">
                    {wsStatus.authenticated ? '接続済み' : '認証中...'}
                  </span>
                {:else if wsStatus.connecting}
                  <Wifi class="h-4 w-4 text-yellow-500 animate-pulse" />
                  <span class="text-muted-foreground">接続中...</span>
                {:else}
                  <WifiOff class="h-4 w-4 text-destructive" />
                  <span class="text-muted-foreground">未接続</span>
                {/if}
              </div>
            {/if}
          </div>
          
          <!-- ナビゲーション -->
          <div class="flex gap-2">
            {#each navItems as item}
              <Button 
                href={item.href}
                variant={$page.url.pathname === item.href ? 'default' : 'ghost'}
                size="sm"
              >
                {item.label}
              </Button>
            {/each}
          </div>
        </nav>
      </div>
    </header>
    
    <!-- メインコンテンツ -->
    <main class="flex-1 overflow-y-auto">
      <div class="container mx-auto px-4 py-8">
        <!-- 子ページのコンテンツがここに入る -->
        {@render children?.()}
      </div>
    </main>
    
    <!-- フッター -->
    <footer class="border-t flex-shrink-0">
      <div class="container mx-auto px-4 py-4 text-center text-sm text-muted-foreground">
        CC-Anywhere © 2024
      </div>
    </footer>
  </div>
</WebSocketProvider>
```

### レイアウトの重要な概念

1. **プロバイダーパターン**: WebSocket接続を全ページで共有
2. **$page ストア**: 現在のページ情報を取得してアクティブなメニューを表示
3. **@render**: Svelte 5の新しいスロットレンダリング構文

## 4. サービス層の実装

### タスクサービス

`lib/services/task.service.ts`の実装パターン：

```typescript
import { apiClient } from '$lib/api/client';
import type { TaskRequest, TaskResponse, ListParams, ListResponse } from '$lib/types/api';

export const taskService = {
  // リスト取得（ページネーション対応）
  async list(params?: ListParams, customFetch?: typeof fetch) {
    const response = await apiClient.get<{
      tasks: TaskResponse[];
      total: number;
      limit: number;
      offset: number;
    }>('/api/tasks', { params }, customFetch);
    
    // レスポンスの正規化
    const tasks = response.tasks.map(task => ({
      ...task,
      id: task.taskId // バックエンドとの差異を吸収
    }));
    
    // フロントエンドで使いやすい形式に変換
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
  
  // 単一タスクの取得
  async get(taskId: string, customFetch?: typeof fetch): Promise<TaskResponse> {
    const task = await apiClient.get<TaskResponse>(
      `/api/tasks/${taskId}`, 
      {}, 
      customFetch
    );
    return { ...task, id: task.taskId };
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
      // フォールバック処理
      await apiClient.post(`/api/tasks/${taskId}/cancel`);
    }
  }
};
```

### サービス層の利点

1. **API通信の抽象化**: コンポーネントから直接APIを呼ばない
2. **データ変換**: バックエンドとフロントエンドの差異を吸収
3. **エラーハンドリング**: 一元的な処理
4. **型安全性**: TypeScriptによる型チェック

## 5. リアクティブな状態管理（Stores）

### Svelte 5のクラスベースストア

```typescript
// lib/stores/task.svelte.ts
import { taskService } from '$lib/services/task.service';
import type { TaskResponse } from '$lib/types/api';

class TaskStore {
  // $stateでリアクティブな状態を定義
  tasks = $state<TaskResponse[]>([]);
  loading = $state(false);
  error = $state<Error | null>(null);
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
  
  // タスクの追加（楽観的更新）
  async addTask(request: any) {
    try {
      const newTask = await taskService.create(request);
      // リストに即座に追加
      this.tasks = [newTask, ...this.tasks];
    } catch (err) {
      this.error = err as Error;
      // エラー時は元に戻す
      await this.fetchTasks();
    }
  }
}

// シングルトンインスタンス
export const taskStore = new TaskStore();
```

### ストアの使用例

```svelte
<script lang="ts">
  import { taskStore } from '$lib/stores/task.svelte';
  
  // ストアの値に直接アクセス（自動的にリアクティブ）
  const { tasks, loading, error } = taskStore;
  
  // コンポーネントマウント時にデータ取得
  $effect(() => {
    taskStore.fetchTasks();
  });
</script>

{#if loading}
  <p>読み込み中...</p>
{:else if error}
  <p>エラー: {error.message}</p>
{:else}
  <ul>
    {#each tasks as task}
      <li>{task.instruction}</li>
    {/each}
  </ul>
{/if}
```

## 6. フォーム処理の実装

### 検索フォームの例

```svelte
<script lang="ts">
  import { Input } from '$lib/components/ui/input';
  import { Button } from '$lib/components/ui/button';
  import { Select } from '$lib/components/ui/select';
  import { Search } from 'lucide-svelte';
  
  // フォームの状態
  let searchTerm = $state('');
  let statusFilter = $state('all');
  let isSearching = $state(false);
  
  // リアルタイム検索（デバウンス付き）
  let debounceTimer: number;
  
  $effect(() => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      if (searchTerm.length > 2) {
        performSearch();
      }
    }, 300);
    
    return () => clearTimeout(debounceTimer);
  });
  
  async function performSearch() {
    isSearching = true;
    try {
      await taskStore.fetchTasks({
        search: searchTerm,
        status: statusFilter !== 'all' ? statusFilter : undefined
      });
    } finally {
      isSearching = false;
    }
  }
  
  function handleSubmit(e: Event) {
    e.preventDefault();
    performSearch();
  }
</script>

<form onsubmit={handleSubmit} class="flex gap-2">
  <Input
    bind:value={searchTerm}
    placeholder="タスクを検索..."
    class="flex-1"
  />
  
  <Select.Root bind:value={statusFilter}>
    <Select.Trigger class="w-[180px]">
      <Select.Value placeholder="ステータス" />
    </Select.Trigger>
    <Select.Content>
      <Select.Item value="all">すべて</Select.Item>
      <Select.Item value="pending">待機中</Select.Item>
      <Select.Item value="running">実行中</Select.Item>
      <Select.Item value="completed">完了</Select.Item>
      <Select.Item value="failed">失敗</Select.Item>
    </Select.Content>
  </Select.Root>
  
  <Button type="submit" disabled={isSearching}>
    {#if isSearching}
      <RefreshCw class="h-4 w-4 animate-spin" />
    {:else}
      <Search class="h-4 w-4" />
    {/if}
  </Button>
</form>
```

## まとめ

CC-Anywhereの実装から学べる重要なパターン：

1. **Svelte 5の新機能活用**
   - Runesによる状態管理（$state, $props, $effect）
   - 新しいイベントハンドラー構文（onclick）
   - @renderによるスロット処理

2. **shadcn-svelteの実践的な使用**
   - 複数のコンポーネントを組み合わせた複雑なUI
   - バリアントとサイズによるカスタマイズ
   - Tailwind CSSとの統合

3. **アーキテクチャパターン**
   - サービス層によるAPI通信の抽象化
   - ストアによるグローバル状態管理
   - プロバイダーパターンによる共通機能の提供

4. **TypeScriptの活用**
   - 型安全なコンポーネントプロパティ
   - APIレスポンスの型定義
   - エラーハンドリング

これらのパターンを理解することで、保守性が高く、スケーラブルなSvelteアプリケーションを構築できます。
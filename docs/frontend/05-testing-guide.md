# Svelte 5 テストガイド

## テスト環境のセットアップ

CC-Anywhereでは、Vitestを使用してSvelte 5コンポーネントのテストを実装しています。

### 必要なパッケージ

```json
{
  "devDependencies": {
    "@testing-library/svelte": "^5.2.0",
    "@testing-library/user-event": "^14.5.2",
    "@sveltejs/vite-plugin-svelte": "^4.0.0",
    "jsdom": "^25.0.1",
    "vitest": "^2.1.2"
  }
}
```

### Vitest設定（vitest.config.ts）

```typescript
import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
  plugins: [sveltekit()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts'],
    alias: {
      '$lib': '/src/lib',
      '$app': '/src/app-mocks'
    }
  }
});
```

## Svelte 5コンポーネントのテストパターン

### 1. 基本的なコンポーネントテスト

```typescript
// tests/components/Button.test.ts
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { Button } from '$lib/components/ui/button';

describe('Button Component', () => {
  it('ボタンが正しくレンダリングされる', () => {
    render(Button, {
      props: {
        variant: 'default',
        children: 'クリック'
      }
    });
    
    const button = screen.getByRole('button', { name: 'クリック' });
    expect(button).toBeInTheDocument();
  });
  
  it('クリックイベントが発火する', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    
    render(Button, {
      props: {
        onclick: handleClick,
        children: 'クリック'
      }
    });
    
    const button = screen.getByRole('button');
    await user.click(button);
    
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
  
  it('無効状態で動作する', () => {
    render(Button, {
      props: {
        disabled: true,
        children: 'クリック'
      }
    });
    
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });
});
```

### 2. $propsを使用するコンポーネントのテスト

```typescript
// テスト対象コンポーネント: UserCard.svelte
/*
<script lang="ts">
  let { name, email, role = 'user' } = $props();
</script>

<div class="user-card">
  <h3>{name}</h3>
  <p>{email}</p>
  <span class="role">{role}</span>
</div>
*/

// tests/components/UserCard.test.ts
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import UserCard from '$lib/components/UserCard.svelte';

describe('UserCard Component', () => {
  it('ユーザー情報が表示される', () => {
    render(UserCard, {
      props: {
        name: '田中太郎',
        email: 'tanaka@example.com',
        role: 'admin'
      }
    });
    
    expect(screen.getByText('田中太郎')).toBeInTheDocument();
    expect(screen.getByText('tanaka@example.com')).toBeInTheDocument();
    expect(screen.getByText('admin')).toBeInTheDocument();
  });
  
  it('デフォルトロールが適用される', () => {
    render(UserCard, {
      props: {
        name: '鈴木花子',
        email: 'suzuki@example.com'
        // roleを指定しない
      }
    });
    
    expect(screen.getByText('user')).toBeInTheDocument();
  });
});
```

### 3. $stateを使用するコンポーネントのテスト

```typescript
// テスト対象: Counter.svelte
/*
<script lang="ts">
  let count = $state(0);
  
  function increment() {
    count++;
  }
  
  function decrement() {
    count--;
  }
</script>

<div>
  <button onclick={decrement}>-</button>
  <span>{count}</span>
  <button onclick={increment}>+</button>
</div>
*/

// tests/components/Counter.test.ts
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import Counter from '$lib/components/Counter.svelte';

describe('Counter Component', () => {
  it('カウンターが正しく動作する', async () => {
    const user = userEvent.setup();
    render(Counter);
    
    // 初期値の確認
    expect(screen.getByText('0')).toBeInTheDocument();
    
    // インクリメント
    const incrementBtn = screen.getByRole('button', { name: '+' });
    await user.click(incrementBtn);
    expect(screen.getByText('1')).toBeInTheDocument();
    
    // デクリメント
    const decrementBtn = screen.getByRole('button', { name: '-' });
    await user.click(decrementBtn);
    await user.click(decrementBtn);
    expect(screen.getByText('-1')).toBeInTheDocument();
  });
});
```

### 4. フォームコンポーネントのテスト

```typescript
// tests/components/LoginForm.test.ts
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import LoginForm from '$lib/components/LoginForm.svelte';

describe('LoginForm Component', () => {
  it('フォーム送信が正しく動作する', async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn();
    
    render(LoginForm, {
      props: {
        onsubmit: handleSubmit
      }
    });
    
    // フォーム入力
    const emailInput = screen.getByLabelText('メールアドレス');
    const passwordInput = screen.getByLabelText('パスワード');
    
    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'password123');
    
    // フォーム送信
    const submitButton = screen.getByRole('button', { name: 'ログイン' });
    await user.click(submitButton);
    
    // 送信ハンドラーが呼ばれたことを確認
    await waitFor(() => {
      expect(handleSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'test@example.com',
          password: 'password123'
        })
      );
    });
  });
  
  it('バリデーションエラーが表示される', async () => {
    const user = userEvent.setup();
    render(LoginForm);
    
    // 空のフォームを送信
    const submitButton = screen.getByRole('button', { name: 'ログイン' });
    await user.click(submitButton);
    
    // エラーメッセージの確認
    expect(screen.getByText('メールアドレスは必須です')).toBeInTheDocument();
    expect(screen.getByText('パスワードは必須です')).toBeInTheDocument();
  });
});
```

### 5. 非同期処理のテスト

```typescript
// tests/components/TaskList.test.ts
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/svelte';
import TaskList from '$lib/components/TaskList.svelte';
import * as taskService from '$lib/services/task.service';

// サービスのモック
vi.mock('$lib/services/task.service');

describe('TaskList Component', () => {
  it('タスク一覧が表示される', async () => {
    // モックデータ
    const mockTasks = [
      { id: '1', instruction: 'タスク1', status: 'completed' },
      { id: '2', instruction: 'タスク2', status: 'running' }
    ];
    
    vi.mocked(taskService.taskService.list).mockResolvedValue({
      data: mockTasks,
      pagination: { page: 1, limit: 20, total: 2, totalPages: 1 }
    });
    
    render(TaskList);
    
    // ローディング状態
    expect(screen.getByText('読み込み中...')).toBeInTheDocument();
    
    // データ表示を待つ
    await waitFor(() => {
      expect(screen.getByText('タスク1')).toBeInTheDocument();
      expect(screen.getByText('タスク2')).toBeInTheDocument();
    });
  });
  
  it('エラー処理が正しく動作する', async () => {
    vi.mocked(taskService.taskService.list).mockRejectedValue(
      new Error('ネットワークエラー')
    );
    
    render(TaskList);
    
    await waitFor(() => {
      expect(screen.getByText(/エラーが発生しました/)).toBeInTheDocument();
    });
  });
});
```

### 6. ストアのテスト

```typescript
// tests/stores/task.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { taskStore } from '$lib/stores/task.svelte';
import * as taskService from '$lib/services/task.service';

vi.mock('$lib/services/task.service');

describe('Task Store', () => {
  beforeEach(() => {
    // ストアをリセット
    taskStore.tasks = [];
    taskStore.loading = false;
    taskStore.error = null;
  });
  
  it('タスクの取得が正しく動作する', async () => {
    const mockTasks = [
      { id: '1', instruction: 'タスク1', status: 'completed' }
    ];
    
    vi.mocked(taskService.taskService.list).mockResolvedValue({
      data: mockTasks,
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 }
    });
    
    // 初期状態の確認
    expect(taskStore.tasks).toEqual([]);
    expect(taskStore.loading).toBe(false);
    
    // タスク取得
    const promise = taskStore.fetchTasks();
    
    // ローディング状態の確認
    expect(taskStore.loading).toBe(true);
    
    await promise;
    
    // 結果の確認
    expect(taskStore.tasks).toEqual(mockTasks);
    expect(taskStore.loading).toBe(false);
    expect(taskStore.error).toBe(null);
  });
  
  it('エラー処理が正しく動作する', async () => {
    const error = new Error('取得エラー');
    vi.mocked(taskService.taskService.list).mockRejectedValue(error);
    
    await taskStore.fetchTasks();
    
    expect(taskStore.error).toBe(error);
    expect(taskStore.tasks).toEqual([]);
    expect(taskStore.loading).toBe(false);
  });
});
```

## SvelteKitのload関数のテスト

```typescript
// tests/routes/tasks.test.ts
import { describe, it, expect, vi } from 'vitest';
import { load } from '$routes/tasks/+page';
import * as taskService from '$lib/services/task.service';

vi.mock('$lib/services/task.service');

describe('Tasks Page Load Function', () => {
  it('タスクデータを正しく読み込む', async () => {
    const mockData = {
      data: [{ id: '1', instruction: 'テスト' }],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 }
    };
    
    vi.mocked(taskService.taskService.list).mockResolvedValue(mockData);
    
    const result = await load({
      url: new URL('http://localhost/tasks?page=2&limit=10'),
      fetch: global.fetch
    });
    
    expect(taskService.taskService.list).toHaveBeenCalledWith(
      { page: 2, limit: 10 },
      global.fetch
    );
    
    expect(result).toEqual({
      tasks: mockData.data,
      pagination: mockData.pagination
    });
  });
  
  it('エラー時に500エラーをスローする', async () => {
    vi.mocked(taskService.taskService.list).mockRejectedValue(
      new Error('API Error')
    );
    
    await expect(load({
      url: new URL('http://localhost/tasks'),
      fetch: global.fetch
    })).rejects.toThrow('タスクの読み込みに失敗しました');
  });
});
```

## テストのベストプラクティス

### 1. テストの構造化

```typescript
describe('コンポーネント名', () => {
  describe('機能グループ', () => {
    it('具体的な動作', () => {
      // Arrange: セットアップ
      // Act: 実行
      // Assert: 検証
    });
  });
});
```

### 2. アクセシビリティを意識したテスト

```typescript
// ❌ 避けるべき例
const button = screen.getByText('送信');

// ✅ 推奨例
const button = screen.getByRole('button', { name: '送信' });
```

### 3. 非同期処理の適切な待機

```typescript
// ❌ 避けるべき例
setTimeout(() => {
  expect(screen.getByText('完了')).toBeInTheDocument();
}, 1000);

// ✅ 推奨例
await waitFor(() => {
  expect(screen.getByText('完了')).toBeInTheDocument();
});
```

### 4. モックの適切な使用

```typescript
// セットアップファイル（tests/setup.ts）
import { vi } from 'vitest';

// グローバルモック
global.fetch = vi.fn();

// SvelteKit関連のモック
vi.mock('$app/navigation', () => ({
  goto: vi.fn(),
  invalidate: vi.fn()
}));

vi.mock('$app/stores', () => ({
  page: {
    subscribe: vi.fn()
  }
}));
```

## デバッグ用ユーティリティ

```typescript
// コンポーネントの状態を確認
import { debug } from '@testing-library/svelte';

it('デバッグ例', () => {
  const { container } = render(MyComponent);
  
  // DOM構造を出力
  debug(container);
  
  // 特定の要素を出力
  debug(screen.getByRole('button'));
});
```

## まとめ

Svelte 5のテストにおける重要なポイント：

1. **Runesへの対応**: $state, $props, $effectを含むコンポーネントも通常通りテスト可能
2. **イベントハンドリング**: Svelte 5の新しいイベント構文（onclick）に対応
3. **非同期処理**: waitForを使用して適切に待機
4. **モックの活用**: サービス層やSvelteKitの機能を適切にモック
5. **アクセシビリティ**: roleベースのクエリを優先使用

これらのパターンを理解することで、信頼性の高いテストスイートを構築できます。
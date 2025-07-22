# Svelte 5 テストガイド

このドキュメントでは、CC-AnywhereフロントエンドのSvelte 5に準拠したテスト方法について説明します。

## 目次

1. [セットアップ](#セットアップ)
2. [基本的なコンポーネントテスト](#基本的なコンポーネントテスト)
3. [Svelte 5 Runesのテスト](#svelte-5-runesのテスト)
4. [イベントハンドリングのテスト](#イベントハンドリングのテスト)
5. [ストアのテスト](#ストアのテスト)
6. [非同期処理のテスト](#非同期処理のテスト)
7. [ベストプラクティス](#ベストプラクティス)

## セットアップ

### 必要なパッケージ

```json
{
  "devDependencies": {
    "vitest": "^3.2.4",
    "@testing-library/svelte": "^5.2.8",
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/user-event": "^14.6.1",
    "jsdom": "^26.0.0"
  }
}
```

### Vitest設定

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';
import { svelteTesting } from '@testing-library/svelte/vite';

export default defineConfig({
  plugins: [sveltekit(), svelteTesting()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest-setup.ts'],
    include: ['src/**/*.{test,spec}.{js,ts}']
  }
});
```

## 基本的なコンポーネントテスト

### シンプルなコンポーネント

```typescript
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import MyComponent from './MyComponent.svelte';

describe('MyComponent', () => {
  it('正しくレンダリングされる', () => {
    const { getByText } = render(MyComponent, {
      props: {
        title: 'Hello World'
      }
    });
    
    expect(getByText('Hello World')).toBeInTheDocument();
  });
});
```

### スロット付きコンポーネント

```typescript
import { render } from '@testing-library/svelte';
import Button from './Button.svelte';

it('スロットコンテンツを表示', () => {
  const { getByText } = render(Button, {
    props: {
      children: () => 'Click me'
    }
  });
  
  expect(getByText('Click me')).toBeInTheDocument();
});
```

## Svelte 5 Runesのテスト

### $stateのテスト

```typescript
import { flushSync } from 'svelte';

// ストアやコンポーネント内の$stateをテスト
function createCounter() {
  let count = $state(0);
  
  return {
    get count() { return count; },
    increment() { count++; },
    decrement() { count--; }
  };
}

it('$stateが正しく更新される', () => {
  const counter = createCounter();
  
  expect(counter.count).toBe(0);
  
  counter.increment();
  flushSync(); // 状態更新を同期的にフラッシュ
  
  expect(counter.count).toBe(1);
});
```

### $derivedのテスト

```typescript
function createStore() {
  let items = $state<string[]>([]);
  const itemCount = $derived(items.length);
  const hasItems = $derived(items.length > 0);
  
  return {
    get items() { return items; },
    get itemCount() { return itemCount; },
    get hasItems() { return hasItems; },
    addItem(item: string) { items = [...items, item]; }
  };
}

it('$derivedが自動的に更新される', () => {
  const store = createStore();
  
  expect(store.itemCount).toBe(0);
  expect(store.hasItems).toBe(false);
  
  store.addItem('item1');
  flushSync();
  
  expect(store.itemCount).toBe(1);
  expect(store.hasItems).toBe(true);
});
```

## イベントハンドリングのテスト

### 基本的なイベント

```typescript
import { fireEvent } from '@testing-library/svelte';
import { vi } from 'vitest';

it('クリックイベントが発火する', async () => {
  const handleClick = vi.fn();
  
  const { getByRole } = render(Button, {
    props: { onclick: handleClick }
  });
  
  const button = getByRole('button');
  await fireEvent.click(button);
  
  expect(handleClick).toHaveBeenCalledTimes(1);
});
```

### userEventを使用した高度なインタラクション

```typescript
import userEvent from '@testing-library/user-event';

it('キーボード操作をテスト', async () => {
  const user = userEvent.setup();
  const handleSubmit = vi.fn();
  
  const { getByRole } = render(Form, {
    props: { onsubmit: handleSubmit }
  });
  
  const input = getByRole('textbox');
  
  // フォーカスしてテキストを入力
  await user.click(input);
  await user.type(input, 'Test text');
  await user.keyboard('{Enter}');
  
  expect(handleSubmit).toHaveBeenCalled();
});
```

## ストアのテスト

### WebSocketストアの例

```typescript
import { WebSocketConnection } from './websocket.svelte';

describe('WebSocketConnection', () => {
  let ws: WebSocketConnection;
  
  beforeEach(() => {
    // WebSocketのモック
    global.WebSocket = MockWebSocket as any;
    ws = new WebSocketConnection('ws://localhost:5000');
  });
  
  it('メッセージを受信して保存', async () => {
    ws.connect();
    await new Promise(resolve => setTimeout(resolve, 10));
    
    const mockMessage = {
      type: 'task:created',
      taskId: 'task-1',
      data: { status: 'running' }
    };
    
    // メッセージイベントをシミュレート
    const mockWs = ws['ws'] as MockWebSocket;
    mockWs.onmessage?.(new MessageEvent('message', {
      data: JSON.stringify(mockMessage)
    }));
    
    expect(ws.messages).toHaveLength(1);
    expect(ws.messages[0]).toEqual(expect.objectContaining(mockMessage));
  });
});
```

## 非同期処理のテスト

### API呼び出しのモック

```typescript
import { vi } from 'vitest';
import { taskService } from './task.service';

vi.mock('$lib/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn()
  }
}));

it('タスク一覧を取得', async () => {
  const mockTasks = [
    { id: '1', title: 'Task 1' },
    { id: '2', title: 'Task 2' }
  ];
  
  vi.mocked(apiClient.get).mockResolvedValueOnce({
    data: mockTasks
  });
  
  const result = await taskService.list();
  
  expect(result.data).toEqual(mockTasks);
  expect(apiClient.get).toHaveBeenCalledWith('/api/tasks');
});
```

## ベストプラクティス

### 1. コンポーネントの分離

複雑なロジックはコンポーネントから分離してテストしやすくする：

```typescript
// logic.ts - ビジネスロジック
export function validateForm(data: FormData) {
  // バリデーションロジック
}

// Component.svelte - UIコンポーネント
<script>
  import { validateForm } from './logic';
  // UIロジックのみ
</script>
```

### 2. テストヘルパーの活用

共通のテストパターンをヘルパー関数として抽出：

```typescript
// test-utils.ts
export function renderWithContext(component, props = {}) {
  return render(component, {
    props: {
      ...defaultProps,
      ...props
    }
  });
}
```

### 3. 非同期処理の適切な待機

```typescript
// 状態更新を待つ
import { tick } from 'svelte';
await tick();

// または同期的にフラッシュ
import { flushSync } from 'svelte';
flushSync();
```

### 4. アクセシビリティを考慮したテスト

```typescript
// ロールベースの要素選択を優先
const button = getByRole('button', { name: 'Submit' });

// aria属性の確認
expect(button).toHaveAttribute('aria-pressed', 'true');
```

### 5. スナップショットテストの活用

```typescript
it('コンポーネントの構造が変更されていない', () => {
  const { container } = render(ComplexComponent);
  expect(container).toMatchSnapshot();
});
```

## 参考リンク

- [Svelte Testing Documentation](https://svelte.dev/docs/svelte/testing)
- [Testing Library Svelte](https://testing-library.com/docs/svelte-testing-library/intro)
- [Vitest Documentation](https://vitest.dev/)
# フロントエンド状態管理ガイド

## 概要

cc-anywhereフロントエンドは、Svelte 5のRunesを活用した統一的な状態管理アーキテクチャを採用しています。

## アーキテクチャ

```
┌─────────────────┐
│   Components    │
└────────┬────────┘
         │
┌────────▼────────┐
│     Stores      │ ← WebSocket Events
└────────┬────────┘
         │
┌────────▼────────┐
│    Services     │
└────────┬────────┘
         │
┌────────▼────────┐
│   API Client    │
└─────────────────┘
```

## 主要コンポーネント

### 1. EntityStore ファクトリー

統一されたCRUD操作とWebSocket統合を提供する基底ストア。

```typescript
import { createEntityStore } from '$lib/stores/factory.svelte';
import { myService } from '$lib/services/my.service';

class MyStore extends createEntityStore<MyEntity>('my', myService) {
  // カスタムロジックを追加
}
```

#### 提供される機能
- **状態管理**: `items`, `selectedId`, `loading`, `error`
- **派生値**: `selected`, `count`, `isEmpty`
- **CRUD操作**: `load()`, `getById()`, `create()`, `update()`, `delete()`
- **WebSocket統合**: 自動的な更新処理

### 2. 設定管理

環境変数とアプリケーション設定の統一管理。

```typescript
import { getConfig } from '$lib/config';

const config = getConfig();
console.log(config.api.baseUrl); // 環境変数から取得
```

### 3. WebSocket強化ストア

自動再接続、メッセージキューイング、エラーハンドリングを備えたWebSocket管理。

```typescript
import { getWebSocketStore } from '$lib/stores/websocket-enhanced.svelte';

const ws = getWebSocketStore();
ws.connect();

// メッセージハンドラー登録
const cleanup = ws.on('task:update', (message) => {
  console.log('Task updated:', message.payload);
});
```

### 4. メッセージルーター

型安全なWebSocketメッセージのルーティング。

```typescript
import { getGlobalMessageRouter } from '$lib/stores/message-router.svelte';

const router = getGlobalMessageRouter();

// 完全一致
router.register('task.created', handler);

// パターンマッチング
router.registerPattern('task:*', handler);
```

## 実装例

### 新しいストアの作成

```typescript
// 1. サービスを作成
export class ProductService implements EntityService<Product> {
  async list(params?: any): Promise<Product[]> {
    const response = await apiClient.get('/api/products', { params });
    return response.data;
  }
  // ... 他のCRUDメソッド
}

// 2. ストアを作成
class ProductStore extends createEntityStore<Product>('product', productService) {
  // カスタムメソッドを追加
  async toggleFavorite(productId: string): Promise<void> {
    const product = this.findById(productId);
    if (product) {
      await this.update(productId, { isFavorite: !product.isFavorite });
    }
  }
  
  // カスタムWebSocketハンドラー
  override handleCustomMessage(message: WebSocketMessage): void {
    if (message.type === 'product:price-updated') {
      this.updateLocal(message.payload.id, {
        price: message.payload.newPrice
      });
    }
  }
}

// 3. シングルトンインスタンスをエクスポート
export const productStore = new ProductStore();
```

### コンポーネントでの使用

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { productStore } from '$lib/stores/product.svelte';
  
  onMount(() => {
    productStore.load();
  });
</script>

{#if productStore.loading}
  <p>読み込み中...</p>
{:else if productStore.error}
  <p>エラー: {productStore.error.message}</p>
{:else}
  <ul>
    {#each productStore.items as product}
      <li>{product.name}</li>
    {/each}
  </ul>
{/if}
```

## パフォーマンス最適化

### 1. Immutableな更新

`$lib/utils/immutable`の関数を使用して、不要な再レンダリングを防ぎます。

```typescript
import { updateArray } from '$lib/utils/immutable';

// 配列の更新
this.items = updateArray(
  this.items,
  item => item.id === targetId,
  item => ({ ...item, status: 'completed' })
);
```

### 2. デバウンスとスロットル

頻繁な更新を制御します。

```typescript
import { debounce, throttle } from '$lib/utils/performance';

// 検索入力のデバウンス
const debouncedSearch = debounce((query: string) => {
  productStore.load({ search: query });
}, 300);

// スクロールイベントのスロットル
const throttledScroll = throttle(() => {
  updateScrollPosition();
}, 100);
```

### 3. メモ化

高コストな計算をキャッシュします。

```typescript
import { memoize } from '$lib/utils/performance';

const expensiveCalculation = memoize((items: Product[]) => {
  return items.reduce((sum, item) => sum + item.price, 0);
});
```

## ベストプラクティス

### 1. ストアの責任範囲
- 1つのストアは1つのドメインに集中
- ビジネスロジックはストア内に実装
- UIロジックはコンポーネントに保持

### 2. エラーハンドリング
- ストアレベルでエラーをキャッチ
- ユーザーフレンドリーなエラーメッセージ
- 自動リトライの実装

### 3. WebSocket統合
- メッセージタイプの命名規則を統一
- オフライン時の動作を考慮
- 楽観的更新の実装

### 4. テスト
- ストアのユニットテスト
- WebSocketモックを使用した統合テスト
- パフォーマンステストの実施

## トラブルシューティング

### 状態が更新されない
- Svelte 5のReactivityルールを確認
- Immutableな更新を使用しているか確認
- WebSocketメッセージが正しく処理されているか確認

### パフォーマンスの問題
- 不要な再レンダリングを特定
- 大量データには仮想スクロールを使用
- メモ化を活用

### WebSocket接続の問題
- ブラウザの開発者ツールでネットワークを確認
- 再接続ロジックが動作しているか確認
- エラーログを確認

## 移行ガイド

既存のストアを新しいアーキテクチャに移行する手順：

1. EntityServiceインターフェースを実装したサービスを作成
2. createEntityStoreを継承した新しいストアを作成
3. カスタムロジックを移植
4. WebSocketハンドラーを更新
5. コンポーネントの参照を更新
6. テストを実行して動作確認

## 参考資料

- [Svelte 5 Runes Documentation](https://svelte.dev/docs/svelte/v5-runes)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API)
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createEntityStore, type EntityService } from '../factory.svelte';

// モックエンティティ
interface TestEntity {
  id: string;
  name: string;
  value: number;
}

// モックサービス
class MockService implements EntityService<TestEntity> {
  async list(): Promise<TestEntity[]> {
    return [
      { id: '1', name: 'Item 1', value: 100 },
      { id: '2', name: 'Item 2', value: 200 },
    ];
  }
  
  async get(id: string): Promise<TestEntity> {
    return { id, name: `Item ${id}`, value: parseInt(id) * 100 };
  }
  
  async create(data: Partial<TestEntity>): Promise<TestEntity> {
    return { id: '3', name: 'Item 3', value: 300, ...data };
  }
  
  async update(id: string, data: Partial<TestEntity>): Promise<TestEntity> {
    const existing = await this.get(id);
    return { ...existing, ...data };
  }
  
  async delete(_id: string): Promise<void> {
    // No-op
  }
}

describe('EntityStore Factory', () => {
  let TestStore: ReturnType<typeof createEntityStore<TestEntity>>;
  let store: InstanceType<typeof TestStore>;
  let mockService: MockService;
  
  beforeEach(() => {
    mockService = new MockService();
    TestStore = createEntityStore<TestEntity>('test', mockService);
    store = new TestStore();
  });
  
  it('should initialize with empty state', () => {
    expect(store.items).toEqual([]);
    expect(store.selectedId).toBe(null);
    expect(store.loading).toBe(false);
    expect(store.error).toBe(null);
  });
  
  it('should load items', async () => {
    await store.load();
    
    expect(store.items).toHaveLength(2);
    expect(store.items[0]).toEqual({ id: '1', name: 'Item 1', value: 100 });
    expect(store.loading).toBe(false);
  });
  
  it('should get item by id', async () => {
    const item = await store.getById('1');
    
    expect(item).toEqual({ id: '1', name: 'Item 1', value: 100 });
    expect(store.items).toContainEqual(item);
  });
  
  it('should create new item', async () => {
    const newItem = await store.create({ name: 'New Item' });
    
    expect(newItem).toBeDefined();
    expect(newItem?.id).toBe('3');
    expect(store.items).toContainEqual(newItem);
  });
  
  it('should update item', async () => {
    // まずアイテムを追加
    await store.load();
    
    const updated = await store.update('1', { value: 500 });
    
    expect(updated).toBeDefined();
    expect(updated?.value).toBe(500); // updateに渡した値
    
    const found = store.findById('1');
    expect(found?.value).toBe(500);
  });
  
  it('should delete item', async () => {
    await store.load();
    expect(store.items).toHaveLength(2);
    
    const success = await store.delete('1');
    
    expect(success).toBe(true);
    expect(store.items).toHaveLength(1);
    expect(store.findById('1')).toBeUndefined();
  });
  
  it('should handle selection', () => {
    store.select('1');
    expect(store.selectedId).toBe('1');
    
    store.select(null);
    expect(store.selectedId).toBe(null);
  });
  
  it('should update locally without API call', async () => {
    await store.load();
    
    store.updateLocal('1', { value: 999 });
    
    const item = store.findById('1');
    expect(item?.value).toBe(999);
  });
  
  it('should handle WebSocket updates', () => {
    store.items = [{ id: '1', name: 'Item 1', value: 100 }];
    
    // Created
    store.handleWebSocketUpdate({
      type: 'test.created',
      payload: { id: '2', name: 'Item 2', value: 200 }
    });
    expect(store.items).toHaveLength(2);
    
    // Updated
    store.handleWebSocketUpdate({
      type: 'test.updated',
      payload: { id: '1', value: 500 }
    });
    expect(store.findById('1')?.value).toBe(500);
    
    // Deleted
    store.handleWebSocketUpdate({
      type: 'test.deleted',
      payload: { id: '2' }
    });
    expect(store.items).toHaveLength(1);
    expect(store.findById('2')).toBeUndefined();
  });
  
  it('should handle errors', async () => {
    // エラーを発生させるモック
    vi.spyOn(mockService, 'list').mockRejectedValueOnce(new Error('API Error'));
    
    await store.load();
    
    expect(store.error).toBeDefined();
    expect(store.error?.message).toBe('API Error');
    expect(store.loading).toBe(false);
  });
  
  it('should provide derived values', async () => {
    expect(store.count).toBe(0);
    expect(store.isEmpty).toBe(true);
    
    await store.load();
    
    expect(store.count).toBe(2);
    expect(store.isEmpty).toBe(false);
    
    store.select('1');
    expect(store.selected).toBeDefined();
    expect(store.selected?.id).toBe('1');
  });
  
  it('should clear and reset', async () => {
    await store.load();
    store.select('1');
    
    store.clear();
    
    expect(store.items).toEqual([]);
    expect(store.selectedId).toBe(null);
    expect(store.error).toBe(null);
    
    store.reset();
    expect(store.loading).toBe(false);
  });
});
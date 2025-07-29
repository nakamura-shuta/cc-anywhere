import { updateArray, replaceInArray, removeFromArray, prependToArray } from '$lib/utils/immutable';

export interface EntityService<T> {
  list(params?: any): Promise<T[]>;
  get(id: string): Promise<T>;
  create(data: Partial<T>): Promise<T>;
  update(id: string, data: Partial<T>): Promise<T>;
  delete(id: string): Promise<void>;
}

export interface WebSocketMessage {
  type: string;
  payload: any;
}

/**
 * 統一されたエンティティストアを作成するファクトリー関数
 * @param name ストア名（デバッグ用）
 * @param service エンティティサービス
 * @returns エンティティストアクラス
 */
export function createEntityStore<T extends { id: string }>(
  name: string,
  service: EntityService<T>
) {
  return class EntityStore {
    // 状態管理
    items = $state<T[]>([]);
    selectedId = $state<string | null>(null);
    loading = $state(false);
    error = $state<Error | null>(null);
    
    // 派生値
    selected = $derived(
      this.items.find(item => item.id === this.selectedId) || null
    );
    
    count = $derived(this.items.length);
    
    isEmpty = $derived(this.items.length === 0);
    
    // 初期化
    constructor() {
      console.log(`[${name}Store] Initialized`);
    }
    
    // 共通CRUD操作
    async load(params?: any): Promise<void> {
      try {
        this.loading = true;
        this.error = null;
        const data = await service.list(params);
        this.items = data;
      } catch (err) {
        this.error = err instanceof Error ? err : new Error('Failed to load items');
        console.error(`[${name}Store] Load error:`, err);
      } finally {
        this.loading = false;
      }
    }
    
    async getById(id: string): Promise<T | null> {
      try {
        this.loading = true;
        this.error = null;
        const item = await service.get(id);
        // 既存のアイテムを更新または追加
        const index = this.items.findIndex(i => i.id === id);
        if (index >= 0) {
          this.items = replaceInArray(this.items, index, item);
        } else {
          this.items = [...this.items, item];
        }
        return item;
      } catch (err) {
        this.error = err instanceof Error ? err : new Error('Failed to get item');
        console.error(`[${name}Store] Get error:`, err);
        return null;
      } finally {
        this.loading = false;
      }
    }
    
    async create(data: Partial<T>): Promise<T | null> {
      try {
        this.loading = true;
        this.error = null;
        const item = await service.create(data);
        this.items = prependToArray(this.items, item);
        return item;
      } catch (err) {
        this.error = err instanceof Error ? err : new Error('Failed to create item');
        console.error(`[${name}Store] Create error:`, err);
        return null;
      } finally {
        this.loading = false;
      }
    }
    
    async update(id: string, data: Partial<T>): Promise<T | null> {
      try {
        this.loading = true;
        this.error = null;
        const updated = await service.update(id, data);
        this.items = updateArray(
          this.items,
          item => item.id === id,
          () => updated
        );
        return updated;
      } catch (err) {
        this.error = err instanceof Error ? err : new Error('Failed to update item');
        console.error(`[${name}Store] Update error:`, err);
        return null;
      } finally {
        this.loading = false;
      }
    }
    
    async delete(id: string): Promise<boolean> {
      try {
        this.loading = true;
        this.error = null;
        await service.delete(id);
        this.items = removeFromArray(this.items, item => item.id === id);
        if (this.selectedId === id) {
          this.selectedId = null;
        }
        return true;
      } catch (err) {
        this.error = err instanceof Error ? err : new Error('Failed to delete item');
        console.error(`[${name}Store] Delete error:`, err);
        return false;
      } finally {
        this.loading = false;
      }
    }
    
    // 選択管理
    select(id: string | null): void {
      this.selectedId = id;
    }
    
    // ローカル更新（API呼び出しなし）
    updateLocal(id: string, data: Partial<T>): void {
      this.items = updateArray(
        this.items,
        item => item.id === id,
        item => ({ ...item, ...data })
      );
    }
    
    // WebSocket更新の統一処理
    handleWebSocketUpdate(message: WebSocketMessage): void {
      const { type, payload } = message;
      
      switch (type) {
        case `${name}.created`:
          if (!this.items.find(item => item.id === payload.id)) {
            this.items = [...this.items, payload];
          }
          break;
          
        case `${name}.updated`:
          this.updateLocal(payload.id, payload);
          break;
          
        case `${name}.deleted`:
          this.items = removeFromArray(this.items, item => item.id === payload.id);
          if (this.selectedId === payload.id) {
            this.selectedId = null;
          }
          break;
          
        default:
          // カスタムハンドラーで処理
          this.handleCustomMessage?.(message);
      }
    }
    
    // サブクラスでオーバーライド可能
    handleCustomMessage?(message: WebSocketMessage): void;
    
    // ユーティリティメソッド
    findById(id: string): T | undefined {
      return this.items.find(item => item.id === id);
    }
    
    clear(): void {
      this.items = [];
      this.selectedId = null;
      this.error = null;
    }
    
    reset(): void {
      this.clear();
      this.loading = false;
    }
  };
}
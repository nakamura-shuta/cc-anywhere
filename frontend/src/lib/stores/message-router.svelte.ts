import type { WebSocketMessage } from './websocket-enhanced.svelte';

export type MessageHandler = (message: WebSocketMessage) => void | Promise<void>;

export interface RoutePattern {
  pattern: string | RegExp;
  handler: MessageHandler;
  priority?: number;
}

/**
 * WebSocketメッセージの統一ルーティング
 */
export class MessageRouter {
  private routes: RoutePattern[] = [];
  private handlers = new Map<string, Set<MessageHandler>>();
  
  /**
   * メッセージハンドラーの登録（完全一致）
   */
  register(type: string, handler: MessageHandler): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    
    this.handlers.get(type)!.add(handler);
    
    // クリーンアップ関数
    return () => {
      this.handlers.get(type)?.delete(handler);
      if (this.handlers.get(type)?.size === 0) {
        this.handlers.delete(type);
      }
    };
  }
  
  /**
   * パターンマッチングハンドラーの登録
   */
  registerPattern(pattern: string | RegExp, handler: MessageHandler, priority = 0): () => void {
    const route: RoutePattern = { pattern, handler, priority };
    this.routes.push(route);
    
    // 優先度でソート
    this.routes.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    
    // クリーンアップ関数
    return () => {
      const index = this.routes.indexOf(route);
      if (index >= 0) {
        this.routes.splice(index, 1);
      }
    };
  }
  
  /**
   * メッセージのルーティング
   */
  async route(message: WebSocketMessage): Promise<void> {
    const { type } = message;
    
    // 完全一致のハンドラー
    const exactHandlers = this.handlers.get(type);
    if (exactHandlers) {
      for (const handler of exactHandlers) {
        try {
          await handler(message);
        } catch (error) {
          console.error(`[MessageRouter] Handler error for ${type}:`, error);
        }
      }
    }
    
    // パターンマッチング
    for (const route of this.routes) {
      let matches = false;
      
      if (typeof route.pattern === 'string') {
        // ワイルドカードサポート
        const regex = new RegExp(
          '^' + route.pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$'
        );
        matches = regex.test(type);
      } else {
        matches = route.pattern.test(type);
      }
      
      if (matches) {
        try {
          await route.handler(message);
        } catch (error) {
          console.error(`[MessageRouter] Pattern handler error for ${type}:`, error);
        }
      }
    }
  }
  
  /**
   * すべてのハンドラーをクリア
   */
  clear(): void {
    this.handlers.clear();
    this.routes = [];
  }
  
  /**
   * 登録されているハンドラーの数を取得
   */
  getHandlerCount(): number {
    let count = 0;
    this.handlers.forEach(set => count += set.size);
    return count + this.routes.length;
  }
  
  /**
   * デバッグ情報を取得
   */
  getDebugInfo(): {
    exactHandlers: string[];
    patterns: string[];
  } {
    return {
      exactHandlers: Array.from(this.handlers.keys()),
      patterns: this.routes.map(r => 
        typeof r.pattern === 'string' ? r.pattern : r.pattern.toString()
      )
    };
  }
}

// グローバルルーター
let globalRouter: MessageRouter | null = null;

export function getGlobalMessageRouter(): MessageRouter {
  if (!globalRouter) {
    globalRouter = new MessageRouter();
  }
  return globalRouter;
}

/**
 * ストア用のメッセージルーティングヘルパー
 */
export function createStoreRouter(storeName: string) {
  const router = getGlobalMessageRouter();
  
  return {
    // CRUD操作の自動登録
    registerCrud(handlers: {
      onCreate?: (payload: any) => void;
      onUpdate?: (payload: any) => void;
      onDelete?: (payload: any) => void;
    }) {
      const cleanups: (() => void)[] = [];
      
      if (handlers.onCreate) {
        cleanups.push(
          router.register(`${storeName}.created`, msg => handlers.onCreate!(msg.payload))
        );
      }
      
      if (handlers.onUpdate) {
        cleanups.push(
          router.register(`${storeName}.updated`, msg => handlers.onUpdate!(msg.payload))
        );
      }
      
      if (handlers.onDelete) {
        cleanups.push(
          router.register(`${storeName}.deleted`, msg => handlers.onDelete!(msg.payload))
        );
      }
      
      // すべてのクリーンアップ関数を返す
      return () => cleanups.forEach(fn => fn());
    },
    
    // カスタムハンドラーの登録
    register(type: string, handler: MessageHandler) {
      return router.register(type, handler);
    },
    
    // パターンハンドラーの登録
    registerPattern(pattern: string | RegExp, handler: MessageHandler, priority?: number) {
      return router.registerPattern(pattern, handler, priority);
    }
  };
}
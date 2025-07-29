/**
 * パフォーマンス最適化ユーティリティ
 */

/**
 * デバウンス関数
 * 指定時間内の連続呼び出しを最後の1回にまとめる
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: number | undefined;
  
  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    
    timeoutId = window.setTimeout(() => {
      fn(...args);
      timeoutId = undefined;
    }, delay);
  };
}

/**
 * スロットル関数
 * 指定時間内に1回だけ実行を許可
 */
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  let lastArgs: Parameters<T> | null = null;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      
      setTimeout(() => {
        inThrottle = false;
        if (lastArgs) {
          fn(...lastArgs);
          lastArgs = null;
        }
      }, limit);
    } else {
      lastArgs = args;
    }
  };
}

/**
 * メモ化関数
 * 同じ引数での呼び出し結果をキャッシュ
 */
export function memoize<T extends (...args: any[]) => any>(
  fn: T,
  keyFn?: (...args: Parameters<T>) => string
): T {
  const cache = new Map<string, ReturnType<T>>();
  
  return ((...args: Parameters<T>) => {
    const key = keyFn ? keyFn(...args) : JSON.stringify(args);
    
    if (cache.has(key)) {
      return cache.get(key)!;
    }
    
    const result = fn(...args);
    cache.set(key, result);
    
    // キャッシュサイズ制限（オプション）
    if (cache.size > 1000) {
      const firstKey = cache.keys().next().value;
      if (firstKey !== undefined) {
        cache.delete(firstKey);
      }
    }
    
    return result;
  }) as T;
}

/**
 * 遅延実行
 * アイドル時に実行
 */
export function defer(fn: () => void): void {
  if ('requestIdleCallback' in window) {
    requestIdleCallback(fn);
  } else {
    setTimeout(fn, 0);
  }
}

/**
 * バッチ処理
 * 複数の更新を1つにまとめる
 */
export class BatchProcessor<T> {
  private queue: T[] = [];
  private timeoutId?: number;
  
  constructor(
    private processor: (items: T[]) => void,
    private delay = 0
  ) {}
  
  add(item: T): void {
    this.queue.push(item);
    
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }
    
    this.timeoutId = window.setTimeout(() => {
      this.flush();
    }, this.delay);
  }
  
  flush(): void {
    if (this.queue.length === 0) return;
    
    const items = [...this.queue];
    this.queue = [];
    this.processor(items);
    
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = undefined;
    }
  }
  
  clear(): void {
    this.queue = [];
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = undefined;
    }
  }
}

/**
 * 仮想スクロール用のビューポート計算
 */
export interface VirtualScrollOptions {
  itemHeight: number;
  containerHeight: number;
  itemCount: number;
  overscan?: number;
}

export interface VirtualScrollResult {
  startIndex: number;
  endIndex: number;
  offsetY: number;
  totalHeight: number;
}

export function calculateVirtualScroll(
  scrollTop: number,
  options: VirtualScrollOptions
): VirtualScrollResult {
  const { itemHeight, containerHeight, itemCount, overscan = 3 } = options;
  
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    itemCount - 1,
    Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
  );
  
  return {
    startIndex,
    endIndex,
    offsetY: startIndex * itemHeight,
    totalHeight: itemCount * itemHeight
  };
}

/**
 * IntersectionObserverを使った遅延ローディング
 */
export function lazyLoad(
  element: HTMLElement,
  callback: () => void,
  options?: IntersectionObserverInit
): () => void {
  const observer = new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting) {
        callback();
        observer.disconnect();
      }
    },
    options
  );
  
  observer.observe(element);
  
  return () => observer.disconnect();
}
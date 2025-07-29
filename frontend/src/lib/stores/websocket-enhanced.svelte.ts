import { getWebSocketUrl } from '$lib/config';

export type WebSocketStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface WebSocketMessage {
  type: string;
  payload: any;
  timestamp?: number;
}

export type MessageHandler = (message: WebSocketMessage) => void;

/**
 * 強化されたWebSocket管理ストア
 * - 自動再接続
 * - メッセージキューイング
 * - エラーハンドリング
 */
export class EnhancedWebSocketStore {
  // 接続状態
  private socket: WebSocket | null = null;
  private reconnectTimer?: number;
  private heartbeatTimer?: number;
  private reconnectAttempts = 0;
  
  // メッセージキュー（オフライン時）
  private messageQueue: WebSocketMessage[] = [];
  
  // 設定
  private config = {
    url: getWebSocketUrl(),
    reconnectDelay: 1000,
    maxReconnectAttempts: 5,
    heartbeatInterval: 30000,
    maxQueueSize: 100,
  };
  
  // リアクティブ状態
  status = $state<WebSocketStatus>('disconnected');
  error = $state<Error | null>(null);
  isConnected = $derived(this.status === 'connected');
  
  // メッセージハンドラー
  private handlers = new Map<string, Set<MessageHandler>>();
  private globalHandlers = new Set<MessageHandler>();
  
  constructor() {
    console.log('[WebSocket] Store initialized');
  }
  
  /**
   * WebSocket接続を開始
   */
  connect(): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      console.log('[WebSocket] Already connected');
      return;
    }
    
    this.disconnect();
    
    try {
      this.status = 'connecting';
      this.error = null;
      
      this.socket = new WebSocket(this.config.url);
      
      this.socket.onopen = this.handleOpen.bind(this);
      this.socket.onmessage = this.handleMessage.bind(this);
      this.socket.onerror = this.handleError.bind(this);
      this.socket.onclose = this.handleClose.bind(this);
      
    } catch {
      this.handleError(new Event('error'));
    }
  }
  
  /**
   * WebSocket接続を切断
   */
  disconnect(): void {
    this.clearTimers();
    
    if (this.socket) {
      this.socket.onopen = null;
      this.socket.onmessage = null;
      this.socket.onerror = null;
      this.socket.onclose = null;
      
      if (this.socket.readyState === WebSocket.OPEN) {
        this.socket.close();
      }
      
      this.socket = null;
    }
    
    this.status = 'disconnected';
    this.reconnectAttempts = 0;
  }
  
  /**
   * メッセージ送信
   */
  send(message: WebSocketMessage): boolean {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      // オフライン時はキューに追加
      if (this.config.maxQueueSize > 0 && this.messageQueue.length < this.config.maxQueueSize) {
        this.messageQueue.push({
          ...message,
          timestamp: Date.now()
        });
        console.log('[WebSocket] Message queued:', message.type);
        return true;
      }
      console.warn('[WebSocket] Cannot send message, not connected');
      return false;
    }
    
    try {
      this.socket.send(JSON.stringify(message));
      return true;
    } catch (err) {
      console.error('[WebSocket] Send error:', err);
      return false;
    }
  }
  
  /**
   * メッセージハンドラーの登録
   */
  on(type: string, handler: MessageHandler): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    
    this.handlers.get(type)!.add(handler);
    
    // クリーンアップ関数を返す
    return () => {
      this.handlers.get(type)?.delete(handler);
    };
  }
  
  /**
   * グローバルメッセージハンドラーの登録
   */
  onAny(handler: MessageHandler): () => void {
    this.globalHandlers.add(handler);
    
    return () => {
      this.globalHandlers.delete(handler);
    };
  }
  
  /**
   * 接続成功時の処理
   */
  private handleOpen(): void {
    console.log('[WebSocket] Connected');
    this.status = 'connected';
    this.error = null;
    this.reconnectAttempts = 0;
    
    // ハートビート開始
    this.startHeartbeat();
    
    // キューに溜まったメッセージを送信
    this.flushMessageQueue();
  }
  
  /**
   * メッセージ受信時の処理
   */
  private handleMessage(event: MessageEvent): void {
    try {
      const message: WebSocketMessage = JSON.parse(event.data);
      
      // pongメッセージは無視
      if (message.type === 'pong') {
        return;
      }
      
      // グローバルハンドラー
      this.globalHandlers.forEach(handler => {
        try {
          handler(message);
        } catch (err) {
          console.error('[WebSocket] Global handler error:', err);
        }
      });
      
      // タイプ別ハンドラー
      const handlers = this.handlers.get(message.type);
      if (handlers) {
        handlers.forEach(handler => {
          try {
            handler(message);
          } catch (err) {
            console.error(`[WebSocket] Handler error for ${message.type}:`, err);
          }
        });
      }
      
    } catch (err) {
      console.error('[WebSocket] Message parse error:', err);
    }
  }
  
  /**
   * エラー時の処理
   */
  private handleError(event: Event): void {
    console.error('[WebSocket] Error:', event);
    this.status = 'error';
    this.error = new Error('WebSocket connection error');
  }
  
  /**
   * 接続終了時の処理
   */
  private handleClose(event: CloseEvent): void {
    console.log('[WebSocket] Closed:', event.code, event.reason);
    this.status = 'disconnected';
    
    this.clearTimers();
    
    // 自動再接続
    if (!event.wasClean && this.reconnectAttempts < this.config.maxReconnectAttempts) {
      this.scheduleReconnect();
    }
  }
  
  /**
   * 再接続のスケジュール
   */
  private scheduleReconnect(): void {
    const delay = Math.min(
      this.config.reconnectDelay * Math.pow(2, this.reconnectAttempts),
      30000
    );
    
    console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1})`);
    
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectAttempts++;
      this.connect();
    }, delay);
  }
  
  /**
   * ハートビート開始
   */
  private startHeartbeat(): void {
    this.heartbeatTimer = window.setInterval(() => {
      if (this.socket?.readyState === WebSocket.OPEN) {
        this.send({ type: 'ping', payload: {} });
      }
    }, this.config.heartbeatInterval);
  }
  
  /**
   * キューに溜まったメッセージを送信
   */
  private flushMessageQueue(): void {
    if (this.messageQueue.length === 0) return;
    
    console.log(`[WebSocket] Flushing ${this.messageQueue.length} queued messages`);
    
    const queue = [...this.messageQueue];
    this.messageQueue = [];
    
    queue.forEach(message => {
      this.send(message);
    });
  }
  
  /**
   * タイマーのクリア
   */
  private clearTimers(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
    
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
  }
  
  /**
   * 設定の更新
   */
  updateConfig(config: Partial<typeof this.config>): void {
    this.config = { ...this.config, ...config };
    
    // URLが変更された場合は再接続
    if (config.url && this.isConnected) {
      this.disconnect();
      this.connect();
    }
  }
  
  /**
   * クリーンアップ
   */
  destroy(): void {
    this.disconnect();
    this.handlers.clear();
    this.globalHandlers.clear();
    this.messageQueue = [];
  }
}

// シングルトンインスタンス
let websocketStore: EnhancedWebSocketStore | null = null;

export function getWebSocketStore(): EnhancedWebSocketStore {
  if (!websocketStore) {
    websocketStore = new EnhancedWebSocketStore();
  }
  return websocketStore;
}
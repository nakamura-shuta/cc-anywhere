// WebSocketクライアント

import { API_ENDPOINTS, getApiKey } from '$lib/config/api';

// WebSocketイベント
export type WebSocketEventType = 
	| 'task:created'
	| 'task:updated'
	| 'task:completed'
	| 'task:failed'
	| 'task:cancelled'
	| 'task:log'
	| 'task:progress'
	| 'worker:status'
	| 'system:health'
	| 'auth:success'
	| 'auth:error'
	| 'subscribe:success'
	| 'subscribe:error'
	| 'unsubscribe:success';

// WebSocketメッセージ
export interface WebSocketMessage {
	type: WebSocketEventType | string;
	taskId?: string;
	data?: any;
	error?: string;
	timestamp?: string;
}

// WebSocketクライアントのオプション
export interface WebSocketClientOptions {
	reconnectInterval?: number;
	maxReconnectAttempts?: number;
	heartbeatInterval?: number;
}

// WebSocketクライアント
export class WebSocketClient {
	private ws: WebSocket | null = null;
	private url: string;
	private options: Required<WebSocketClientOptions>;
	private reconnectAttempts = 0;
	private reconnectTimer?: ReturnType<typeof setTimeout>;
	private heartbeatTimer?: ReturnType<typeof setInterval>;
	private listeners = new Map<string, Set<(message: WebSocketMessage) => void>>();
	private connectionPromise: Promise<void> | null = null;
	
	// 接続状態
	public connected = $state(false);
	public connecting = $state(false);
	public authenticated = $state(false);
	public error = $state<Error | null>(null);
	
	// サブスクリプション管理
	private subscriptions = new Set<string>();
	
	constructor(url?: string, options: WebSocketClientOptions = {}) {
		this.url = url || API_ENDPOINTS.websocket;
		this.options = {
			reconnectInterval: options.reconnectInterval || 5000,
			maxReconnectAttempts: options.maxReconnectAttempts || 10,
			heartbeatInterval: options.heartbeatInterval || 30000
		};
	}
	
	// 接続
	async connect(): Promise<void> {
		if (this.connected || this.connecting) {
			return this.connectionPromise || Promise.resolve();
		}
		
		this.connecting = true;
		this.error = null;
		
		this.connectionPromise = new Promise((resolve, reject) => {
			try {
				this.ws = new WebSocket(this.url);
				
				this.ws.onopen = async () => {
					console.log('WebSocket connected');
					this.connected = true;
					this.connecting = false;
					this.reconnectAttempts = 0;
					this.startHeartbeat();
					
					// 認証
					const apiKey = getApiKey();
					if (apiKey) {
						this.send({ type: 'auth', apiKey });
					}
					
					// 再接続時、以前のサブスクリプションを復元
					if (this.subscriptions.size > 0) {
						const taskIds = Array.from(this.subscriptions);
						for (const taskId of taskIds) {
							this.send({ type: 'subscribe', taskId });
						}
					}
					
					resolve();
				};
				
				this.ws.onmessage = (event) => {
					try {
						const message: WebSocketMessage = JSON.parse(event.data);
						this.handleMessage(message);
					} catch (error) {
						console.error('Failed to parse WebSocket message:', error);
					}
				};
				
				this.ws.onerror = (error) => {
					console.error('WebSocket error:', error);
					this.error = new Error('WebSocket connection error');
				};
				
				this.ws.onclose = (event) => {
					console.log('WebSocket disconnected:', event.code, event.reason);
					this.connected = false;
					this.connecting = false;
					this.stopHeartbeat();
					
					// 正常終了でない場合は再接続を試みる
					if (event.code !== 1000 && event.code !== 1001) {
						this.scheduleReconnect();
					}
					
					if (!this.connected) {
						reject(new Error('WebSocket connection failed'));
					}
				};
			} catch (error) {
				this.connecting = false;
				this.error = error instanceof Error ? error : new Error('Unknown error');
				reject(error);
			}
		});
		
		return this.connectionPromise;
	}
	
	// 切断
	disconnect(): void {
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer);
			this.reconnectTimer = undefined;
		}
		
		this.stopHeartbeat();
		
		if (this.ws) {
			this.ws.close(1000, 'Client disconnecting');
			this.ws = null;
		}
		
		this.connected = false;
		this.connecting = false;
		this.connectionPromise = null;
	}
	
	// メッセージ送信
	send(message: any): void {
		if (!this.connected || !this.ws) {
			throw new Error('WebSocket is not connected');
		}
		
		this.ws.send(JSON.stringify(message));
	}
	
	// イベントリスナー登録
	on(event: WebSocketEventType, callback: (message: WebSocketMessage) => void): () => void {
		if (!this.listeners.has(event)) {
			this.listeners.set(event, new Set());
		}
		
		this.listeners.get(event)!.add(callback);
		
		// アンサブスクライブ関数を返す
		return () => {
			const listeners = this.listeners.get(event);
			if (listeners) {
				listeners.delete(callback);
			}
		};
	}
	
	// 全イベントリスナー登録
	onAny(callback: (message: WebSocketMessage) => void): () => void {
		return this.on('*' as WebSocketEventType, callback);
	}
	
	// メッセージハンドリング
	private handleMessage(message: WebSocketMessage): void {
		// 特定のイベントタイプのリスナーを実行
		const listeners = this.listeners.get(message.type);
		if (listeners) {
			listeners.forEach(callback => callback(message));
		}
		
		// 全イベントリスナーを実行
		const allListeners = this.listeners.get('*' as WebSocketEventType);
		if (allListeners) {
			allListeners.forEach(callback => callback(message));
		}
	}
	
	// 再接続スケジューリング
	private scheduleReconnect(): void {
		if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
			this.error = new Error('Max reconnection attempts reached');
			return;
		}
		
		this.reconnectAttempts++;
		console.log(`Scheduling reconnect attempt ${this.reconnectAttempts}/${this.options.maxReconnectAttempts}`);
		
		this.reconnectTimer = setTimeout(() => {
			this.connect().catch(error => {
				console.error('Reconnection failed:', error);
			});
		}, this.options.reconnectInterval);
	}
	
	// ハートビート開始
	private startHeartbeat(): void {
		this.heartbeatTimer = setInterval(() => {
			if (this.connected && this.ws && this.ws.readyState === WebSocket.OPEN) {
				this.send({ type: 'ping' });
			}
		}, this.options.heartbeatInterval);
	}
	
	// ハートビート停止
	private stopHeartbeat(): void {
		if (this.heartbeatTimer) {
			clearInterval(this.heartbeatTimer);
			this.heartbeatTimer = undefined;
		}
	}
}

// シングルトンインスタンス
export const wsClient = new WebSocketClient();
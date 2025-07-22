// WebSocketコンテキスト（Svelte 5 Runes使用）

import { getContext, setContext } from 'svelte';
import { API_ENDPOINTS, getApiKey } from '$lib/config/api';

// WebSocketメッセージ型
export interface WebSocketMessage {
	type: string;
	taskId?: string;
	data?: any;
	error?: string;
	timestamp?: string;
}

// WebSocketクラス（Svelte 5のリアクティブな状態管理）
export class WebSocketConnection {
	// リアクティブな状態
	connected = $state(false);
	connecting = $state(false);
	authenticated = $state(false);
	error = $state<Error | null>(null);
	
	// メッセージストリーム
	messages = $state<WebSocketMessage[]>([]);
	
	// タスクごとのメッセージ（タスクIDをキー）
	taskMessages = $state<Map<string, WebSocketMessage[]>>(new Map());
	
	// サブスクリプション
	subscriptions = $state<Set<string>>(new Set());
	
	// WebSocketインスタンス
	private ws: WebSocket | null = null;
	private url: string;
	private reconnectTimer?: number;
	private heartbeatTimer?: number;
	private reconnectAttempts = 0;
	
	// 派生状態
	get isReady() {
		return this.connected && this.authenticated;
	}
	
	get latestMessage() {
		return this.messages[this.messages.length - 1];
	}
	
	constructor(url?: string) {
		this.url = url || API_ENDPOINTS.websocket;
	}
	
	// 接続
	connect() {
		if (this.connected || this.connecting) return;
		
		this.connecting = true;
		this.error = null;
		
		try {
			this.ws = new WebSocket(this.url);
			
			// イベントハンドラー
			this.ws.onopen = () => this.handleOpen();
			this.ws.onmessage = (event) => this.handleMessage(event);
			this.ws.onerror = (error) => this.handleError(error);
			this.ws.onclose = (event) => this.handleClose(event);
		} catch (err) {
			this.connecting = false;
			this.error = err instanceof Error ? err : new Error('接続エラー');
		}
	}
	
	// 切断
	disconnect() {
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer);
			this.reconnectTimer = undefined;
		}
		
		this.stopHeartbeat();
		
		if (this.ws) {
			this.ws.close(1000, 'ユーザーによる切断');
			this.ws = null;
		}
		
		this.connected = false;
		this.connecting = false;
		this.authenticated = false;
		this.subscriptions.clear();
	}
	
	// メッセージ送信
	send(data: any) {
		if (!this.connected || !this.ws) {
			console.error('WebSocket未接続');
			return;
		}
		
		this.ws.send(JSON.stringify(data));
	}
	
	// 認証
	authenticate() {
		const apiKey = getApiKey();
		if (!apiKey) {
			console.warn('APIキーが設定されていません');
			return;
		}
		
		this.send({
			type: 'auth',
			apiKey
		});
	}
	
	// タスクのサブスクライブ
	subscribe(taskId: string) {
		if (this.subscriptions.has(taskId)) return;
		
		this.subscriptions.add(taskId);
		
		if (this.connected) {
			this.send({
				type: 'subscribe',
				taskId
			});
		}
	}
	
	// タスクのアンサブスクライブ
	unsubscribe(taskId: string) {
		if (!this.subscriptions.has(taskId)) return;
		
		this.subscriptions.delete(taskId);
		
		if (this.connected) {
			this.send({
				type: 'unsubscribe',
				taskId
			});
		}
	}
	
	// タスクのメッセージを取得（リアクティブ）
	getTaskMessages(taskId: string): WebSocketMessage[] {
		return this.taskMessages.get(taskId) || [];
	}
	
	// タスクのメッセージをクリア
	clearTaskMessages(taskId: string) {
		this.taskMessages.delete(taskId);
	}
	
	// ハンドラー
	private handleOpen() {
		console.log('WebSocket接続成功');
		this.connected = true;
		this.connecting = false;
		this.reconnectAttempts = 0;
		
		// 認証
		this.authenticate();
		
		// ハートビート開始
		this.startHeartbeat();
		
		// 再接続時にサブスクリプションを復元
		this.subscriptions.forEach(taskId => {
			this.send({ type: 'subscribe', taskId });
		});
	}
	
	private handleMessage(event: MessageEvent) {
		try {
			const message: WebSocketMessage = JSON.parse(event.data);
			
			// メッセージを記録
			this.messages = [...this.messages, message];
			
			// タスク別にメッセージを記録
			if (message.taskId) {
				const taskMessages = this.taskMessages.get(message.taskId) || [];
				this.taskMessages.set(message.taskId, [...taskMessages, message]);
			}
			
			// 認証成功
			if (message.type === 'auth:success') {
				this.authenticated = true;
				console.log('WebSocket認証成功');
			}
			
			// 認証エラー
			if (message.type === 'auth:error') {
				this.authenticated = false;
				console.error('WebSocket認証失敗:', message.error);
			}
			
			// pong（ハートビート応答）
			if (message.type === 'pong') {
				// ハートビート応答を受信
			}
		} catch (error) {
			console.error('メッセージ解析エラー:', error);
		}
	}
	
	private handleError(error: Event) {
		console.error('WebSocketエラー:', error);
		this.error = new Error('WebSocket接続エラー');
	}
	
	private handleClose(event: CloseEvent) {
		console.log('WebSocket切断:', event.code, event.reason);
		this.connected = false;
		this.connecting = false;
		this.authenticated = false;
		
		this.stopHeartbeat();
		
		// 正常終了でない場合は再接続
		if (event.code !== 1000 && event.code !== 1001) {
			this.scheduleReconnect();
		}
	}
	
	// 再接続
	private scheduleReconnect() {
		if (this.reconnectAttempts >= 10) {
			this.error = new Error('再接続の最大試行回数に達しました');
			return;
		}
		
		this.reconnectAttempts++;
		const delay = Math.min(5000 * Math.pow(2, this.reconnectAttempts - 1), 30000);
		
		console.log(`${delay}ms後に再接続を試みます（${this.reconnectAttempts}/10）`);
		
		this.reconnectTimer = window.setTimeout(() => {
			this.connect();
		}, delay);
	}
	
	// ハートビート
	private startHeartbeat() {
		this.heartbeatTimer = window.setInterval(() => {
			if (this.connected && this.ws && this.ws.readyState === WebSocket.OPEN) {
				this.send({ type: 'ping' });
			}
		}, 30000);
	}
	
	private stopHeartbeat() {
		if (this.heartbeatTimer) {
			clearInterval(this.heartbeatTimer);
			this.heartbeatTimer = undefined;
		}
	}
}

// コンテキストキー
const WEBSOCKET_KEY = Symbol('websocket');

// WebSocketコンテキストの設定
export function setWebSocketContext(ws: WebSocketConnection) {
	setContext(WEBSOCKET_KEY, ws);
}

// WebSocketコンテキストの取得
export function getWebSocketContext(): WebSocketConnection {
	const ws = getContext<WebSocketConnection>(WEBSOCKET_KEY);
	if (!ws) {
		throw new Error('WebSocketコンテキストが設定されていません');
	}
	return ws;
}

// WebSocketコネクションのファクトリー
export function createWebSocketConnection(url?: string): WebSocketConnection {
	return new WebSocketConnection(url);
}